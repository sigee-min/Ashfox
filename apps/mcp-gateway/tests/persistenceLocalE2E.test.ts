import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeGatewayPersistence, createGatewayPersistence } from '../src/persistence/createPersistence';
import { registerAsync } from './helpers';

const hasNodeSqlite = (): boolean => {
  try {
    type SqliteModule = { DatabaseSync?: unknown };
    const sqliteModule = require('node:sqlite') as SqliteModule;
    return typeof sqliteModule.DatabaseSync === 'function';
  } catch {
    return false;
  }
};

registerAsync(
  (async () => {
    if (!hasNodeSqlite()) {
      return;
    }
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ashfox-local-persistence-'));
    try {
      const sqlitePath = path.join(tempRoot, 'state', 'ashfox.sqlite');
      const storageRoot = path.join(tempRoot, 'storage');
      const persistence = createGatewayPersistence(
        {
          ASHFOX_PERSISTENCE_PRESET: 'local',
          ASHFOX_DB_SQLITE_PATH: sqlitePath,
          ASHFOX_STORAGE_FS_ROOT: storageRoot
        },
        { failFast: true }
      );

      const scope = { tenantId: 'tenant-local', projectId: 'project-local' };
      const record = {
        scope,
        revision: 'rev-1',
        state: { mesh: { cubes: 3 } },
        createdAt: '2026-02-09T00:00:00.000Z',
        updatedAt: '2026-02-09T00:00:00.000Z'
      };

      await persistence.projectRepository.save(record);
      const found = await persistence.projectRepository.find(scope);
      assert.ok(found);
      assert.equal(found?.revision, 'rev-1');
      assert.deepEqual(found?.state, { mesh: { cubes: 3 } });

      await persistence.blobStore.put({
        bucket: 'models',
        key: 'tenant-local/project-local/model.json',
        bytes: Buffer.from('{"ok":true}', 'utf8'),
        contentType: 'application/json',
        metadata: { source: 'test' }
      });
      const blob = await persistence.blobStore.get({
        bucket: 'models',
        key: 'tenant-local/project-local/model.json'
      });
      assert.ok(blob);
      assert.equal(blob?.contentType, 'application/json');
      assert.equal(Buffer.from(blob?.bytes ?? []).toString('utf8'), '{"ok":true}');

      await persistence.blobStore.delete({
        bucket: 'models',
        key: 'tenant-local/project-local/model.json'
      });
      const afterDelete = await persistence.blobStore.get({
        bucket: 'models',
        key: 'tenant-local/project-local/model.json'
      });
      assert.equal(afterDelete, null);

      await persistence.projectRepository.remove(scope);
      const afterRemove = await persistence.projectRepository.find(scope);
      assert.equal(afterRemove, null);

      await closeGatewayPersistence(persistence);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  })()
);
