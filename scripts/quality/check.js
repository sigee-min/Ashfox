/* eslint-disable no-console */
// ashfox release gate: lightweight static checks.
// Intentionally dependency-free: Node fs + regex scanning.

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');

const readText = (filePath) => fs.readFileSync(filePath, 'utf8');
const readModuleSpecifiers = (source) => {
  const specifiers = [];
  const pattern =
    /(?:\bfrom\s+|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    specifiers.push(match[1]);
  }
  return specifiers;
};

const walk = (dir, predicate) => {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      out.push(...walk(full, predicate));
      continue;
    }
    if (predicate(full)) out.push(full);
  }
  return out;
};

const rel = (filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/');

const scanFile = (filePath, rules) => {
  const text = readText(filePath);
  const lines = text.split(/\r?\n/);
  /** @type {Array<{file:string,line:number,rule:string,snippet:string}>} */
  const findings = [];

  for (let i = 0; i < lines.length; i += 1) {
    const lineNo = i + 1;
    const line = lines[i];
    for (const rule of rules) {
      if (rule.appliesTo && !rule.appliesTo(filePath)) continue;
      if (rule.allow && rule.allow(filePath, line)) continue;
      if (rule.pattern.test(line)) {
        findings.push({
          file: rel(filePath),
          line: lineNo,
          rule: rule.id,
          snippet: line.trim().slice(0, 200)
        });
      }
    }
  }
  return findings;
};

const assertRemovedBoundariesStayRemoved = () => {
  const removedPaths = [
    'apps/plugin-desktop/package.json',
    'apps/ashfox/package.json',
    'packages/backend-blockbench/package.json',
    'apps/mcp-gateway/package.json',
    'apps/worker/package.json',
    'packages/backend-core/package.json',
    'packages/backend-engine/package.json',
    'apps/web/src/app/api/mcp/route.ts'
  ];
  for (const removedPath of removedPaths) {
    if (fs.existsSync(path.join(repoRoot, removedPath))) {
      throw new Error(`quality: removed boundary restored: ${removedPath}`);
    }
  }
};

const assertTrackDependencies = () => {
  const rootPackage = JSON.parse(readText(path.join(repoRoot, 'package.json')));
  const webPackage = JSON.parse(
    readText(path.join(repoRoot, 'apps', 'web', 'package.json'))
  );
  const sitePackage = JSON.parse(
    readText(path.join(repoRoot, 'apps', 'site', 'package.json'))
  );
  const workspaces = new Set(rootPackage.workspaces ?? []);
  const forbiddenWorkspaces = [
    'apps/mcp-gateway',
    'apps/worker',
    'packages/backend-core',
    'packages/backend-engine'
  ];

  for (const workspace of forbiddenWorkspaces) {
    if (workspaces.has(workspace)) {
      throw new Error(`quality: forbidden hybrid workspace: ${workspace}`);
    }
  }

  const webDependencies = Object.keys({
    ...(webPackage.dependencies ?? {}),
    ...(webPackage.devDependencies ?? {})
  });
  const forbiddenWebDependency = webDependencies.find((dependency) =>
    /^@ashfox\/(?:blockbench-|backend-)|mcp/i.test(dependency)
  );
  if (forbiddenWebDependency) {
    throw new Error(
      `quality: Web Studio cannot depend on ${forbiddenWebDependency}`
    );
  }

  if (!workspaces.has('apps/site')) {
    throw new Error('quality: static public site workspace is missing.');
  }
  const siteDependencies = Object.keys({
    ...(sitePackage.dependencies ?? {}),
    ...(sitePackage.devDependencies ?? {})
  });
  const forbiddenSiteDependency = siteDependencies.find(
    (dependency) => dependency !== 'marked'
  );
  if (forbiddenSiteDependency) {
    throw new Error(
      `quality: static public site cannot depend on ${forbiddenSiteDependency}`
    );
  }
  const siteSourceFiles = walk(
    path.join(repoRoot, 'apps', 'site'),
    (filePath) => /\.(?:js|mjs)$/.test(filePath)
  );
  for (const filePath of siteSourceFiles) {
    const crossesProductBoundary = readModuleSpecifiers(readText(filePath)).some(
      (specifier) => {
        if (
          specifier.startsWith('@ashfox/') ||
          /^(?:react|three)(?:\/|$)/.test(specifier)
        ) {
          return true;
        }
        if (!specifier.startsWith('.')) {
          return false;
        }
        const targetPath = path.resolve(path.dirname(filePath), specifier);
        return [
          path.join(repoRoot, 'apps', 'web'),
          path.join(repoRoot, 'packages', 'engine-core')
        ].some(
          (productRoot) =>
            targetPath === productRoot ||
            targetPath.startsWith(`${productRoot}${path.sep}`)
        );
      }
    );
    if (crossesProductBoundary) {
      throw new Error(
        `quality: static public site crosses the product boundary: ${rel(filePath)}`
      );
    }
  }
};

const main = () => {
  assertRemovedBoundariesStayRemoved();
  assertTrackDependencies();

  const sourceDirs = [
    path.join(repoRoot, 'packages', 'blockbench-runtime', 'src'),
    path.join(repoRoot, 'packages', 'engine-core', 'src'),
    path.join(repoRoot, 'apps', 'web', 'src')
  ];
  const tsFiles = sourceDirs.flatMap((srcDir) =>
    walk(srcDir, (p) => p.endsWith('.ts') || p.endsWith('.tsx'))
  );

  const rules = [
    {
      id: 'ts-ignore',
      pattern: /@ts-ignore|@ts-expect-error/
    },
    {
      id: 'as-any',
      pattern: /\bas any\b/
    },
    {
      id: 'as-unknown-as',
      pattern: /\bas unknown as\b/,
      // No allowlist: remove unsafe double assertions.
    },
    {
      id: 'console-in-src',
      pattern: /\bconsole\.(log|warn|error|info|debug)\(/,
      allow: (filePath) => rel(filePath) === 'packages/blockbench-runtime/src/logging.ts'
    },
    {
      id: 'bare-document',
      // Detect identifier access only (avoid matching strings/types):
      // - document?.foo
      // - document.foo
      // - document[...]
      // - document(...)
      pattern: /(^|[^\w.])document\s*(\.|\?\.|\[|\()/,
      appliesTo: (filePath) => rel(filePath).startsWith('packages/blockbench-runtime/src/')
    },
    {
      id: 'bare-window',
      pattern: /(^|[^\w.])window\s*(\.|\?\.|\[|\()/,
      appliesTo: (filePath) => rel(filePath).startsWith('packages/blockbench-runtime/src/')
    },
    {
      id: 'engine-core-host-dependency',
      pattern: /@ashfox\/blockbench-|@ashfox\/backend-|\bBlockbench\b|\bMCP\b|\/mcp\b|from ['"](?:react|next|three)['"]/,
      appliesTo: (filePath) => rel(filePath).startsWith('packages/engine-core/src/')
    },
    {
      id: 'workbench-blockbench-dependency',
      pattern: /@ashfox\/blockbench-|@ashfox\/backend-|\bBlockbench\b|\bMCP\b|\/mcp\b/,
      appliesTo: (filePath) => rel(filePath).startsWith('apps/web/src/')
    },
    {
      id: 'throw-in-proxy',
      pattern: /\bthrow\b/,
      appliesTo: (filePath) => rel(filePath).startsWith('packages/blockbench-runtime/src/proxy/'),
      // No allowlist: proxy must be throw-free.
    }
    ,
    {
      id: 'proxy-globalThis-document',
      pattern: /\bglobalThis\.document\b/,
      appliesTo: (filePath) => rel(filePath).startsWith('packages/blockbench-runtime/src/proxy/')
    },
    {
      id: 'throw-in-src',
      pattern: /\bthrow\b/,
      appliesTo: (filePath) => rel(filePath).startsWith('packages/blockbench-runtime/src/'),
      // Allow a narrow exception for Blockbench codec compile contract.
      allow: (filePath, line) =>
        rel(filePath) === 'packages/blockbench-runtime/src/plugin/runtime.ts' && line.includes('throw new Error(')
    },
    {
      id: 'todo-fixme-comment',
      pattern: /\/\/\s*(TODO|FIXME)\b|\/\*\s*(TODO|FIXME)\b/,
      appliesTo: (filePath) => rel(filePath).startsWith('packages/blockbench-runtime/src/')
    },
    {
      id: 'catch-without-binding',
      pattern: /catch\s*\{/,
      appliesTo: (filePath) => rel(filePath).startsWith('packages/blockbench-runtime/src/')
    },
    {
      id: 'globalThis-as',
      pattern: /\bglobalThis\s+as\b/,
      appliesTo: (filePath) => rel(filePath).startsWith('packages/blockbench-runtime/src/'),
      allow: (filePath) => {
        const p = rel(filePath);
        return p === 'packages/blockbench-runtime/src/types/blockbench.ts' || p === 'packages/blockbench-runtime/src/shared/globalState.ts';
      }
    }
  ];

  /** @type {Array<{file:string,line:number,rule:string,snippet:string}>} */
  const findings = [];
  for (const filePath of tsFiles) {
    findings.push(...scanFile(filePath, rules));
  }

  if (findings.length > 0) {
    console.error('ashfox quality gate failed. Violations:');
    for (const f of findings) {
      console.error(`- ${f.rule}: ${f.file}:${f.line} :: ${f.snippet}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('ashfox quality gate ok');
};

main();
