import {
  hasExactContractKeys,
  isClosedContractRecord,
  isDenseContractArray,
  isNonEmptyContractText
} from '@ashfox/internal-contracts';

import {
  ASHFOX_LOCK_FORMAT,
  ASHFOX_PACKAGE_FORMAT,
  ASHFOX_WORKSPACE_FORMAT,
  ASHFOX_WORKSPACE_VERSION,
  type AssetEntry,
  type LockedDependency,
  type LockedFile,
  type LockedPackage,
  type ModuleDeclaration,
  type PackageDependency,
  type PackageManifest,
  type Sha256Digest,
  type WorkspaceLock,
  type WorkspaceManifest,
  type WorkspacePackage
} from './contract';
import {
  errorDiagnostic,
  syntheticSourceRef,
  type WorkspaceReadResult
} from './diagnostic';
import {
  assertWellFormedSourceText,
  normalizeLogicalPath,
  normalizePackageRoot,
  normalizeRelativePath
} from './path';

type RecordValue = Readonly<Record<string, unknown>>;
const contractRef = syntheticSourceRef('ashfox.workspace.json');

const fail = <T>(code: string, message: string): WorkspaceReadResult<T> => ({
  ok: false,
  diagnostics: [errorDiagnostic(code, message, contractRef)]
});

const exactRecord = (value: unknown, keys: readonly string[]): value is RecordValue =>
  isClosedContractRecord(value) && hasExactContractKeys(value, new Set(keys));

const text = (value: unknown, field: string): WorkspaceReadResult<string> => {
  if (!isNonEmptyContractText(value)) return fail('workspace.contract.text',
    `${field} must be non-empty text without surrounding whitespace.`);
  try {
    return { ok: true, value: assertWellFormedSourceText(value) };
  } catch (error) {
    return fail('workspace.contract.utf8',
      error instanceof Error ? error.message : `${field} is not valid UTF-8 text.`);
  }
};

const identifier = (value: unknown, field: string): WorkspaceReadResult<string> => {
  const valueText = text(value, field);
  if (!valueText.ok) return valueText;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(valueText.value)) {
    return fail('workspace.contract.identifier', `${field} must be an ASCII identifier.`);
  }
  return valueText;
};

const packageName = (value: unknown, field: string): WorkspaceReadResult<string> => {
  const valueText = text(value, field);
  if (!valueText.ok) return valueText;
  const valid = /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$|^[a-z0-9][a-z0-9._-]*$/u
    .test(valueText.value);
  if (!valid) return fail('workspace.contract.package_name',
    `${field} must be a normalized lowercase package name.`);
  return valueText;
};

const relativeSourcePath = (
  value: unknown,
  field: string
): WorkspaceReadResult<string> => {
  const valueText = text(value, field);
  if (!valueText.ok) return valueText;
  try {
    const path = normalizeRelativePath(valueText.value);
    if (!path.endsWith('.ashfox')) return fail('workspace.contract.source_extension',
      `${field} must refer to an .ashfox source file.`);
    return { ok: true, value: path };
  } catch (error) {
    return fail('workspace.contract.path',
      error instanceof Error ? error.message : `${field} is not a normalized path.`);
  }
};

const rootPath = (value: unknown, field: string): WorkspaceReadResult<string> => {
  if (value === '') return { ok: true, value: '' };
  const valueText = text(value, field);
  if (!valueText.ok) return valueText;
  try {
    return { ok: true, value: normalizePackageRoot(valueText.value) };
  } catch (error) {
    return fail('workspace.contract.path',
      error instanceof Error ? error.message : `${field} is not a normalized path.`);
  }
};

const subpath = (value: unknown, field: string): WorkspaceReadResult<string> => {
  const valueText = text(value, field);
  if (!valueText.ok) return valueText;
  if (!valueText.value.startsWith('./')) return fail('workspace.contract.subpath',
    `${field} must begin with ./ and remain package-local.`);
  try {
    return { ok: true, value: `./${normalizeRelativePath(valueText.value.slice(2))}` };
  } catch (error) {
    return fail('workspace.contract.subpath',
      error instanceof Error ? error.message : `${field} is not a subpath.`);
  }
};

const digest = (
  value: unknown,
  field: string,
  nullable = false
): WorkspaceReadResult<Sha256Digest | null> => {
  if (nullable && value === null) return { ok: true, value: null };
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    return fail('workspace.contract.digest',
      `${field} must be a lowercase sha256 content address.`);
  }
  return { ok: true, value: value as Sha256Digest };
};

const array = (value: unknown, field: string): WorkspaceReadResult<readonly unknown[]> =>
  isDenseContractArray(value)
    ? { ok: true, value }
    : fail('workspace.contract.array', `${field} must be a dense array.`);

const version = (value: unknown, field: string): WorkspaceReadResult<1> =>
  value === ASHFOX_WORKSPACE_VERSION
    ? { ok: true, value: 1 }
    : fail('workspace.contract.version', `${field} must be version 1.`);

const duplicate = (
  values: readonly string[],
  folded = false
): string | undefined => {
  const seen = new Set<string>();
  for (const value of values) {
    // Package identities are ASCII. Paths are checked by the authority reader.
    const key = folded ? value.replace(/[A-Z]/gu, (letter) => letter.toLowerCase()) : value;
    if (seen.has(key)) return value;
    seen.add(key);
  }
  return undefined;
};

const readEntry = (value: unknown): WorkspaceReadResult<AssetEntry> => {
  if (!exactRecord(value, ['name', 'path'])) return fail('workspace.contract.entry',
    'Each entry must contain exactly name and path.');
  const name = identifier(value.name, 'entry.name');
  if (!name.ok) return name;
  const path = relativeSourcePath(value.path, 'entry.path');
  if (!path.ok) return path;
  return { ok: true, value: Object.freeze({ name: name.value, path: path.value }) };
};

const readModule = (value: unknown): WorkspaceReadResult<ModuleDeclaration> => {
  if (!exactRecord(value, ['subpath', 'path'])) return fail('workspace.contract.module',
    'Each module must contain exactly subpath and path.');
  const exposed = subpath(value.subpath, 'module.subpath');
  if (!exposed.ok) return exposed;
  const path = relativeSourcePath(value.path, 'module.path');
  if (!path.ok) return path;
  return { ok: true, value: Object.freeze({
    subpath: exposed.value,
    path: path.value
  }) };
};
const readDependency = (value: unknown): WorkspaceReadResult<PackageDependency> => {
  if (!exactRecord(value, ['name'])) return fail('workspace.contract.dependency',
    'Each dependency must contain exactly name.');
  const name = packageName(value.name, 'dependency.name');
  if (!name.ok) return name;
  return { ok: true, value: Object.freeze({ name: name.value }) };
};

export const readPackageManifest = (
  value: unknown
): WorkspaceReadResult<PackageManifest> => {
  if (!exactRecord(value, ['format', 'version', 'entries', 'modules', 'dependencies'])) {
    return fail('workspace.contract.package_manifest',
      'Package manifests have a closed format/version/entries/modules/dependencies schema.');
  }
  if (value.format !== ASHFOX_PACKAGE_FORMAT) return fail('workspace.contract.format',
    'Package manifest format is invalid.');
  const packageVersion = version(value.version, 'package.version');
  if (!packageVersion.ok) return packageVersion;
  const entriesInput = array(value.entries, 'package.entries');
  if (!entriesInput.ok) return entriesInput;
  const modulesInput = array(value.modules, 'package.modules');
  if (!modulesInput.ok) return modulesInput;
  const dependenciesInput = array(value.dependencies, 'package.dependencies');
  if (!dependenciesInput.ok) return dependenciesInput;
  const entries: AssetEntry[] = [];
  const modules: ModuleDeclaration[] = [];
  const dependencies: PackageDependency[] = [];
  for (const item of entriesInput.value) {
    const parsed = readEntry(item);
    if (!parsed.ok) return parsed;
    entries.push(parsed.value);
  }
  for (const item of modulesInput.value) {
    const parsed = readModule(item);
    if (!parsed.ok) return parsed;
    modules.push(parsed.value);
  }
  for (const item of dependenciesInput.value) {
    const parsed = readDependency(item);
    if (!parsed.ok) return parsed;
    dependencies.push(parsed.value);
  }
  const duplicateEntry = duplicate(entries.map((entry) => entry.name));
  if (duplicateEntry !== undefined) return fail('workspace.contract.duplicate_entry',
    `Duplicate entry name: ${duplicateEntry}.`);
  const duplicateModule = duplicate(modules.map((module) => module.subpath));
  if (duplicateModule !== undefined) return fail('workspace.contract.duplicate_module',
    `Duplicate module subpath: ${duplicateModule}.`);
  const duplicatePath = duplicate([
    ...entries.map((entry) => entry.path),
    ...modules.map((module) => module.path)
  ]);
  if (duplicatePath !== undefined) return fail('workspace.contract.duplicate_source',
    `A source path is declared more than once: ${duplicatePath}.`);
  const duplicateDependency = duplicate(dependencies.map((item) => item.name), true);
  if (duplicateDependency !== undefined) return fail('workspace.contract.duplicate_dependency',
    `Duplicate package dependency: ${duplicateDependency}.`);
  return { ok: true, value: Object.freeze({
    format: ASHFOX_PACKAGE_FORMAT,
    version: 1,
    entries: Object.freeze(entries.sort((a, b) => a.name < b.name ? -1 : 1)),
    modules: Object.freeze(modules.sort((a, b) => a.subpath < b.subpath ? -1 : 1)),
    dependencies: Object.freeze(dependencies.sort((a, b) => a.name < b.name ? -1 : 1))
  }) };
};

const readWorkspacePackage = (value: unknown): WorkspaceReadResult<WorkspacePackage> => {
  if (!exactRecord(value, ['name', 'root', 'manifest'])) return fail('workspace.contract.package',
    'Each package must contain exactly name, root, and manifest.');
  const name = packageName(value.name, 'package.name');
  if (!name.ok) return name;
  const root = rootPath(value.root, 'package.root');
  if (!root.ok) return root;
  const manifest = readPackageManifest(value.manifest);
  if (!manifest.ok) return manifest;
  return { ok: true, value: Object.freeze({
    name: name.value,
    root: root.value,
    manifest: manifest.value
  }) };
};

export const readWorkspaceManifest = (
  value: unknown
): WorkspaceReadResult<WorkspaceManifest> => {
  if (!exactRecord(value, ['format', 'version', 'packages'])) return fail('workspace.contract.manifest',
    'Workspace manifests have a closed format/version/packages schema.');
  if (value.format !== ASHFOX_WORKSPACE_FORMAT) return fail('workspace.contract.format',
    'Workspace manifest format is invalid.');
  const workspaceVersion = version(value.version, 'workspace.version');
  if (!workspaceVersion.ok) return workspaceVersion;
  const packagesInput = array(value.packages, 'workspace.packages');
  if (!packagesInput.ok) return packagesInput;
  const packages: WorkspacePackage[] = [];
  for (const item of packagesInput.value) {
    const parsed = readWorkspacePackage(item);
    if (!parsed.ok) return parsed;
    packages.push(parsed.value);
  }
  const duplicatePackage = duplicate(packages.map((pkg) => pkg.name), true);
  if (duplicatePackage !== undefined) return fail('workspace.contract.duplicate_package',
    `Duplicate or case-colliding package name: ${duplicatePackage}.`);
  return { ok: true, value: Object.freeze({
    format: ASHFOX_WORKSPACE_FORMAT,
    version: 1,
    packages: Object.freeze(packages.sort((a, b) => a.name < b.name ? -1 : 1))
  }) };
};

const readLockedFile = (value: unknown): WorkspaceReadResult<LockedFile> => {
  if (!exactRecord(value, ['path', 'contentHash'])) return fail('workspace.contract.lock_file',
    'Each locked file must contain exactly path and contentHash.');
  if (typeof value.path !== 'string') return fail('workspace.contract.path',
    'Locked file path must be text.');
  let path: string;
  try {
    path = normalizeLogicalPath(value.path);
  } catch (error) {
    return fail('workspace.contract.path', error instanceof Error ? error.message :
      'Locked file path is invalid.');
  }
  const contentHash = digest(value.contentHash, 'locked_file.contentHash');
  if (!contentHash.ok || contentHash.value === null) return contentHash.ok
    ? fail('workspace.contract.digest', 'Locked file contentHash is required.')
    : contentHash;
  return { ok: true, value: Object.freeze({ path, contentHash: contentHash.value }) };
};

const readLockedDependency = (
  value: unknown
): WorkspaceReadResult<LockedDependency> => {
  if (!exactRecord(value, ['name', 'contentHash', 'interfaceHash'])) return fail(
    'workspace.contract.lock_dependency',
    'Each locked dependency must contain exactly name, contentHash, interfaceHash.');
  const name = packageName(value.name, 'locked_dependency.name');
  if (!name.ok) return name;
  const contentHash = digest(value.contentHash, 'locked_dependency.contentHash');
  if (!contentHash.ok || contentHash.value === null) return contentHash.ok
    ? fail('workspace.contract.digest', 'Locked dependency contentHash is required.')
    : contentHash;
  const interfaceHash = digest(value.interfaceHash, 'locked_dependency.interfaceHash');
  if (!interfaceHash.ok || interfaceHash.value === null) return interfaceHash.ok
    ? fail('workspace.contract.digest', 'Locked dependency interfaceHash is required.')
    : interfaceHash;
  return { ok: true, value: Object.freeze({
    name: name.value,
    contentHash: contentHash.value,
    interfaceHash: interfaceHash.value
  }) };
};

const readLockedPackage = (value: unknown): WorkspaceReadResult<LockedPackage> => {
  if (!exactRecord(value, ['name', 'source', 'digest', 'root', 'manifest', 'contentHash',
    'manifestHash', 'files', 'interfaceHash', 'dependencies'])) return fail(
    'workspace.contract.lock_package',
    'Locked packages use a closed package identity and embedded-content schema.');
  const name = packageName(value.name, 'locked_package.name');
  if (!name.ok) return name;
  if (value.source !== 'workspace' && value.source !== 'cas') return fail(
    'workspace.contract.lock_source', 'Locked package source must be workspace or cas.');
  const packageDigest = digest(value.digest, 'locked_package.digest', true);
  if (!packageDigest.ok) return packageDigest;
  if (value.source === 'workspace' && packageDigest.value !== null) return fail(
    'workspace.contract.lock_source', 'Workspace lock packages must not carry a CAS digest.');
  if (value.source === 'cas' && packageDigest.value === null) return fail(
    'workspace.contract.lock_source', 'CAS lock packages need an embedded content digest.');
  const root = rootPath(value.root, 'locked_package.root');
  if (!root.ok) return root;
  if (value.source === 'cas' && root.value === '') return fail('workspace.contract.lock_root',
    'CAS packages need a non-empty embedded root.');
  const manifest = readPackageManifest(value.manifest);
  if (!manifest.ok) return manifest;
  const contentHash = digest(value.contentHash, 'locked_package.contentHash');
  if (!contentHash.ok || contentHash.value === null) return contentHash.ok
    ? fail('workspace.contract.digest', 'Locked package contentHash is required.')
    : contentHash;
  const manifestHash = digest(value.manifestHash, 'locked_package.manifestHash');
  if (!manifestHash.ok || manifestHash.value === null) return manifestHash.ok
    ? fail('workspace.contract.digest', 'Locked package manifestHash is required.')
    : manifestHash;
  const interfaceHash = digest(value.interfaceHash, 'locked_package.interfaceHash');
  if (!interfaceHash.ok || interfaceHash.value === null) return interfaceHash.ok
    ? fail('workspace.contract.digest', 'Locked package interfaceHash is required.')
    : interfaceHash;
  const filesInput = array(value.files, 'locked_package.files');
  if (!filesInput.ok) return filesInput;
  const files: LockedFile[] = [];
  for (const item of filesInput.value) {
    const parsed = readLockedFile(item);
    if (!parsed.ok) return parsed;
    files.push(parsed.value);
  }
  const dependenciesInput = array(value.dependencies, 'locked_package.dependencies');
  if (!dependenciesInput.ok) return dependenciesInput;
  const dependencies: LockedDependency[] = [];
  for (const item of dependenciesInput.value) {
    const parsed = readLockedDependency(item);
    if (!parsed.ok) return parsed;
    dependencies.push(parsed.value);
  }
  const duplicateFile = duplicate(files.map((file) => file.path), true);
  if (duplicateFile !== undefined) return fail('workspace.contract.duplicate_lock_file',
    `Duplicate or case-colliding locked file path: ${duplicateFile}.`);
  const duplicateDependency = duplicate(dependencies.map((item) => item.name), true);
  if (duplicateDependency !== undefined) return fail('workspace.contract.duplicate_lock_dependency',
    `Duplicate locked dependency: ${duplicateDependency}.`);
  return { ok: true, value: Object.freeze({
    name: name.value,
    source: value.source,
    digest: packageDigest.value,
    root: root.value,
    manifest: manifest.value,
    contentHash: contentHash.value,
    manifestHash: manifestHash.value,
    files: Object.freeze(files.sort((a, b) => a.path < b.path ? -1 : 1)),
    interfaceHash: interfaceHash.value,
    dependencies: Object.freeze(dependencies.sort((a, b) => a.name < b.name ? -1 : 1))
  }) };
};

export const readWorkspaceLock = (
  value: unknown
): WorkspaceReadResult<WorkspaceLock> => {
  if (!exactRecord(value, ['format', 'version', 'compilerFingerprint', 'packages'])) return fail(
    'workspace.contract.lock',
    'Workspace locks have a closed format/version/compilerFingerprint/packages schema.');
  if (value.format !== ASHFOX_LOCK_FORMAT) return fail('workspace.contract.format',
    'Workspace lock format is invalid.');
  const lockVersion = version(value.version, 'lock.version');
  if (!lockVersion.ok) return lockVersion;
  const fingerprint = text(value.compilerFingerprint, 'lock.compilerFingerprint');
  if (!fingerprint.ok) return fingerprint;
  const packagesInput = array(value.packages, 'lock.packages');
  if (!packagesInput.ok) return packagesInput;
  const packages: LockedPackage[] = [];
  for (const item of packagesInput.value) {
    const parsed = readLockedPackage(item);
    if (!parsed.ok) return parsed;
    packages.push(parsed.value);
  }
  const duplicatePackage = duplicate(packages.map((pkg) => pkg.name), true);
  if (duplicatePackage !== undefined) return fail('workspace.contract.duplicate_lock_package',
    `Duplicate or case-colliding locked package: ${duplicatePackage}.`);
  return { ok: true, value: Object.freeze({
    format: ASHFOX_LOCK_FORMAT,
    version: 1,
    compilerFingerprint: fingerprint.value,
    packages: Object.freeze(packages.sort((a, b) => a.name < b.name ? -1 : 1))
  }) };
};
