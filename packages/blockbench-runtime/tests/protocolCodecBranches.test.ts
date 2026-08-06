import assert from 'node:assert/strict';

import { createLineDecoder, encodeMessage } from '../src/transport/codec';
import {
  isSidecarMessage,
  normalizeSidecarMessage
} from '../src/transport/protocol';

{
  const encoded = encodeMessage({ type: 'ready', version: 1, ts: 1 });
  assert.equal(encoded.endsWith('\n'), true);
  assert.equal(encoded.includes('"type":"ready"'), true);
}

{
  assert.equal(isSidecarMessage(null), false);
  assert.equal(isSidecarMessage({ type: 'hello', version: 1, role: 'plugin', ts: 1 }), true);
  assert.equal(isSidecarMessage({ type: 'hello', version: 2, role: 'plugin', ts: 1 }), false);
  assert.equal(isSidecarMessage({ type: 'hello', version: 1, role: 'invalid', ts: 1 }), false);
  assert.equal(isSidecarMessage({ type: 'ready', version: 2, ts: 1 }), false);
  assert.equal(isSidecarMessage({ type: 'ready', version: Number.NaN, ts: 1 }), false);
  assert.equal(isSidecarMessage({ type: 'request', id: '', tool: 'list_capabilities', ts: 1 }), false);
  assert.equal(isSidecarMessage({ type: 'request', id: 'r1', tool: 'list_capabilities', ts: 1 }), false);
  assert.equal(
    isSidecarMessage({
      type: 'request',
      id: 'r1',
      tool: 'list_capabilities',
      payload: {},
      ts: 1
    }),
    true
  );
  assert.equal(
    isSidecarMessage({
      type: 'request',
      id: 'r1',
      tool: 'not_a_tool',
      payload: {},
      ts: 1
    }),
    false
  );
  for (const payload of [
    {
      clip: 'walk',
      channel: 'sound',
      keys: [{ time: 0, value: 123 }]
    },
    {
      target: {},
      op: { op: 'set_pixel', x: 0, y: 0, color: '#ffffff' }
    },
    {
      target: { cubeName: 'body' },
      op: { op: 'fill_rect' }
    }
  ]) {
    assert.equal(isSidecarMessage({
      type: 'request',
      id: 'schema-domain-gap',
      tool: 'clip' in payload ? 'set_trigger_keyframes' : 'paint_faces',
      payload,
      ts: 1
    }), false);
  }
  for (const op of [
    { op: 'set_pixel', x: 0, y: 0, color: '#ffffff' },
    {
      op: 'fill_rect',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      color: '#ffffffff'
    },
    {
      op: 'draw_rect',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      color: '#ffffff'
    },
    {
      op: 'draw_line',
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 1,
      color: '#ffffffff'
    }
  ]) {
    assert.equal(isSidecarMessage({
      type: 'request',
      id: 'valid-texture-op',
      tool: 'paint_faces',
      payload: { target: { cubeName: 'body' }, op },
      ts: 1
    }), true, op.op);
  }
  for (const op of [
    { op: 'set_pixel', x: 0, y: 0, color: '#ffffff', shade: false },
    {
      op: 'fill_rect',
      x: 0,
      y: 0,
      width: -1,
      height: 1,
      color: '#ffffff'
    },
    {
      op: 'draw_line',
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 1,
      color: '#ffffff',
      lineWidth: -99
    },
    {
      op: 'fill_rect',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      color: '#ffffff',
      shade: { intensity: 2 }
    },
    {
      op: 'fill_rect',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      color: '#ffffff',
      shade: { edge: -0.1 }
    },
    {
      op: 'fill_rect',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      color: '#ffffff',
      shade: { noise: 1.1 }
    }
  ]) {
    assert.equal(isSidecarMessage({
      type: 'request',
      id: 'invalid-texture-op',
      tool: 'paint_faces',
      payload: { target: { cubeName: 'body' }, op },
      ts: 1
    }), false, op.op);
  }
  for (const color of ['', '#fff', '#xyz', 'ffffff']) {
    assert.equal(isSidecarMessage({
      type: 'request',
      id: 'invalid-texture-color',
      tool: 'paint_faces',
      payload: {
        target: { cubeName: 'body' },
        op: { op: 'set_pixel', x: 0, y: 0, color }
      },
      ts: 1
    }), false, color);
  }
  assert.equal(
    isSidecarMessage({
      type: 'request',
      id: 'r1',
      tool: 'set_frame_pose',
      payload: {
        clip: 'walk',
        frame: 0,
        bones: [{ name: 'root' }]
      },
      ts: 1
    }),
    false
  );
  for (const inheritedName of [
    'constructor',
    '__proto__',
    'toString',
    'hasOwnProperty'
  ]) {
    assert.equal(
      isSidecarMessage({
        type: 'request',
        id: 'r1',
        tool: 'list_capabilities',
        payload: JSON.parse(`{"${inheritedName}":true}`),
        ts: 1
      }),
      false,
      inheritedName
    );
  }
  assert.equal(
    isSidecarMessage({
      type: 'request',
      id: 'r1',
      tool: 'add_mesh',
      payload: {
        name: 'mesh',
        uvPolicy: { symmetryAxis: 'x', texelDensity: -1, padding: 999 },
        vertices: [
          { id: 'a', pos: [0, 0, 0] },
          { id: 'b', pos: [1, 0, 0] },
          { id: 'c', pos: [0, 1, 0] }
        ],
        faces: [{ vertices: ['a', 'b', 'c'] }]
      },
      ts: 1
    }),
    false
  );
  assert.equal(
    isSidecarMessage({
      type: 'request',
      id: 'r1',
      tool: 'list_capabilities',
      payload: 7,
      ts: 1
    }),
    false
  );
  assert.equal(
    isSidecarMessage({
      type: 'request',
      id: 'r1',
      tool: 'list_capabilities',
      payload: { unexpected: true },
      ts: 1
    }),
    false
  );
  assert.equal(
    isSidecarMessage({
      type: 'request',
      id: 'r1',
      tool: 'reload_plugins',
      payload: {},
      ts: 1
    }),
    false
  );
  assert.equal(
    isSidecarMessage({
      type: 'request',
      id: 'r1',
      tool: 'reload_plugins',
      payload: { confirm: false },
      ts: 1
    }),
    false
  );
  assert.equal(
    isSidecarMessage({
      type: 'request',
      id: 'r1',
      tool: 'reload_plugins',
      payload: { confirm: true },
      ts: 1
    }),
    true
  );
  assert.equal(
    isSidecarMessage({
      type: 'request',
      id: 'r1',
      tool: 'list_capabilities',
      payload: {},
      extra: true,
      ts: 1
    }),
    false
  );
  assert.equal(
    isSidecarMessage({
      type: 'response',
      id: 'r1',
      ok: false,
      ts: 1
    }),
    false
  );
  assert.equal(
    isSidecarMessage({
      type: 'response',
      id: 'r1',
      ok: false,
      error: { code: 'invalid_state', message: 'x', details: 'bad' },
      ts: 1
    }),
    false
  );
  assert.equal(
    isSidecarMessage({
      type: 'response',
      id: 'r1',
      ok: false,
      error: { code: 'invalid_state', message: 'x', details: { reason: 'y' } },
      ts: 1
    }),
    true
  );
  assert.equal(
    isSidecarMessage({
      type: 'response',
      id: 'r1',
      ok: false,
      error: { code: 'invented', message: 'not declared' },
      ts: 1
    }),
    false
  );
  assert.equal(
    isSidecarMessage({
      type: 'response',
      id: 'r1',
      ok: true,
      data: { value: Number.NaN },
      ts: 1
    }),
    false
  );
  assert.equal(
    isSidecarMessage({
      type: 'response',
      id: 'r1',
      ok: true,
      data: new Date('2026-01-01T00:00:00.000Z'),
      ts: 1
    }),
    false
  );
  assert.equal(
    isSidecarMessage({
      type: 'response',
      id: 'r1',
      ok: true,
      data: { ok: true },
      error: { code: 'unknown', message: 'mixed branch' },
      ts: 1
    }),
    false
  );
  assert.equal(
    isSidecarMessage({
      type: 'response',
      id: 'r1',
      ok: true,
      data: { ok: true },
      ts: 1
    }),
    true
  );
  assert.equal(isSidecarMessage({ type: 'noop', ts: 1 }), false);
  assert.equal(
    isSidecarMessage({
      type: 'error',
      message: 'boom',
      id: 1,
      ts: 1
    }),
    false
  );
  assert.equal(
    isSidecarMessage({
      type: 'error',
      message: 'boom',
      details: { reason: 'x' },
      ts: 1
    }),
    true
  );
}

{
  const hiddenToJson = { name: 'safe' };
  Object.defineProperty(hiddenToJson, 'toJSON', {
    enumerable: false,
    value: () => ({ name: 'changed', extra: true })
  });
  assert.equal(isSidecarMessage({
    type: 'request',
    id: 'hidden-object',
    tool: 'add_bone',
    payload: hiddenToJson,
    ts: 1
  }), false);

  const pivot = [0, 0, 0];
  Object.defineProperty(pivot, 'toJSON', {
    enumerable: false,
    value: () => [0, 0, Number.POSITIVE_INFINITY]
  });
  assert.equal(isSidecarMessage({
    type: 'request',
    id: 'hidden-array',
    tool: 'add_bone',
    payload: { name: 'safe', pivot },
    ts: 1
  }), false);

  const symbolPayload: Record<string | symbol, unknown> = { name: 'safe' };
  symbolPayload[Symbol('hidden')] = true;
  assert.equal(isSidecarMessage({
    type: 'request',
    id: 'hidden-symbol',
    tool: 'add_bone',
    payload: symbolPayload,
    ts: 1
  }), false);

  let getterReads = 0;
  const accessorPayload: Record<string, unknown> = {};
  Object.defineProperty(accessorPayload, 'name', {
    enumerable: true,
    get: () => {
      getterReads += 1;
      return 'unsafe';
    }
  });
  assert.equal(isSidecarMessage({
    type: 'request',
    id: 'accessor',
    tool: 'add_bone',
    payload: accessorPayload,
    ts: 1
  }), false);
  assert.equal(getterReads, 0);
}

{
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.equal(isSidecarMessage({
    type: 'response',
    id: 'r1',
    ok: true,
    data: circular,
    ts: 1
  }), false);
}

{
  let deeplyNested: Record<string, unknown> = {};
  for (let depth = 0; depth < 100; depth += 1) {
    deeplyNested = { child: deeplyNested };
  }
  assert.doesNotThrow(() => isSidecarMessage({
    type: 'response',
    id: 'r1',
    ok: true,
    data: deeplyNested,
    ts: 1
  }));
  assert.equal(isSidecarMessage({
    type: 'response',
    id: 'r1',
    ok: true,
    data: deeplyNested,
    ts: 1
  }), false);
}

{
  const nested = (depth: number): Record<string, unknown> => {
    let value: Record<string, unknown> = {};
    for (let index = 0; index < depth; index += 1) {
      value = { child: value };
    }
    return value;
  };
  for (let depth = 62; depth <= 66; depth += 1) {
    const message = {
      type: 'response',
      id: `depth-${depth}`,
      ok: true,
      data: nested(depth),
      ts: 1
    };
    assert.equal(
      normalizeSidecarMessage(message) !== null,
      isSidecarMessage(message),
      `normalization and validation depth ${depth}`
    );
  }
}

{
  const sparse = new Array(1);
  const compensated = new Array(1) as unknown[] & { extra?: string };
  compensated.extra = 'must not mask the missing index';
  for (const extension of [
    { content: sparse },
    { nextActions: sparse },
    { content: compensated }
  ]) {
    assert.equal(isSidecarMessage({
      type: 'response',
      id: 'r1',
      ok: true,
      data: {},
      ts: 1,
      ...extension
    }), false);
  }

  const customPrototype = [Number.NaN];
  Object.setPrototypeOf(customPrototype, { every: () => true });
  const nullPrototype = [1];
  Object.setPrototypeOf(nullPrototype, null);
  for (const data of [customPrototype, nullPrototype]) {
    assert.doesNotThrow(() => isSidecarMessage({
      type: 'response',
      id: 'r1',
      ok: true,
      data,
      ts: 1
    }));
    assert.equal(isSidecarMessage({
      type: 'response',
      id: 'r1',
      ok: true,
      data,
      ts: 1
    }), false);
  }
}

{
  const content = { type: 'text' as const, text: 'shared' };
  const argument = { material: 'stone' };
  const nextAction = {
    type: 'call_tool' as const,
    tool: 'paint_faces',
    arguments: { first: argument, second: argument },
    reason: 'Reuse one observed selection.'
  };
  const message = {
    type: 'response' as const,
    id: 'shared-aliases',
    ok: true as const,
    data: {},
    content: [content, content],
    nextActions: [nextAction, nextAction],
    ts: 1
  };
  assert.equal(isSidecarMessage(message), true);
  assert.notEqual(normalizeSidecarMessage(message), null);
}

{
  let shared: Record<string, unknown> = { leaf: true };
  for (let depth = 0; depth < 17; depth += 1) {
    shared = { left: shared, right: shared };
  }
  const message = {
    type: 'response',
    id: 'shared-dag-budget',
    ok: true,
    data: shared,
    ts: 1
  };
  assert.equal(isSidecarMessage(message), false);
  assert.equal(normalizeSidecarMessage(message), null);
}

{
  let dag: Record<string, unknown> = { leaf: true };
  for (let depth = 0; depth < 14; depth += 1) {
    dag = { left: dag, right: dag };
  }
  const action = {
    type: 'call_tool',
    tool: 'paint_faces',
    arguments: { dag },
    reason: 'Reject aggregate traversal amplification.'
  };
  assert.equal(isSidecarMessage({
    type: 'response',
    id: 'aggregate-next-actions-budget',
    ok: true,
    data: {},
    nextActions: [action, action, action, action],
    ts: 1
  }), false);
}

{
  const messages: unknown[] = [];
  let errors = 0;
  const decoder = createLineDecoder(
    (message) => {
      messages.push(message);
    },
    () => {
      errors += 1;
    },
    200
  );

  decoder.push('x'.repeat(250));
  assert.equal(errors, 1);

  decoder.push('\n');
  decoder.push('{"type":"ready","version":1,"ts":2}\n');
  assert.equal(messages.length, 1);
}

{
  const first = encodeMessage({ type: 'ready', version: 1, ts: 11 });
  const second = encodeMessage({ type: 'ready', version: 1, ts: 12 });
  const messages: unknown[] = [];
  const errors: Error[] = [];
  const frameLimit = Math.max(
    Buffer.byteLength(first, 'utf8'),
    Buffer.byteLength(second, 'utf8')
  );
  assert.ok(Buffer.byteLength(first + second, 'utf8') > frameLimit);
  const decoder = createLineDecoder(
    (message) => messages.push(message),
    (error) => errors.push(error),
    frameLimit
  );
  decoder.push(first + second);
  assert.deepEqual(errors, []);
  assert.equal(messages.length, 2);
}

{
  const encoded = encodeMessage({
    type: 'error',
    ts: 13,
    message: '🐾'.repeat(12)
  });
  const codeUnitLimit = encoded.length;
  assert.ok(Buffer.byteLength(encoded, 'utf8') > codeUnitLimit);
  const messages: unknown[] = [];
  const errors: Error[] = [];
  const decoder = createLineDecoder(
    (message) => messages.push(message),
    (error) => errors.push(error),
    codeUnitLimit
  );
  decoder.push(encoded);
  assert.equal(messages.length, 0);
  assert.equal(errors.length, 1);
}

{
  const messages: unknown[] = [];
  let errors = 0;
  const decoder = createLineDecoder(
    (message) => {
      messages.push(message);
    },
    () => {
      errors += 1;
    }
  );

  decoder.push(new Uint8Array(Buffer.from('{"type":"ready","version":1,"ts":3}\n', 'utf8')));
  decoder.push(' \n');
  decoder.push('{"type":"ready","version":1}\n');
  assert.equal(messages.length, 1);
  assert.equal(errors, 1);
}

{
  const messages: unknown[] = [];
  const errors: Error[] = [];
  const decoder = createLineDecoder(
    (message) => messages.push(message),
    (error) => errors.push(error),
    80
  );
  decoder.push(new Uint8Array(Buffer.from('x'.repeat(60), 'utf8')));
  decoder.push(new Uint8Array([0xff]));
  assert.equal(errors.length, 1);
  decoder.push(encodeMessage({ type: 'ready', version: 1, ts: 14 }));
  assert.equal(errors.length, 1);
  assert.equal(messages.length, 1);
}

{
  const expected = {
    type: 'request' as const,
    id: 'unicode-request',
    tool: 'add_bone' as const,
    payload: { name: '가🐾' },
    ts: 5
  };
  const bytes = Buffer.from(encodeMessage(expected), 'utf8');
  for (let split = 1; split < bytes.length; split += 1) {
    const messages: unknown[] = [];
    const errors: Error[] = [];
    const decoder = createLineDecoder(
      (message) => messages.push(message),
      (error) => errors.push(error)
    );
    decoder.push(new Uint8Array(bytes.subarray(0, split)));
    decoder.push(new Uint8Array(bytes.subarray(split)));
    assert.deepEqual(errors, [], `UTF-8 split ${split}`);
    assert.deepEqual(messages, [expected], `UTF-8 split ${split}`);
  }
}

{
  const errors: Error[] = [];
  const decoder = createLineDecoder(
    () => undefined,
    (error) => errors.push(error)
  );
  decoder.push(new Uint8Array([0xe1]));
  decoder.end();
  assert.equal(errors.length, 1);
}

{
  const messages: unknown[] = [];
  let errors = 0;
  const decoder = createLineDecoder(
    (message) => {
      messages.push(message);
    },
    () => {
      errors += 1;
    }
  );

  decoder.push('{"type":"ready","version":1,');
  decoder.end();
  decoder.push('"ts":4}\n');
  assert.equal(messages.length, 0);
  assert.equal(errors, 1);
}
