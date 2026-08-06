process.env.DISABLE_V8_COMPILE_CACHE =
  process.env.DISABLE_V8_COMPILE_CACHE || '1';

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

const {
  executeSystemCommandBatch,
  exportProductionProjectResolved,
  readPartRecipe,
  validateProjectDocument
} = require('@ashfox/engine-core');
const {
  reprojectPartRecipe
} = require('../packages/engine-core/src/commands/definitions/reprojectPartRecipe');
const {
  deriveGeneratedTextures
} = require('../packages/engine-core/src/textures/textureRecipe');
const {
  createStoredZip,
  readStoredZip
} = require('../apps/web/src/features/files/zip');

const repositoryRoot = path.resolve(__dirname, '..');
const galleryRoot = path.join(repositoryRoot, 'examples', 'gallery');
const writeChanges = process.argv.includes('--write');
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const requiredEntry = (entries, entryPath) => {
  const entry = entries.find((candidate) => candidate.path === entryPath);
  if (!entry) throw new Error(`Missing archive entry "${entryPath}".`);
  return entry;
};

const glbProject = (document, demoId) => {
  if (
    document.formatProfile.id === 'gltf.2' &&
    document.formatProfile.container === 'glb'
  ) return document;
  const result = executeSystemCommandBatch(document, {
    batchId: `gallery-${demoId}-iconic-metrics`,
    baseProjectId: document.id,
    baseRevision: document.revision,
    operations: [{
      name: 'project.target.set',
      payload: { target: 'glb' }
    }]
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.document;
};

const glbMetrics = (bytes) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  const gltf = JSON.parse(
    decoder.decode(bytes.subarray(20, 20 + jsonLength)).trimEnd()
  );
  const primitives = (gltf.meshes || []).flatMap((mesh) => mesh.primitives);
  return {
    glbPrimitives: primitives.length,
    triangles: primitives.reduce(
      (count, primitive) =>
        count + Math.floor((gltf.accessors[primitive.indices]?.count || 0) / 3),
      0
    )
  };
};

const updateMetric = (source, key, value) => {
  const pattern = new RegExp(`("${key}":\\s*)\\d+`);
  if (!pattern.test(source)) {
    throw new Error(`demo.json has no numeric metric "${key}".`);
  }
  return source.replace(pattern, `$1${value}`);
};

const iconicRecipeDocument = (document) => {
  if (!document.modeling || !Array.isArray(document.modeling.parts)) {
    return document;
  }
  return {
    ...document,
    modeling: {
      ...document.modeling,
      parts: document.modeling.parts.map((part) => {
        if (part.kind !== 'feature' || part.motif !== 'eye') return part;
        return {
          ...part,
          size: [
            Math.min(part.size[0], 6),
            Math.min(part.size[1], 5)
          ]
        };
      })
    }
  };
};

const recompileDemo = async (demoId) => {
  const demoRoot = path.join(galleryRoot, demoId);
  const demoPath = path.join(demoRoot, 'demo.json');
  const demoSource = fs.readFileSync(demoPath, 'utf8');
  const demo = JSON.parse(demoSource);
  const archivePath = path.join(demoRoot, demo.project);
  const entries = readStoredZip(new Uint8Array(fs.readFileSync(archivePath)));
  const manifest = JSON.parse(
    decoder.decode(requiredEntry(entries, 'manifest.json').bytes)
  );
  const rawDocument = iconicRecipeDocument(JSON.parse(
    decoder.decode(requiredEntry(entries, manifest.project).bytes)
  ));
  const recipeResult = readPartRecipe(rawDocument);
  if (!recipeResult.ok) {
    throw new Error(`${demoId} has no readable semantic part recipe.`);
  }
  let projectedDocument = rawDocument;
  if (recipeResult.recipe) {
    const projection = reprojectPartRecipe(rawDocument, recipeResult.recipe);
    if (!projection.ok) {
      throw new Error(
        `${demoId} projection failed at ${projection.failure.path}: ` +
        projection.failure.message
      );
    }
    projectedDocument = projection.document;
  }
  const derived = deriveGeneratedTextures(projectedDocument);
  if (!derived.ok) {
    throw new Error(`${demoId} texture derivation failed: ${derived.message}`);
  }
  const validation = validateProjectDocument(derived.document);
  if (!validation.valid) {
    const summary = validation.findings
      .filter((finding) => finding.severity === 'error')
      .map((finding) => `${finding.path}: ${finding.message}`)
      .join('; ');
    throw new Error(`${demoId} projected document is invalid: ${summary}`);
  }

  const projectBytes = encoder.encode(
    `${JSON.stringify(derived.document, null, 2)}\n`
  );
  const nextEntries = entries.map((entry) =>
    entry.path === manifest.project
      ? { ...entry, bytes: projectBytes }
      : entry
  );
  const assetsByTextureId = new Map(
    manifest.assets.map((asset) => [
      asset.textureId,
      requiredEntry(entries, asset.path).bytes
    ])
  );
  const exportDocument = glbProject(derived.document, demoId);
  const bundle = await exportProductionProjectResolved(exportDocument, {
    resolveBlob: async (source) => {
      const texture = Object.values(exportDocument.textures).find((entry) =>
        entry.source.bucket === source.bucket &&
        entry.source.key === source.key
      );
      if (!texture) return null;
      const bytes = assetsByTextureId.get(texture.id);
      return bytes
        ? { contentType: texture.source.contentType, bytes }
        : null;
    }
  });
  const model = bundle.files.find((file) => file.kind === 'binary');
  if (!model || model.kind !== 'binary') {
    throw new Error(`${demoId} did not export a GLB binary.`);
  }

  const nodes = Object.values(derived.document.scene.nodes);
  const metrics = {
    bones: nodes.filter((node) => node.kind === 'bone').length,
    cubes: nodes.filter((node) => node.kind === 'cube').length,
    animations: Object.keys(derived.document.animations).length,
    ...glbMetrics(model.data),
    semanticEyes: (recipeResult.recipe?.parts ?? []).filter(
      (part) => part.kind === 'feature' && part.motif === 'eye'
    ).length
  };
  let nextDemoSource = demoSource;
  for (const [key, value] of Object.entries(metrics)) {
    nextDemoSource = updateMetric(nextDemoSource, key, value);
  }

  if (writeChanges) {
    fs.writeFileSync(archivePath, createStoredZip(nextEntries));
    fs.writeFileSync(demoPath, nextDemoSource);
  }
  return metrics;
};

void (async () => {
  const demoIds = fs.readdirSync(galleryRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  for (const demoId of demoIds) {
    const metrics = await recompileDemo(demoId);
    console.log(`${writeChanges ? 'Recompiled' : 'Checked'} ${demoId}:`, metrics);
  }
  if (!writeChanges) {
    console.log('Dry run only. Pass --write to update gallery archives.');
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
