import {
  readdir,
  readFile,
  stat
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));

export const gallerySourceRoot = path.resolve(
  sourceDirectory,
  '../../..',
  'examples',
  'gallery'
);

const isRecord = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requiredString = (value, label) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
};

const requiredPositiveInteger = (value, label) => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return value;
};

const localFileName = (value, label) => {
  const fileName = requiredString(value, label);
  if (
    path.basename(fileName) !== fileName ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(fileName)
  ) {
    throw new Error(`${label} must name a file in the demo folder.`);
  }
  return fileName;
};

const assertFile = async (demoRoot, fileName, label) => {
  const target = path.join(demoRoot, fileName);
  try {
    if (!(await stat(target)).isFile()) throw new Error();
  } catch {
    throw new Error(`${label} is missing: ${target}`);
  }
};

const publicFile = (id, fileName) =>
  `/demos/${encodeURIComponent(id)}/${encodeURIComponent(fileName)}`;

const loadDemo = async (directoryName) => {
  const demoRoot = path.join(gallerySourceRoot, directoryName);
  const manifestPath = path.join(demoRoot, 'demo.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Cannot read gallery manifest ${manifestPath}: ${error.message}`
    );
  }
  if (!isRecord(manifest) || manifest.schemaVersion !== 1) {
    throw new Error(`${manifestPath} must use gallery schemaVersion 1.`);
  }

  const id = requiredString(manifest.id, `${manifestPath} id`);
  const featured = manifest.featured === true;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || id !== directoryName) {
    throw new Error(
      `${manifestPath} id must be a lowercase slug matching its folder.`
    );
  }
  if (!Array.isArray(manifest.tags) || manifest.tags.length === 0) {
    throw new Error(`${manifestPath} tags must be a non-empty array.`);
  }
  const tags = manifest.tags.map((tag, index) =>
    requiredString(tag, `${manifestPath} tags[${index}]`)
  );
  if (new Set(tags.map((tag) => tag.toLocaleLowerCase())).size !== tags.length) {
    throw new Error(`${manifestPath} tags must be unique.`);
  }
  if (!isRecord(manifest.metrics)) {
    throw new Error(`${manifestPath} metrics must be an object.`);
  }
  if (!isRecord(manifest.media) || !isRecord(manifest.media.animation)) {
    throw new Error(`${manifestPath} media.animation must be an object.`);
  }
  if (!isRecord(manifest.agent)) {
    throw new Error(`${manifestPath} agent must be an object.`);
  }

  const files = {
    project: localFileName(manifest.project, `${manifestPath} project`),
    poster: localFileName(manifest.media.poster, `${manifestPath} media.poster`),
    buildGif: !isRecord(manifest.media.build)
      ? null
      : localFileName(
          manifest.media.build.gif,
          `${manifestPath} media.build.gif`
        ),
    buildVideo:
      !isRecord(manifest.media.build) ||
      manifest.media.build.video === undefined
        ? null
        : localFileName(
            manifest.media.build.video,
            `${manifestPath} media.build.video`
          ),
    animationGif: localFileName(
      manifest.media.animation.gif,
      `${manifestPath} media.animation.gif`
    ),
    animationVideo: manifest.media.animation.video === undefined
      ? null
      : localFileName(
          manifest.media.animation.video,
          `${manifestPath} media.animation.video`
        )
  };
  await Promise.all(
    Object.entries(files)
      .filter(([, fileName]) => fileName !== null)
      .map(([key, fileName]) =>
        assertFile(demoRoot, fileName, `${manifestPath} ${key}`)
      )
  );
  const metrics = {
    bones: requiredPositiveInteger(
      manifest.metrics.bones,
      `${manifestPath} metrics.bones`
    ),
    cubes: requiredPositiveInteger(
      manifest.metrics.cubes,
      `${manifestPath} metrics.cubes`
    ),
    animations: requiredPositiveInteger(
      manifest.metrics.animations,
      `${manifestPath} metrics.animations`
    ),
    triangles: requiredPositiveInteger(
      manifest.metrics.triangles,
      `${manifestPath} metrics.triangles`
    ),
    glbPrimitives: requiredPositiveInteger(
      manifest.metrics.glbPrimitives,
      `${manifestPath} metrics.glbPrimitives`
    ),
    semanticEyes: requiredPositiveInteger(
      manifest.metrics.semanticEyes,
      `${manifestPath} metrics.semanticEyes`
    )
  };
  const detail = [
    `${metrics.bones} bones`,
    `${metrics.cubes} cubes`,
    `${metrics.triangles.toLocaleString('en-US')} tris`,
    `${metrics.glbPrimitives} GLB ${metrics.glbPrimitives === 1 ? 'primitive' : 'primitives'}`,
    ...(metrics.semanticEyes > 0
      ? [`${metrics.semanticEyes} semantic ${metrics.semanticEyes === 1 ? 'eye' : 'eyes'}`]
      : [])
  ].join(' · ');

  return {
    schemaVersion: 1,
    id,
    name: requiredString(manifest.name, `${manifestPath} name`),
    category: requiredString(manifest.category, `${manifestPath} category`),
    tags,
    featured,
    order: requiredPositiveInteger(manifest.order, `${manifestPath} order`),
    prompt: requiredString(manifest.prompt, `${manifestPath} prompt`),
    description: requiredString(
      manifest.description,
      `${manifestPath} description`
    ),
    detail,
    metrics,
    manifest: publicFile(id, 'demo.json'),
    project: publicFile(id, files.project),
    workbench: `/workbench/?project=${encodeURIComponent(publicFile(id, files.project))}`,
    poster: publicFile(id, files.poster),
    ...(files.buildGif && isRecord(manifest.media.build)
      ? {
          build: {
            gif: publicFile(id, files.buildGif),
            ...(files.buildVideo
              ? { video: publicFile(id, files.buildVideo) }
              : {}),
            alt: requiredString(
              manifest.media.build.alt,
              `${manifestPath} media.build.alt`
            )
          }
        }
      : {}),
    animation: {
      gif: publicFile(id, files.animationGif),
      ...(files.animationVideo
        ? { video: publicFile(id, files.animationVideo) }
        : {}),
      alt: requiredString(
        manifest.media.animation.alt,
        `${manifestPath} media.animation.alt`
      )
    },
    agent: {
      model: requiredString(manifest.agent.model, `${manifestPath} agent.model`),
      reasoning: requiredString(
        manifest.agent.reasoning,
        `${manifestPath} agent.reasoning`
      )
    }
  };
};

const loadShowcaseCatalog = async () => {
  const directories = (await readdir(gallerySourceRoot, {
    withFileTypes: true
  }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name);
  const catalog = await Promise.all(directories.map(loadDemo));
  const ids = new Set(catalog.map((item) => item.id));
  const orders = new Set(catalog.map((item) => item.order));
  if (ids.size !== catalog.length) {
    throw new Error('Gallery demo ids must be unique.');
  }
  if (orders.size !== catalog.length) {
    throw new Error('Gallery demo order values must be unique.');
  }
  return catalog.sort(
    (left, right) => left.order - right.order || left.name.localeCompare(right.name)
  );
};

export const showcaseCatalog = await loadShowcaseCatalog();
