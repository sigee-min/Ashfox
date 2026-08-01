import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  readPartRecipe
} from '@ashfox/engine-core';

import {
  readProjectArchive
} from '../src/features/files/projectArchive';

const repositoryRoot = path.resolve(__dirname, '../../..');
const galleryRoot = path.join(repositoryRoot, 'examples', 'gallery');

export const test = (async (): Promise<void> => {
  const directories = (await readdir(galleryRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  assert.ok(directories.length > 0, 'gallery must contain demo folders');

  for (const directory of directories) {
    const demoRoot = path.join(galleryRoot, directory);
    const manifest = JSON.parse(
      await readFile(path.join(demoRoot, 'demo.json'), 'utf8')
    ) as {
      id: string;
      name: string;
      project: string;
      metrics: {
        bones: number;
        cubes: number;
        animations: number;
        semanticEyes: number;
      };
    };
    assert.equal(manifest.id, directory);
    const bytes = new Uint8Array(
      await readFile(path.join(demoRoot, manifest.project))
    );
    const archive = await readProjectArchive(bytes);
    const nodes = Object.values(archive.document.scene.nodes);
    assert.ok(
      archive.document.name.trim().length > 0,
      `${manifest.id} project name must not be empty`
    );
    assert.equal(
      nodes.filter((node) => node.kind === 'bone').length,
      manifest.metrics.bones,
      `${manifest.id} bone count must match its manifest`
    );
    assert.equal(
      nodes.filter((node) => node.kind === 'cube').length,
      manifest.metrics.cubes,
      `${manifest.id} cube count must match its manifest`
    );
    assert.equal(
      Object.keys(archive.document.animations).length,
      manifest.metrics.animations,
      `${manifest.id} animation count must match its manifest`
    );
    const recipe = readPartRecipe(archive.document);
    assert.equal(recipe.ok, true, `${manifest.id} part recipe must be readable`);
    assert.equal(
      recipe.ok && recipe.recipe
        ? recipe.recipe.parts.filter(
            (part) => part.kind === 'feature' && part.motif === 'eye'
          ).length
        : 0,
      manifest.metrics.semanticEyes,
      `${manifest.id} semantic eye count must match its manifest`
    );
  }
})();
