import { Logger } from '../logging';

type NodeRequire = (id: string) => unknown;

type FsLike = {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding?: 'utf8') => string | Uint8Array;
  writeFileSync: (path: string, data: string, encoding: 'utf8') => void;
  mkdirSync: (path: string, options: { recursive: boolean }) => void;
  unlinkSync: (path: string) => void;
  statSync: (path: string) => { isFile: () => boolean };
};

type PathLike = {
  join: (...parts: string[]) => string;
  resolve: (...parts: string[]) => string;
  sep: string;
};

type PreviewIndex = {
  version: number;
  files: PreviewFileEntry[];
};

export type PreviewFileEntry = {
  path: string;
  createdAt: string;
};

export type PreviewStoreOptions = {
  autoCleanup: boolean;
  baseDir?: string;
  retentionSeconds?: number;
};

export type CleanupResult = {
  removed: number;
  missing: number;
  failed: number;
};

const INDEX_VERSION = 1;
const INDEX_FILE = '.bbmcp-preview-index.json';

const getRequire = (): NodeRequire | null => {
  const globalRef = globalThis as unknown as { require?: NodeRequire; module?: { require?: NodeRequire } };
  if (typeof globalRef.require === 'function') return globalRef.require;
  if (typeof globalRef.module?.require === 'function') return globalRef.module.require;
  return null;
};

const tryRequire = <T>(id: string): T | null => {
  const req = getRequire();
  if (!req) return null;
  try {
    return req(id) as T;
  } catch {
    return null;
  }
};

const normalizeForCompare = (value: string, caseSensitive: boolean): string => {
  const normalized = value.replace(/\\/g, '/');
  return caseSensitive ? normalized : normalized.toLowerCase();
};

const resolveEnvRoot = (): string | null => {
  const proc = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
  const env = proc?.env ?? {};
  const candidates = [
    env.BBMCP_DATA_DIR,
    env.LOCALAPPDATA,
    env.APPDATA,
    env.USERPROFILE,
    env.HOME
  ];
  const found = candidates.find((entry) => typeof entry === 'string' && entry.trim().length > 0);
  return found ? String(found).trim() : null;
};

const resolveBaseRoot = (baseDirOverride?: string): string | null => {
  if (baseDirOverride && baseDirOverride.trim().length > 0) return baseDirOverride.trim();
  const blockbench = (globalThis as unknown as { Blockbench?: { getUserDataPath?: () => string; getDataPath?: () => string } })
    .Blockbench;
  const userData =
    typeof blockbench?.getUserDataPath === 'function'
      ? blockbench.getUserDataPath()
      : typeof blockbench?.getDataPath === 'function'
        ? blockbench.getDataPath()
        : null;
  return userData || resolveEnvRoot();
};

const ensureTrailingSlash = (value: string, sep: string): string => {
  if (value.endsWith('/') || value.endsWith('\\')) return value;
  return `${value}${sep}`;
};

export class PreviewStore {
  private readonly log: Logger;
  private readonly fs: FsLike | null;
  private readonly path: PathLike | null;
  private readonly caseSensitive: boolean;
  private readonly baseDir: string | null;
  private readonly indexPath: string | null;
  private autoCleanup: boolean;
  private retentionSeconds: number | null;
  private initialized = false;
  private entries: PreviewFileEntry[] = [];

  constructor(log: Logger, options: PreviewStoreOptions) {
    this.log = log;
    this.fs = tryRequire<FsLike>('fs');
    this.path = tryRequire<PathLike>('path');
    const platform = (globalThis as unknown as { process?: { platform?: string } }).process?.platform ?? '';
    this.caseSensitive = platform !== 'win32';
    const root = resolveBaseRoot(options.baseDir);
    const sep = this.path?.sep ?? (root?.includes('\\') ? '\\' : '/');
    const resolvedRoot = root
      ? this.path?.join(root, 'bbmcp', 'previews') ?? ensureTrailingSlash(root, sep) + `bbmcp${sep}previews`
      : null;
    this.baseDir = resolvedRoot ? this.path?.resolve(resolvedRoot) ?? resolvedRoot : null;
    this.indexPath = this.baseDir ? this.path?.join(this.baseDir, INDEX_FILE) ?? `${this.baseDir}${sep}${INDEX_FILE}` : null;
    this.autoCleanup = options.autoCleanup;
    this.retentionSeconds = typeof options.retentionSeconds === 'number' ? options.retentionSeconds : null;
  }

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    if (!this.fs || !this.baseDir || !this.indexPath) {
      this.log.warn('preview store disabled (filesystem unavailable)');
      return;
    }
    try {
      this.fs.mkdirSync(this.baseDir, { recursive: true });
      this.loadIndex();
      if (this.autoCleanup) {
        const result = this.cleanup();
        this.log.info('preview cleanup completed', result ?? {});
      } else if (this.retentionSeconds) {
        const result = this.cleanupExpired();
        this.log.info('preview cleanup completed', result ?? {});
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'preview store init failed';
      this.log.error('preview store init error', { message });
    }
  }

  setAutoCleanup(enabled: boolean): void {
    this.autoCleanup = enabled;
  }

  setRetentionSeconds(value: number | null | undefined): void {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      this.retentionSeconds = Math.floor(value);
    } else {
      this.retentionSeconds = null;
    }
  }

  getRootDir(): string | null {
    return this.baseDir;
  }

  getRetentionSeconds(): number | null {
    return this.retentionSeconds;
  }

  getExpiresAt(now = Date.now()): string | null {
    if (!this.retentionSeconds || this.retentionSeconds <= 0) return null;
    return new Date(now + this.retentionSeconds * 1000).toISOString();
  }

  getUniqueFileName(baseName: string, ext: string): string {
    const safeBase = baseName.trim() || 'preview';
    const safeExt = ext.startsWith('.') ? ext : `.${ext || 'png'}`;
    const first = `${safeBase}${safeExt}`;
    if (!this.isNameUsed(first)) return first;
    for (let i = 2; i <= 9999; i += 1) {
      const candidate = `${safeBase}_${i}${safeExt}`;
      if (!this.isNameUsed(candidate)) return candidate;
    }
    return `${safeBase}_${Date.now()}${safeExt}`;
  }

  getUniqueSequenceBase(baseName: string, ext: string): string {
    const safeBase = baseName.trim() || 'preview';
    const safeExt = ext.startsWith('.') ? ext : `.${ext || 'png'}`;
    if (!this.isSequenceBaseUsed(safeBase, safeExt)) return safeBase;
    for (let i = 2; i <= 9999; i += 1) {
      const candidate = `${safeBase}_${i}`;
      if (!this.isSequenceBaseUsed(candidate, safeExt)) return candidate;
    }
    return `${safeBase}_${Date.now()}`;
  }

  buildPath(fileName: string): string | null {
    if (!this.baseDir) return null;
    if (this.path) {
      return this.path.join(this.baseDir, fileName);
    }
    const sep = this.baseDir.includes('\\') ? '\\' : '/';
    return this.baseDir.endsWith(sep) ? `${this.baseDir}${fileName}` : `${this.baseDir}${sep}${fileName}`;
  }

  trackFile(outputPath: string): void {
    if (!this.fs || !this.baseDir || !this.indexPath) return;
    const relative = this.toRelativePath(outputPath);
    if (!relative) return;
    if (relative.includes('/') || relative.includes('\\')) return;
    const existing = this.entries.find((entry) => entry.path === relative);
    if (!existing) {
      this.entries.push({ path: relative, createdAt: new Date().toISOString() });
      this.persistIndex();
    }
    if (this.retentionSeconds) {
      this.cleanupExpired();
    }
  }

  readPng(id: string): { ok: true; bytes: Uint8Array; path: string } | { ok: false; message: string } {
    if (!this.fs || !this.baseDir) return { ok: false, message: 'filesystem unavailable' };
    const raw = String(id ?? '').trim();
    if (!raw) return { ok: false, message: 'file id required' };
    if (raw.includes('/') || raw.includes('\\')) return { ok: false, message: 'invalid file id' };
    if (!raw.toLowerCase().endsWith('.png')) return { ok: false, message: 'only png supported' };
    const entry = this.findEntry(raw);
    if (!entry) return { ok: false, message: 'file not tracked' };
    const absolute = this.buildPath(entry.path);
    if (!absolute) return { ok: false, message: 'file path unavailable' };
    try {
      if (!this.fs.existsSync(absolute)) return { ok: false, message: 'file missing' };
      const stat = this.fs.statSync(absolute);
      if (!stat.isFile()) return { ok: false, message: 'file missing' };
      const data = this.fs.readFileSync(absolute);
      if (typeof data === 'string') {
        return { ok: false, message: 'binary read failed' };
      }
      return { ok: true, bytes: data, path: absolute };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'file read failed';
      return { ok: false, message };
    }
  }

  cleanup(): CleanupResult | null {
    if (!this.fs || !this.baseDir || !this.indexPath) return null;
    const base = normalizeForCompare(this.baseDir, this.caseSensitive);
    let removed = 0;
    let missing = 0;
    let failed = 0;
    for (const entry of this.entries) {
      const absolute = this.buildPath(entry.path);
      if (!absolute) continue;
      const normalized = normalizeForCompare(absolute, this.caseSensitive);
      if (!normalized.startsWith(base + '/')) {
        continue;
      }
      try {
        if (!this.fs.existsSync(absolute)) {
          missing += 1;
          continue;
        }
        const stat = this.fs.statSync(absolute);
        if (!stat.isFile()) {
          missing += 1;
          continue;
        }
        this.fs.unlinkSync(absolute);
        removed += 1;
      } catch {
        failed += 1;
      }
    }
    this.entries = [];
    this.persistIndex();
    return { removed, missing, failed };
  }

  cleanupExpired(now = Date.now()): CleanupResult | null {
    if (!this.fs || !this.baseDir || !this.indexPath) return null;
    if (!this.retentionSeconds || this.retentionSeconds <= 0) return { removed: 0, missing: 0, failed: 0 };
    const cutoff = now - this.retentionSeconds * 1000;
    let removed = 0;
    let missing = 0;
    let failed = 0;
    const remaining: PreviewFileEntry[] = [];
    for (const entry of this.entries) {
      const createdAt = Date.parse(entry.createdAt);
      if (!Number.isFinite(createdAt) || createdAt > cutoff) {
        remaining.push(entry);
        continue;
      }
      const absolute = this.buildPath(entry.path);
      if (!absolute) {
        remaining.push(entry);
        continue;
      }
      try {
        if (!this.fs.existsSync(absolute)) {
          missing += 1;
        } else {
          const stat = this.fs.statSync(absolute);
          if (stat.isFile()) {
            this.fs.unlinkSync(absolute);
            removed += 1;
          } else {
            missing += 1;
          }
        }
      } catch {
        failed += 1;
      }
    }
    this.entries = remaining;
    this.persistIndex();
    return { removed, missing, failed };
  }

  private loadIndex(): void {
    if (!this.fs || !this.indexPath) return;
    if (!this.fs.existsSync(this.indexPath)) {
      this.entries = [];
      this.persistIndex();
      return;
    }
    try {
      const raw = this.fs.readFileSync(this.indexPath, 'utf8');
      const parsed = JSON.parse(raw) as PreviewIndex;
      if (!parsed || parsed.version !== INDEX_VERSION || !Array.isArray(parsed.files)) {
        this.entries = [];
        this.persistIndex();
        return;
      }
      this.entries = parsed.files.filter((entry) => typeof entry?.path === 'string');
    } catch {
      this.entries = [];
      this.persistIndex();
    }
  }

  private persistIndex(): void {
    if (!this.fs || !this.indexPath) return;
    const payload: PreviewIndex = { version: INDEX_VERSION, files: this.entries };
    try {
      this.fs.writeFileSync(this.indexPath, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'preview index write failed';
      this.log.warn('preview index write failed', { message });
    }
  }

  private toRelativePath(outputPath: string): string | null {
    if (!this.baseDir) return null;
    const base = normalizeForCompare(this.baseDir, this.caseSensitive);
    const normalized = normalizeForCompare(outputPath, this.caseSensitive);
    if (!normalized.startsWith(base + '/')) return null;
    return normalized.slice(base.length + 1);
  }

  private findEntry(id: string): PreviewFileEntry | null {
    const target = normalizeForCompare(id, this.caseSensitive);
    return this.entries.find((entry) => normalizeForCompare(entry.path, this.caseSensitive) === target) ?? null;
  }

  private isNameUsed(fileName: string): boolean {
    if (this.findEntry(fileName)) return true;
    const absolute = this.buildPath(fileName);
    return Boolean(absolute && this.fs?.existsSync(absolute));
  }

  private isSequenceBaseUsed(baseName: string, ext: string): boolean {
    const normalizedBase = normalizeForCompare(baseName, this.caseSensitive);
    const normalizedExt = normalizeForCompare(ext, this.caseSensitive);
    for (const entry of this.entries) {
      const normalizedPath = normalizeForCompare(entry.path, this.caseSensitive);
      if (normalizedPath === `${normalizedBase}${normalizedExt}`) return true;
      if (normalizedPath.startsWith(`${normalizedBase}_`)) return true;
    }
    return false;
  }
}
