import path from 'node:path';
import type { DatabaseProvider, PersistencePreset, PersistenceSelection, StorageProvider } from '@ashfox/backend-core';

export interface PostgresRepositoryConfig {
  connectionString: string;
  schema: string;
  tableName: string;
  migrationsTableName: string;
  maxConnections: number;
  provider: DatabaseProvider;
  host: string;
}

export interface SqliteRepositoryConfig {
  filePath: string;
  tableName: string;
  migrationsTableName: string;
  provider: DatabaseProvider;
}

export interface S3BlobStoreConfig {
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  forcePathStyle: boolean;
  keyPrefix?: string;
  requestTimeoutMs: number;
}

export interface AshfoxBlobStoreConfig {
  baseUrl: string;
  serviceKey: string;
  keyPrefix?: string;
  requestTimeoutMs: number;
  upsert: boolean;
}

const DEFAULT_PRESET: PersistencePreset = 'local';
const DEFAULT_STORAGE_ROOT = path.resolve('.ashfox', 'storage');
const DEFAULT_POSTGRES_URL = 'postgresql://ashfox:ashfox@postgres:5432/ashfox';
const DEFAULT_SQLITE_PATH = path.resolve('.ashfox', 'local', 'ashfox.sqlite');
const DEFAULT_MIGRATIONS_TABLE = 'ashfox_schema_migrations';
const DEFAULT_ASHFOX_DB_HOST = 'database.sigee.xyx';
const DEFAULT_ASHFOX_STORAGE_URL = 'https://database.sigee.xyx';

const PRESET_SELECTIONS: Record<PersistencePreset, { databaseProvider: DatabaseProvider; storageProvider: StorageProvider }> =
  {
    local: { databaseProvider: 'sqlite', storageProvider: 'fs' },
    selfhost: { databaseProvider: 'postgres', storageProvider: 's3' },
    ashfox: { databaseProvider: 'ashfox', storageProvider: 'ashfox' }
  };

const normalize = (value: string | undefined): string => String(value ?? '').trim().toLowerCase();
const nonEmpty = (value: string | undefined): string | null => {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
};

const parseBool = (value: string | undefined, fallback: boolean): boolean => {
  const normalized = normalize(value);
  if (!normalized) return fallback;
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') return false;
  return fallback;
};

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return fallback;
  return Math.floor(numeric);
};

const parsePreset = (value: string | undefined): PersistencePreset | null => {
  const normalized = normalize(value);
  if (normalized === 'local' || normalized === 'selfhost') {
    return normalized;
  }
  // Backward-compatible alias for previous provider naming.
  if (normalized === 'ashfox' || normalized === 'supabase') return 'ashfox';
  return null;
};

const parseDatabaseProvider = (value: string | undefined): DatabaseProvider | null => {
  const normalized = normalize(value);
  if (normalized === 'sqlite') {
    return normalized;
  }
  if (normalized === 'postgres') {
    return normalized;
  }
  // Backward-compatible alias for previous provider naming.
  if (normalized === 'ashfox' || normalized === 'supabase') return 'ashfox';
  return null;
};

const parseStorageProvider = (value: string | undefined): StorageProvider | null => {
  const normalized = normalize(value);
  if (normalized === 'fs' || normalized === 's3') {
    return normalized;
  }
  // Backward-compatible alias for previous provider naming.
  if (normalized === 'ashfox' || normalized === 'supabase') return 'ashfox';
  return null;
};

const normalizeUrlBase = (value: string): string => value.replace(/\/+$/, '');

const buildPostgresUrl = (input: {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl: boolean;
}): string => {
  const user = encodeURIComponent(input.user);
  const password = input.password ? `:${encodeURIComponent(input.password)}` : '';
  const database = encodeURIComponent(input.database);
  const query = input.ssl ? '?sslmode=require' : '';
  return `postgresql://${user}${password}@${input.host}:${input.port}/${database}${query}`;
};

const parseHostFromConnection = (connectionString: string, fallbackHost: string): string => {
  try {
    return new URL(connectionString).hostname || fallbackHost;
  } catch {
    return fallbackHost;
  }
};

export const resolvePersistenceSelection = (env: NodeJS.ProcessEnv): PersistenceSelection => {
  const preset = parsePreset(env.ASHFOX_PERSISTENCE_PRESET) ?? DEFAULT_PRESET;
  const presetSelection = PRESET_SELECTIONS[preset];
  const databaseProvider = parseDatabaseProvider(env.ASHFOX_DB_PROVIDER) ?? presetSelection.databaseProvider;
  const storageProvider = parseStorageProvider(env.ASHFOX_STORAGE_PROVIDER) ?? presetSelection.storageProvider;
  return {
    preset,
    databaseProvider,
    storageProvider
  };
};

export const resolveStorageRoot = (env: NodeJS.ProcessEnv): string => {
  const raw = nonEmpty(env.ASHFOX_STORAGE_FS_ROOT);
  if (!raw) return DEFAULT_STORAGE_ROOT;
  return path.resolve(raw);
};

export const resolveSqliteDatabaseConfig = (env: NodeJS.ProcessEnv): SqliteRepositoryConfig => {
  const rawPath = nonEmpty(env.ASHFOX_DB_SQLITE_PATH);
  const filePath = rawPath ? path.resolve(rawPath) : DEFAULT_SQLITE_PATH;
  return {
    filePath,
    tableName: nonEmpty(env.ASHFOX_DB_SQLITE_TABLE) ?? 'ashfox_projects',
    migrationsTableName: nonEmpty(env.ASHFOX_DB_SQLITE_MIGRATIONS_TABLE) ?? DEFAULT_MIGRATIONS_TABLE,
    provider: 'sqlite'
  };
};

export const resolvePostgresDatabaseConfig = (env: NodeJS.ProcessEnv): PostgresRepositoryConfig => {
  const connectionString = nonEmpty(env.ASHFOX_DB_POSTGRES_URL) ?? DEFAULT_POSTGRES_URL;
  return {
    connectionString,
    schema: nonEmpty(env.ASHFOX_DB_POSTGRES_SCHEMA) ?? 'public',
    tableName: nonEmpty(env.ASHFOX_DB_POSTGRES_TABLE) ?? 'ashfox_projects',
    migrationsTableName: nonEmpty(env.ASHFOX_DB_POSTGRES_MIGRATIONS_TABLE) ?? DEFAULT_MIGRATIONS_TABLE,
    maxConnections: parsePositiveInt(env.ASHFOX_DB_POSTGRES_MAX_CONNECTIONS, 10),
    provider: 'postgres',
    host: parseHostFromConnection(connectionString, 'postgres')
  };
};

export const resolveAshfoxDatabaseConfig = (env: NodeJS.ProcessEnv): PostgresRepositoryConfig => {
  const rawConnection = nonEmpty(env.ASHFOX_DB_ASHFOX_URL);
  if (rawConnection) {
    return {
      connectionString: rawConnection,
      schema: nonEmpty(env.ASHFOX_DB_ASHFOX_SCHEMA) ?? 'public',
      tableName: nonEmpty(env.ASHFOX_DB_ASHFOX_TABLE) ?? 'ashfox_projects',
      migrationsTableName: nonEmpty(env.ASHFOX_DB_ASHFOX_MIGRATIONS_TABLE) ?? DEFAULT_MIGRATIONS_TABLE,
      maxConnections: parsePositiveInt(env.ASHFOX_DB_ASHFOX_MAX_CONNECTIONS, 10),
      provider: 'ashfox',
      host: parseHostFromConnection(rawConnection, DEFAULT_ASHFOX_DB_HOST)
    };
  }
  const host = nonEmpty(env.ASHFOX_DB_ASHFOX_HOST) ?? DEFAULT_ASHFOX_DB_HOST;
  const port = parsePositiveInt(env.ASHFOX_DB_ASHFOX_PORT, 5432);
  const user = nonEmpty(env.ASHFOX_DB_ASHFOX_USER) ?? 'postgres';
  const password = nonEmpty(env.ASHFOX_DB_ASHFOX_PASSWORD) ?? undefined;
  const database = nonEmpty(env.ASHFOX_DB_ASHFOX_NAME) ?? 'postgres';
  const ssl = parseBool(env.ASHFOX_DB_ASHFOX_SSL, true);
  return {
    connectionString: buildPostgresUrl({ host, port, user, password, database, ssl }),
    schema: nonEmpty(env.ASHFOX_DB_ASHFOX_SCHEMA) ?? 'public',
    tableName: nonEmpty(env.ASHFOX_DB_ASHFOX_TABLE) ?? 'ashfox_projects',
    migrationsTableName: nonEmpty(env.ASHFOX_DB_ASHFOX_MIGRATIONS_TABLE) ?? DEFAULT_MIGRATIONS_TABLE,
    maxConnections: parsePositiveInt(env.ASHFOX_DB_ASHFOX_MAX_CONNECTIONS, 10),
    provider: 'ashfox',
    host
  };
};

export const resolveS3BlobStoreConfig = (env: NodeJS.ProcessEnv): S3BlobStoreConfig => ({
  region: nonEmpty(env.ASHFOX_STORAGE_S3_REGION) ?? 'us-east-1',
  endpoint: nonEmpty(env.ASHFOX_STORAGE_S3_ENDPOINT) ?? undefined,
  accessKeyId: nonEmpty(env.ASHFOX_STORAGE_S3_ACCESS_KEY_ID) ?? '',
  secretAccessKey: nonEmpty(env.ASHFOX_STORAGE_S3_SECRET_ACCESS_KEY) ?? '',
  sessionToken: nonEmpty(env.ASHFOX_STORAGE_S3_SESSION_TOKEN) ?? undefined,
  forcePathStyle: parseBool(env.ASHFOX_STORAGE_S3_FORCE_PATH_STYLE, true),
  keyPrefix: nonEmpty(env.ASHFOX_STORAGE_S3_KEY_PREFIX) ?? undefined,
  requestTimeoutMs: parsePositiveInt(env.ASHFOX_STORAGE_S3_TIMEOUT_MS, 15000)
});

export const resolveAshfoxBlobStoreConfig = (env: NodeJS.ProcessEnv): AshfoxBlobStoreConfig => ({
  baseUrl: normalizeUrlBase(nonEmpty(env.ASHFOX_STORAGE_ASHFOX_URL) ?? DEFAULT_ASHFOX_STORAGE_URL),
  serviceKey: nonEmpty(env.ASHFOX_STORAGE_ASHFOX_SERVICE_KEY) ?? '',
  keyPrefix: nonEmpty(env.ASHFOX_STORAGE_ASHFOX_KEY_PREFIX) ?? undefined,
  requestTimeoutMs: parsePositiveInt(env.ASHFOX_STORAGE_ASHFOX_TIMEOUT_MS, 15000),
  upsert: parseBool(env.ASHFOX_STORAGE_ASHFOX_UPSERT, true)
});
