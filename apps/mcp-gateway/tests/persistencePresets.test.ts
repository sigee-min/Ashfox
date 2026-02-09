import assert from 'node:assert/strict';
import { createGatewayPersistence } from '../src/persistence/createPersistence';
import { registerAsync } from './helpers';

const getDetails = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
};

registerAsync(
  (async () => {
    {
      const persistence = createGatewayPersistence({
        ASHFOX_PERSISTENCE_PRESET: 'local'
      });
      assert.deepEqual(persistence.health.selection, {
        preset: 'local',
        databaseProvider: 'sqlite',
        storageProvider: 'fs'
      });
      assert.equal(persistence.health.database.ready, true);
      assert.equal(persistence.health.storage.ready, true);
      const dbDetails = getDetails(persistence.health.database.details);
      assert.equal(dbDetails.adapter, 'sqlite_repository');
      assert.ok(typeof dbDetails.filePath === 'string' && dbDetails.filePath.length > 0);
      const storageDetails = getDetails(persistence.health.storage.details);
      assert.ok(typeof storageDetails.rootDir === 'string' && storageDetails.rootDir.length > 0);
    }

    {
      const persistence = createGatewayPersistence({
        ASHFOX_PERSISTENCE_PRESET: 'selfhost',
        ASHFOX_DB_POSTGRES_URL: 'postgresql://selfhost:selfhost@127.0.0.1:5432/ashfox',
        ASHFOX_STORAGE_S3_ENDPOINT: 'https://s3.example.internal',
        ASHFOX_STORAGE_S3_REGION: 'us-east-1',
        ASHFOX_STORAGE_S3_ACCESS_KEY_ID: 'test-access',
        ASHFOX_STORAGE_S3_SECRET_ACCESS_KEY: 'test-secret'
      });
      assert.deepEqual(persistence.health.selection, {
        preset: 'selfhost',
        databaseProvider: 'postgres',
        storageProvider: 's3'
      });
      assert.equal(persistence.health.database.ready, true);
      assert.equal(persistence.health.storage.ready, true);
      const details = getDetails(persistence.health.storage.details);
      assert.equal(details.adapter, 's3_storage');
    }

    {
      const persistence = createGatewayPersistence({
        ASHFOX_PERSISTENCE_PRESET: 'ashfox',
        ASHFOX_DB_ASHFOX_URL: 'postgresql://postgres:secret@database.sigee.xyx:5432/postgres?sslmode=require',
        ASHFOX_STORAGE_ASHFOX_URL: 'https://database.sigee.xyx',
        ASHFOX_STORAGE_ASHFOX_SERVICE_KEY: 'service-role-test-key'
      });
      assert.deepEqual(persistence.health.selection, {
        preset: 'ashfox',
        databaseProvider: 'ashfox',
        storageProvider: 'ashfox'
      });
      assert.equal(persistence.health.database.ready, true);
      assert.equal(persistence.health.storage.ready, true);
      assert.equal(getDetails(persistence.health.database.details).host, 'database.sigee.xyx');
      assert.equal(getDetails(persistence.health.storage.details).baseUrl, 'https://database.sigee.xyx');
    }

    {
      const persistence = createGatewayPersistence({
        ASHFOX_PERSISTENCE_PRESET: 'supabase',
        ASHFOX_DB_ASHFOX_URL: 'postgresql://postgres:secret@database.sigee.xyx:5432/postgres?sslmode=require',
        ASHFOX_STORAGE_ASHFOX_SERVICE_KEY: 'service-role-test-key'
      });
      assert.equal(persistence.health.selection.preset, 'ashfox');
      assert.equal(persistence.health.selection.databaseProvider, 'ashfox');
      assert.equal(persistence.health.selection.storageProvider, 'ashfox');
    }

    {
      const persistence = createGatewayPersistence({
        ASHFOX_PERSISTENCE_PRESET: 'ashfox',
        ASHFOX_DB_ASHFOX_URL: 'postgresql://postgres:secret@database.sigee.xyx:5432/postgres?sslmode=require'
      });
      assert.equal(persistence.health.storage.ready, false);
      assert.equal(persistence.health.storage.reason, 'missing_credentials');
    }
  })()
);
