const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const webOutput = path.join(repoRoot, 'apps', 'web', 'dist');
const siteOutput = path.join(repoRoot, 'apps', 'site', 'dist');
const publicOutput = path.join(repoRoot, 'dist', 'public');

const requireFile = (target) => {
  if (!fs.statSync(target, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Missing public build input: ${target}`);
  }
};

const copyDirectoryContents = (source, destination) => {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    fs.cpSync(
      path.join(source, entry.name),
      path.join(destination, entry.name),
      { recursive: true, force: true }
    );
  }
};

const removeSourceMaps = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      removeSourceMaps(target);
      continue;
    }
    if (entry.name.endsWith('.map')) fs.rmSync(target);
  }
};

requireFile(path.join(webOutput, 'index.html'));
requireFile(path.join(webOutput, 'agent-manifest.json'));
requireFile(path.join(siteOutput, 'home', 'index.html'));
requireFile(path.join(siteOutput, 'docs', 'index.html'));

fs.rmSync(publicOutput, { recursive: true, force: true });
fs.mkdirSync(publicOutput, { recursive: true });

copyDirectoryContents(webOutput, publicOutput);
copyDirectoryContents(siteOutput, publicOutput);
removeSourceMaps(publicOutput);

fs.copyFileSync(
  path.join(webOutput, 'index.html'),
  path.join(publicOutput, '404.html')
);
fs.writeFileSync(
  path.join(publicOutput, '_redirects'),
  [
    '/home /home/ 301',
    '/docs /docs/ 301',
    ''
  ].join('\n')
);
fs.writeFileSync(
  path.join(publicOutput, '_headers'),
  `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()

/index.html
  Cache-Control: public, max-age=0, must-revalidate

/home/*
  Cache-Control: public, max-age=0, must-revalidate

/docs/*
  Cache-Control: public, max-age=0, must-revalidate

/agent-manifest.json
  Cache-Control: public, max-age=0, must-revalidate

/assets/app.*
  Cache-Control: public, max-age=0, must-revalidate

/assets/site-*
  Cache-Control: public, max-age=31536000, immutable

/media/*
  Cache-Control: public, max-age=604800
`
);

console.log(`ashfox public bundle ready: ${publicOutput}`);
