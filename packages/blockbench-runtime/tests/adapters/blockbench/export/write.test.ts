import assert from 'node:assert/strict';

import { BlockbenchExport } from '../../../../src/adapters/blockbench/export';
import { noopLog, registerAsync } from '../../../helpers';
import { withGlobalsAsync } from './fixture';

registerAsync(
  (async () => {
    {
      const adapter = new BlockbenchExport(noopLog);
      await withGlobalsAsync(
        {
          Blockbench: {
            writeFile: () => undefined
          },
          Codecs: {}
        },
        async () => {
          const error = await adapter.exportGltf({ destPath: 'out.glb' });
          assert.equal(error?.code, 'not_implemented');
        }
      );
    }

    {
      const writes: Array<{ content: unknown; path: string }> = [];
      const adapter = new BlockbenchExport(noopLog);
      await withGlobalsAsync(
        {
          Blockbench: {
            writeFile: () => undefined
          },
          Codecs: {
            gltf: {
              compile: () => ({ scene: true }),
              write: (content: unknown, path: string) => {
                writes.push({ content, path });
              }
            }
          }
        },
        async () => {
          const error = await adapter.exportGltf({ destPath: 'codec.glb' });
          assert.equal(error, null);
        }
      );
      assert.equal(writes.length, 1);
      assert.equal(writes[0].path, 'codec.glb');
    }

    {
      const writes: Array<{ path: string; content: string; savetype: string }> = [];
      const adapter = new BlockbenchExport(noopLog);
      await withGlobalsAsync(
        {
          Blockbench: {
            writeFile: (path: string, payload: { content: string; savetype: string }) => {
              writes.push({ path, content: payload.content, savetype: payload.savetype });
            }
          },
          Codecs: {
            gltf: {
              compile: () => ({ asset: { version: '2.0' } })
            }
          }
        },
        async () => {
          const error = await adapter.exportGltf({ destPath: 'fallback.gltf' });
          assert.equal(error, null);
        }
      );
      assert.equal(writes.length, 1);
      assert.equal(writes[0].path, 'fallback.gltf');
      assert.equal(writes[0].content.includes('"version": "2.0"'), true);
    }

    {
      const writes: Array<{ path: string; content: string; savetype: string }> = [];
      const adapter = new BlockbenchExport(noopLog);
      await withGlobalsAsync(
        {
          Blockbench: {
            writeFile: (path: string, payload: { content: string; savetype: string }) => {
              writes.push({ path, content: payload.content, savetype: payload.savetype });
            }
          },
          Codecs: {
            gltf: {
              compile: () => Promise.resolve({ scene: true })
            }
          }
        },
        async () => {
          const error = await adapter.exportGltf({ destPath: 'async.gltf' });
          assert.equal(error, null);
        }
      );
      assert.equal(writes.length, 1);
    }

    {
      const writes: Array<{ content: unknown; path: string }> = [];
      const adapter = new BlockbenchExport(noopLog);
      await withGlobalsAsync(
        {
          Blockbench: {
            writeFile: () => undefined
          },
          Codecs: {
            gltf: {
              compile: () => ({ scene: true }),
              write: async (content: unknown, path: string) => {
                writes.push({ content, path });
              }
            }
          }
        },
        async () => {
          const error = await adapter.exportGltf({ destPath: 'async-write.glb' });
          assert.equal(error, null);
        }
      );
      assert.equal(writes.length, 1);
      assert.equal(writes[0].path, 'async-write.glb');
    }

    {
      const writes: Array<{ content: unknown; path: string }> = [];
      const adapter = new BlockbenchExport(noopLog);
      await withGlobalsAsync(
        {
          Blockbench: {
            writeFile: () => undefined
          },
          Codecs: {
            obj: {
              id: 'obj',
              name: 'Wavefront OBJ',
              extension: 'obj',
              compile: () => ({ mesh: true }),
              write: (content: unknown, path: string) => {
                writes.push({ content, path });
              }
            }
          }
        },
        async () => {
          const error = await adapter.exportCodec?.({ codecId: 'obj', destPath: 'asset.obj' });
          assert.equal(error, null);
        }
      );
      assert.equal(writes.length, 1);
      assert.equal(writes[0].path, 'asset.obj');
    }

    {
      const adapter = new BlockbenchExport(noopLog);
      await withGlobalsAsync(
        {
          Blockbench: {
            writeFile: () => undefined
          },
          Codecs: {}
        },
        async () => {
          const error = await adapter.exportCodec?.({ codecId: 'fbx', destPath: 'asset.fbx' });
          assert.equal(error?.code, 'not_implemented');
        }
      );
    }

    {
      const adapter = new BlockbenchExport(noopLog);
      await withGlobalsAsync(
        {
          Codecs: {
            obj: {
              id: 'obj',
              name: 'Wavefront OBJ',
              extension: 'obj'
            },
            fbx: {
              id: 'fbx',
              name: 'FBX',
              extension: 'fbx'
            }
          }
        },
        async () => {
          const targets = adapter.listNativeCodecs?.() ?? [];
          assert.equal(targets.length, 2);
          assert.equal(targets.some((target) => target.id === 'obj' && target.extensions.includes('obj')), true);
          assert.equal(targets.some((target) => target.id === 'fbx' && target.extensions.includes('fbx')), true);
        }
      );
    }

    {
      const adapter = new BlockbenchExport(noopLog);
      const brokenCodec: Record<string, unknown> = {};
      Object.defineProperty(brokenCodec, 'id', {
        enumerable: true,
        get() {
          throw new TypeError("Cannot read properties of undefined (reading 'compileAdapter')");
        }
      });
      Object.defineProperty(brokenCodec, 'name', { enumerable: true, value: 'Broken Codec' });
      Object.defineProperty(brokenCodec, 'extension', { enumerable: true, value: 'broken' });
      await withGlobalsAsync(
        {
          Codecs: {
            obj: {
              id: 'obj',
              name: 'Wavefront OBJ',
              extension: 'obj'
            },
            broken: brokenCodec
          }
        },
        async () => {
          const targets = adapter.listNativeCodecs?.() ?? [];
          assert.equal(targets.some((target) => target.id === 'obj' && target.extensions.includes('obj')), true);
          assert.equal(targets.some((target) => target.id === 'broken'), false);
        }
      );
    }
  })()
);
