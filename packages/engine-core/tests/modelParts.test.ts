import assert from 'node:assert/strict';

import {
  executeCommandBatch,
  createProjectFromInput,
  normalizePartRecipe,
  parseProjectDocument,
  readCompiledParts,
  readPartRecipe,
  validateProjectDocument,
  type CommandBatch,
  type PartSpec,
  type ProjectDocument
} from '../src';

const createEmptyProject = (): ProjectDocument =>
  createProjectFromInput(
    {
      id: 'project-parts',
      name: 'Part compiler',
      target: 'geckolib5',
      namespace: 'ashfox',
      modelPath: 'part_compiler',
      createdAt: '2026-07-30T00:00:00.000Z'
    },
    'revision-parts'
  );

const root: PartSpec = {
  kind: 'plate',
  partId: 'body',
  parentPartId: null,
  materialId: 'gold',
  joint: { kind: 'fixed' },
  attachment: null,
  plane: 'xy',
  origin: [-2, 0, 0],
  outline: [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4]
  ],
  thickness: 4
};

const child: PartSpec = {
  kind: 'mass',
  partId: 'head',
  parentPartId: 'body',
  materialId: 'charcoal',
  joint: { kind: 'hinge', axis: 'x' },
  attachment: {
    parentAnchor: [0, 4, 1],
    partAnchor: [0, 4, 1]
  },
  center: [0, 5, 1],
  radii: [1, 1, 1],
  profile: 'hard'
};

const upsert = (
  parts: readonly PartSpec[]
): CommandBatch['operations'][number] => ({
  name: 'model.parts.upsert',
  payload: {
    parts: parts.map(({ attachment: _attachment, ...part }) => part),
    materials: [
      { id: 'gold', baseColor: '#C58A32' },
      { id: 'charcoal', baseColor: '#252A32' }
    ]
  }
});

const danglingRecipe = normalizePartRecipe(
  [child],
  [{ id: 'charcoal', baseColor: '#252A32' }]
);
assert.equal(danglingRecipe.ok, false);
if (!danglingRecipe.ok) {
  assert.ok(
    danglingRecipe.issues.some(
      (issue) => issue.path.endsWith('.parentPartId')
    )
  );
}

const twoRootRecipe = normalizePartRecipe(
  [
    root,
    {
      ...child,
      parentPartId: null,
      joint: { kind: 'fixed' },
      attachment: null
    }
  ],
  [
    { id: 'gold', baseColor: '#C58A32' },
    { id: 'charcoal', baseColor: '#252A32' }
  ]
);
assert.equal(twoRootRecipe.ok, false);
if (!twoRootRecipe.ok) {
  assert.ok(
    twoRootRecipe.issues.some(
      (issue) => issue.message.includes('exactly one root')
    )
  );
}

const execute = (
  document: ProjectDocument,
  batchId: string,
  operations: CommandBatch['operations'],
  source: 'agent' | 'system' = 'agent'
): ProjectDocument => {
  const result = executeCommandBatch(
    document,
    {
      batchId,
      baseProjectId: document.id,
      baseRevision: document.revision,
      operations
    },
    { source }
  );
  if (!result.ok) {
    throw new Error(
      `${result.error.code}: ${result.error.message} at ` +
      `${result.error.path ?? '-'}`
    );
  }
  return result.document;
};

const ordered = execute(
  createEmptyProject(),
  'parts-ordered',
  [upsert([root, child])]
);
const reversed = execute(
  createEmptyProject(),
  'parts-reversed',
  [upsert([child, root])]
);
assert.deepEqual(
  reversed,
  ordered,
  'Part input order must not change the compiled document'
);

const compiled = readCompiledParts(ordered);
assert.equal(compiled.ok, true);
if (!compiled.ok) throw new Error('Compiled model is invalid');
assert.deepEqual([...compiled.parts.keys()], ['body', 'head']);
assert.equal(compiled.parts.get('body')?.bone.id, 'bone:body');
assert.equal(
  compiled.parts.get('head')?.bone.parentId,
  'bone:body'
);
assert.equal(
  compiled.parts.get('head')?.bone.generation?.joint.kind,
  'hinge'
);
assert.equal(validateProjectDocument(ordered).valid, true);
assert.equal(Object.keys(ordered.textures).length, 1);
assert.ok(
  [...compiled.parts.values()].every((part) =>
    part.cubes.every((cube) =>
      cube.bounds.from.every(
        (value) => Number.isInteger(value)
      ) &&
      cube.bounds.to.every(
        (value) => Number.isInteger(value)
      )
    )
  )
);

const snapBase = createProjectFromInput(
  {
    id: 'project-derived-attachments',
    name: 'Derived attachments',
    target: 'glb',
    namespace: 'ashfox',
    modelPath: 'derived_attachments',
    createdAt: '2026-07-30T00:00:00.000Z'
  },
  'revision-derived-attachments'
);
const snapped = executeCommandBatch(
  snapBase,
  {
    batchId: 'derive-attachment-chain',
    baseProjectId: snapBase.id,
    baseRevision: snapBase.revision,
    operations: [{
      name: 'model.parts.upsert',
      payload: {
        parts: [{
          kind: 'mass',
          partId: 'tip',
          parentPartId: 'middle',
          materialId: 'gold',
          center: [7, 0, 0],
          radii: [1, 1, 1]
        }, {
          kind: 'mass',
          partId: 'root',
          materialId: 'gold',
          center: [0, 0, 0],
          radii: [2, 2, 2]
        }, {
          kind: 'mass',
          partId: 'middle',
          parentPartId: 'root',
          materialId: 'gold',
          center: [5, 0, 0],
          radii: [1, 1, 1]
        }],
        materials: [{ id: 'gold', baseColor: '#C58A32' }]
      }
    }]
  },
  { source: 'agent' }
);
assert.equal(snapped.ok, true);
if (!snapped.ok) {
  throw new Error(snapped.error.message);
}
const snappedRecipe = readPartRecipe(snapped.document);
assert.equal(snappedRecipe.ok, true);
if (!snappedRecipe.ok || snappedRecipe.recipe === null) {
  throw new Error('Derived attachment recipe is unavailable.');
}
const snappedMiddle = snappedRecipe.recipe.parts.find(
  (part) => part.partId === 'middle'
);
const snappedTip = snappedRecipe.recipe.parts.find(
  (part) => part.partId === 'tip'
);
assert.deepEqual(snappedMiddle?.joint, { kind: 'fixed' });
assert.deepEqual(snappedMiddle?.attachment, {
  parentAnchor: [2, 0, 0],
  partAnchor: [4, 0, 0]
});
assert.deepEqual(snappedTip?.attachment, {
  parentAnchor: [4, 0, 0],
  partAnchor: [6, 0, 0]
});

const diagonalSnap = executeCommandBatch(
  snapBase,
  {
    batchId: 'derive-diagonal-attachment',
    baseProjectId: snapBase.id,
    baseRevision: snapBase.revision,
    operations: [{
      name: 'model.parts.upsert',
      payload: {
        parts: [{
          kind: 'mass',
          partId: 'root',
          materialId: 'gold',
          center: [0, 0, 0],
          radii: [2, 2, 2]
        }, {
          kind: 'mass',
          partId: 'diagonal',
          parentPartId: 'root',
          materialId: 'gold',
          center: [3, 4, 0],
          radii: [1, 1, 1]
        }],
        materials: [{ id: 'gold', baseColor: '#C58A32' }]
      }
    }]
  },
  { source: 'agent' }
);
assert.equal(diagonalSnap.ok, true);
if (!diagonalSnap.ok) {
  throw new Error(diagonalSnap.error.message);
}
const diagonalRecipe = readPartRecipe(diagonalSnap.document);
assert.equal(diagonalRecipe.ok, true);
if (!diagonalRecipe.ok || diagonalRecipe.recipe === null) {
  throw new Error('Diagonal attachment recipe is unavailable.');
}
assert.deepEqual(
  diagonalRecipe.recipe.parts.find(
    (part) => part.partId === 'diagonal'
  )?.attachment,
  {
    parentAnchor: [2, 2, 0],
    partAnchor: [3, 3, 0]
  },
  'a child within the two-cell L1 radius must snap diagonally'
);

const snappedCompiled = readCompiledParts(snapped.document);
assert.equal(snappedCompiled.ok, true);
if (!snappedCompiled.ok) {
  throw new Error('Derived attachment projection is invalid.');
}
assert.deepEqual(
  snappedCompiled.parts.get('middle')?.bone.transform.pivot,
  [2, 0, 0]
);
assert.deepEqual(
  snappedCompiled.parts.get('tip')?.bone.transform.pivot,
  [4, 0, 0]
);

const expandedRoot = executeCommandBatch(
  snapped.document,
  {
    batchId: 'rederive-after-parent-edit',
    baseProjectId: snapped.document.id,
    baseRevision: snapped.document.revision,
    operations: [{
      name: 'model.parts.upsert',
      payload: {
        parts: [{
          kind: 'mass',
          partId: 'root',
          materialId: 'gold',
          center: [0, 0, 0],
          radii: [3, 2, 2]
        }],
        materials: []
      }
    }]
  },
  { source: 'agent' }
);
assert.equal(expandedRoot.ok, true);
if (!expandedRoot.ok) {
  throw new Error(expandedRoot.error.message);
}
const expandedRecipe = readPartRecipe(expandedRoot.document);
assert.equal(expandedRecipe.ok, true);
if (!expandedRecipe.ok || expandedRecipe.recipe === null) {
  throw new Error('Rederived attachment recipe is unavailable.');
}
assert.deepEqual(
  expandedRecipe.recipe.parts.find(
    (part) => part.partId === 'middle'
  )?.attachment,
  {
    parentAnchor: [3, 0, 0],
    partAnchor: [5, 0, 0]
  },
  'editing a parent must rederive an unchanged child pivot'
);
assert.deepEqual(
  expandedRecipe.recipe.parts.find(
    (part) => part.partId === 'tip'
  )?.attachment,
  {
    parentAnchor: [4, 0, 0],
    partAnchor: [6, 0, 0]
  },
  'a deeper descendant must remain connected after ancestor rederivation'
);

const reopenedOrdered = parseProjectDocument(
  JSON.parse(JSON.stringify(ordered))
);
assert.deepEqual(reopenedOrdered.modeling, ordered.modeling);
const reopenedEdited = execute(
  reopenedOrdered,
  'parts-reopened-exact-edit',
  [upsert([{
    ...child,
    profile: 'soft'
  }])]
);
assert.equal(reopenedEdited.modeling?.parts.length, 2);
const reopenedHead = reopenedEdited.modeling?.parts.find(
  (part) => part.partId === 'head'
);
assert.equal(reopenedHead?.kind, 'mass');
if (reopenedHead?.kind === 'mass') {
  assert.equal(reopenedHead.profile, 'soft');
}
assert.ok(
  reopenedEdited.modeling?.parts.some(
    (part) => part.partId === 'body'
  )
);

const recipeDrift = structuredClone(ordered);
const driftedHead = recipeDrift.modeling?.parts.find(
  (part) => part.partId === 'head'
);
if (!driftedHead || driftedHead.kind !== 'mass') {
  throw new Error('Drift fixture head recipe is unavailable.');
}
driftedHead.center = [
  driftedHead.center[0] + 1,
  driftedHead.center[1],
  driftedHead.center[2]
];
assert.ok(
  validateProjectDocument(recipeDrift).findings.some(
    (finding) => finding.code === 'model.part_projection'
  )
);

const missingRecipe = structuredClone(ordered);
delete missingRecipe.modeling;
assert.ok(
  validateProjectDocument(missingRecipe).findings.some(
    (finding) => finding.code === 'model.part_projection'
  )
);
assert.throws(
  () => parseProjectDocument(recipeDrift),
  'reopen must reject structural projection drift'
);
assert.throws(
  () => parseProjectDocument(missingRecipe),
  'reopen must reject generated geometry without its recipe'
);

const staleSurfaceCache = structuredClone(ordered);
const staleSurfaceCube = Object.values(
  staleSurfaceCache.scene.nodes
).find(
  (node) =>
    node.kind === 'cube' &&
    node.generation?.authority === 'ashfox.part-compiler'
);
if (!staleSurfaceCube || staleSurfaceCube.kind !== 'cube') {
  throw new Error('Generated surface cache fixture is unavailable.');
}
staleSurfaceCube.faces.north.rotation = 90;
const staleSurfaceReport = validateProjectDocument(staleSurfaceCache);
assert.equal(staleSurfaceReport.valid, true);
assert.ok(
  staleSurfaceReport.findings.some(
    (finding) => finding.code === 'texture.recipe_stale'
  )
);
const repairedSurfaceCache = parseProjectDocument(staleSurfaceCache);
const repairedSurfaceCube =
  repairedSurfaceCache.scene.nodes[staleSurfaceCube.id];
assert.equal(repairedSurfaceCube.kind, 'cube');
if (repairedSurfaceCube.kind === 'cube') {
  assert.equal(repairedSurfaceCube.faces.north.rotation, 0);
}

const repeated = executeCommandBatch(
  ordered,
  {
    batchId: 'parts-repeat-identical',
    baseProjectId: ordered.id,
    baseRevision: ordered.revision,
    operations: [upsert([child, root])]
  },
  { source: 'agent' }
);
assert.equal(repeated.ok, false);
if (!repeated.ok) {
  assert.equal(repeated.error.code, 'no_change');
}

const profileProjections: unknown[] = [];
const persistedProfiles: string[] = [];
for (const profile of ['soft', 'balanced', 'hard'] as const) {
  const profilePart: PartSpec = {
    kind: 'mass',
    partId: 'profile-mass',
    parentPartId: null,
    materialId: 'gold',
    joint: { kind: 'fixed' },
    attachment: null,
    center: [0, 0, 0],
    radii: [1, 1, 1],
    profile
  };
  const profileDocument = execute(
    createEmptyProject(),
    `profile-${profile}`,
    [upsert([profilePart])]
  );
  const profileParts = readCompiledParts(profileDocument);
  assert.equal(profileParts.ok, true);
  if (!profileParts.ok) {
    throw new Error(`${profile} projection is invalid`);
  }
  const projectedPart = profileParts.parts.get('profile-mass');
  assert.ok(projectedPart);
  profileProjections.push({
    bone: {
      id: projectedPart.bone.id,
      parentId: projectedPart.bone.parentId,
      transform: projectedPart.bone.transform,
      generation: projectedPart.bone.generation
    },
    cubes: projectedPart.cubes.map((cube) => ({
      id: cube.id,
      parentId: cube.parentId,
      bounds: cube.bounds,
      transform: cube.transform,
      generation: cube.generation
    }))
  });

  const reopened = JSON.parse(
    JSON.stringify(profileDocument)
  ) as ProjectDocument;
  const recipe = readPartRecipe(reopened);
  assert.equal(recipe.ok, true);
  if (!recipe.ok || recipe.recipe === null) {
    throw new Error(`${profile} recipe did not persist`);
  }
  const persistedPart = recipe.recipe.parts[0];
  assert.equal(persistedPart?.kind, 'mass');
  if (persistedPart?.kind !== 'mass') {
    throw new Error(`${profile} recipe changed primitive`);
  }
  persistedProfiles.push(persistedPart.profile);
}
assert.deepEqual(profileProjections[1], profileProjections[0]);
assert.deepEqual(profileProjections[2], profileProjections[0]);
assert.deepEqual(persistedProfiles, ['soft', 'balanced', 'hard']);

for (const density of [1, 2, 4] as const) {
  const densityProject =
    density === 1
      ? createEmptyProject()
      : execute(
          createEmptyProject(),
          `density-${density}`,
          [{
            name: 'textures.density.set',
            payload: { density }
          }]
        );
  const densityModel = execute(
    densityProject,
    `parts-density-${density}`,
    [upsert([root, child])]
  );
  const densityParts = readCompiledParts(densityModel);
  assert.equal(densityParts.ok, true);
  if (!densityParts.ok) {
    throw new Error(`Density ${density} model is invalid`);
  }
  for (const part of densityParts.parts.values()) {
    for (const cube of part.cubes) {
      for (const coordinate of [
        ...cube.bounds.from,
        ...cube.bounds.to,
        ...cube.transform.pivot
      ]) {
        assert.equal(
          Number.isInteger(coordinate * density),
          true,
          `density ${density} must keep every generated coordinate on 1/d`
        );
      }
    }
  }
}

const rawAgentProject = createEmptyProject();
const rawAgent = executeCommandBatch(
  rawAgentProject,
  {
    batchId: 'raw-agent-rejected',
    baseProjectId: rawAgentProject.id,
    baseRevision: 'revision-parts',
    operations: [{
      name: 'scene.cubes.create',
      payload: {
        cubes: [{
          id: 'cube-raw',
          name: 'raw',
          parentId: null,
          bounds: {
            from: [0, 0, 0],
            to: [1, 1, 1]
          }
        }]
      }
    }]
  },
  { source: 'agent' }
);
assert.equal(rawAgent.ok, false);
if (!rawAgent.ok) {
  assert.equal(rawAgent.error.code, 'invalid_payload');
}

const generatedCubeId =
  compiled.parts.get('body')?.cubes[0]?.id ?? '';
const beforeRawEdit = JSON.stringify(ordered);
const rawGeneratedEdit = executeCommandBatch(
  ordered,
  {
    batchId: 'raw-generated-edit',
    baseProjectId: ordered.id,
    baseRevision: ordered.revision,
    operations: [{
      name: 'scene.nodes.transform',
      payload: {
        nodeIds: [generatedCubeId],
        transform: {
          position: [1, 0, 0]
        }
      }
    }]
  },
  { source: 'system' }
);
assert.equal(rawGeneratedEdit.ok, false);
if (!rawGeneratedEdit.ok) {
  assert.equal(rawGeneratedEdit.error.code, 'invalid_state');
}
assert.equal(JSON.stringify(ordered), beforeRawEdit);

const recolored = execute(
  ordered,
  'parts-material',
  [{
    name: 'model.parts.material',
    payload: {
      partIds: ['head'],
      materialId: 'eyes',
      baseColor: '#4AC7D9'
    }
  }]
);
const recoloredParts = readCompiledParts(recolored);
assert.equal(recoloredParts.ok, true);
if (!recoloredParts.ok) throw new Error('Recolored model is invalid');
assert.equal(recoloredParts.parts.get('head')?.materialId, 'eyes');
assert.ok(
  recoloredParts.parts.get('head')?.cubes.every(
    (cube) => cube.baseColor === '#4AC7D9'
  )
);

const detached: PartSpec = {
  ...child,
  partId: 'detached',
  center: [40, 40, 40]
};
const rejectedDetached = executeCommandBatch(
  ordered,
  {
    batchId: 'parts-detached',
    baseProjectId: ordered.id,
    baseRevision: ordered.revision,
    operations: [upsert([detached])]
  },
  { source: 'agent' }
);
assert.equal(rejectedDetached.ok, false);
if (!rejectedDetached.ok) {
  assert.equal(rejectedDetached.error.code, 'invalid_state');
}
assert.equal(JSON.stringify(ordered), beforeRawEdit);
assert.equal(ordered.scene.nodes['bone:detached'], undefined);

const deleted = execute(
  recolored,
  'parts-delete',
  [{
    name: 'model.parts.delete',
    payload: {
      partIds: ['body']
    }
  }]
);
const afterDelete = readCompiledParts(deleted);
assert.equal(afterDelete.ok, true);
if (!afterDelete.ok) throw new Error('Deleted model state is invalid');
assert.equal(afterDelete.parts.size, 0);
assert.equal(deleted.scene.nodes['bone:body'], undefined);
assert.equal(deleted.scene.nodes['bone:head'], undefined);
