const fs = require('node:fs');
const path = require('node:path');
const { register } = require('ts-node');

register({
  transpileOnly: true,
  compilerOptions: {
    module: 'CommonJS',
    moduleResolution: 'Node'
  }
});

const { parseProjectDocument } = require('@ashfox/engine-core');
const {
  createProjectArchive,
  readProjectArchive
} = require('../src/features/files/projectArchive');

const usage = () => {
  throw new Error(
    'Usage: node scripts/packageProject.js <project.json> <output.ashfox> ' +
    '<texture-id=asset-path>...'
  );
};

const [projectPath, outputPath, ...assetArguments] =
  process.argv.slice(2);
if (
  !projectPath ||
  !outputPath ||
  !outputPath.toLowerCase().endsWith('.ashfox')
) {
  usage();
}

const assetPaths = new Map(
  assetArguments.map((argument) => {
    const separator = argument.indexOf('=');
    if (separator <= 0 || separator === argument.length - 1) usage();
    return [
      argument.slice(0, separator),
      argument.slice(separator + 1)
    ];
  })
);

const document = parseProjectDocument(
  JSON.parse(fs.readFileSync(projectPath, 'utf8'))
);

void createProjectArchive(document, async (texture) => {
  const assetPath = assetPaths.get(texture.id);
  if (!assetPath) {
    throw new Error(`Missing asset path for texture "${texture.id}".`);
  }
  return {
    contentType: texture.source.contentType,
    bytes: new Uint8Array(fs.readFileSync(assetPath))
  };
}).then(async (bytes) => {
  await readProjectArchive(bytes);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, bytes);
  console.log(`Wrote ${outputPath} (${bytes.length} bytes)`);
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
