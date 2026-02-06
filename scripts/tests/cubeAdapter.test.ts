import assert from 'node:assert/strict';

import { BlockbenchCubeAdapter } from '../../src/adapters/blockbench/geometry/CubeAdapter';
import { noopLog } from './helpers';

const withGlobals = (overrides: Record<string, unknown>, fn: () => void) => {
  const globals = globalThis as Record<string, unknown>;
  const previous = Object.entries(overrides).map(([key, value]) => ({
    key,
    exists: Object.prototype.hasOwnProperty.call(globals, key),
    value: globals[key],
    next: value
  }));
  for (const entry of previous) {
    if (entry.next === undefined) delete globals[entry.key];
    else globals[entry.key] = entry.next;
  }
  try {
    fn();
  } finally {
    for (const entry of previous) {
      if (entry.exists) globals[entry.key] = entry.value;
      else delete globals[entry.key];
    }
  }
};

class FakeCube {
  name?: string;
  from?: [number, number, number] | { x?: number; y?: number; z?: number; set?: (...args: number[]) => void };
  to?: [number, number, number];
  origin?: [number, number, number];
  rotation?: [number, number, number];
  uv_offset?: [number, number];
  box_uv?: boolean;
  visibility?: boolean;
  visible?: boolean;
  bbmcpId?: string;

  constructor(options: Record<string, unknown>) {
    Object.assign(this, options);
  }

  init() {
    return this;
  }
}

// addCube should create a cube and attach it to the outliner root.
{
  const adapter = new BlockbenchCubeAdapter(noopLog);
  const outliner = { root: [] as unknown[] };
  withGlobals(
    {
      Cube: FakeCube,
      Outliner: outliner,
      Group: undefined,
      Undo: undefined,
      Blockbench: undefined
    },
    () => {
      const err = adapter.addCube({
        id: 'cube-1',
        name: 'body_main',
        from: [-4, 6, -7],
        to: [4, 14, 7],
        uvOffset: [0, 0],
        visibility: false
      });
      assert.equal(err, null);
    }
  );
  assert.equal(outliner.root.length, 1);
  const cube = outliner.root[0] as FakeCube;
  assert.equal(cube.name, 'body_main');
  assert.deepEqual(cube.from, [-4, 6, -7]);
  assert.deepEqual(cube.to, [4, 14, 7]);
  assert.equal(cube.bbmcpId, 'cube-1');
}

// updateCube should fail fast when applied vectors differ from requested values.
{
  const adapter = new BlockbenchCubeAdapter(noopLog);
  const problematicCube = {
    name: 'body_main',
    from: {
      set: (_x: number, _y: number, _z: number) => undefined
    },
    to: [4, 14, 7]
  };
  const outliner = { root: [problematicCube] };
  withGlobals(
    {
      Cube: FakeCube,
      Outliner: outliner,
      Group: undefined,
      Undo: undefined,
      Blockbench: undefined
    },
    () => {
      const err = adapter.updateCube({
        name: 'body_main',
        from: [-4, 6, -7]
      });
      assert.notEqual(err, null);
      assert.equal(err?.code, 'invalid_state');
      assert.equal(err?.details?.reason, 'cube_vector_mismatch');
      assert.equal(err?.details?.field, 'from');
    }
  );
}

// updateCube should validate missing target bones before moving outliner nodes.
{
  const adapter = new BlockbenchCubeAdapter(noopLog);
  const cube = {
    name: 'body_main',
    from: [-4, 6, -7],
    to: [4, 14, 7]
  };
  const outliner = { root: [cube] };
  withGlobals(
    {
      Cube: FakeCube,
      Outliner: outliner,
      Group: undefined,
      Undo: undefined,
      Blockbench: undefined
    },
    () => {
      const err = adapter.updateCube({
        name: 'body_main',
        bone: 'missing_bone'
      });
      assert.notEqual(err, null);
      assert.equal(err?.code, 'invalid_payload');
    }
  );
}

// deleteCube should remove the cube from outliner root.
{
  const adapter = new BlockbenchCubeAdapter(noopLog);
  const cube = {
    name: 'body_main',
    from: [-4, 6, -7],
    to: [4, 14, 7]
  };
  const outliner = { root: [cube] };
  withGlobals(
    {
      Cube: FakeCube,
      Outliner: outliner,
      Group: undefined,
      Undo: undefined,
      Blockbench: undefined
    },
    () => {
      const err = adapter.deleteCube({ name: 'body_main' });
      assert.equal(err, null);
    }
  );
  assert.equal(outliner.root.length, 0);
}

