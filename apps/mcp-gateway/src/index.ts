import { createBlockbenchBackend } from '@ashfox/backend-blockbench';
import { BackendRegistry, type BackendKind } from '@ashfox/backend-core';
import { createEngineBackend } from '@ashfox/backend-engine';
import { ConsoleLogger, type LogLevel } from '@ashfox/runtime/logging';
import { startServer, type ServerConfig } from '@ashfox/runtime/server';
import { GatewayDispatcher } from './dispatcher';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8790;
const DEFAULT_PATH = '/mcp';
const DEFAULT_BACKEND: BackendKind = 'engine';

const toPort = (raw: string | undefined): number => {
  const numeric = Number(raw ?? DEFAULT_PORT);
  if (!Number.isFinite(numeric) || numeric < 1 || numeric > 65535) {
    return DEFAULT_PORT;
  }
  return Math.floor(numeric);
};

const resolveBackendKind = (raw: string | undefined): BackendKind => {
  if (raw === 'blockbench' || raw === 'engine') return raw;
  return DEFAULT_BACKEND;
};

const logLevel: LogLevel = (process.env.ASHFOX_GATEWAY_LOG_LEVEL as LogLevel) ?? 'info';
const logger = new ConsoleLogger('ashfox-gateway', () => logLevel);

const registry = new BackendRegistry();
registry.register(
  createEngineBackend({
    version: '0.0.0-scaffold',
    details: { mode: 'standalone' }
  })
);
registry.register(
  createBlockbenchBackend({
    version: '0.0.0-scaffold',
    details: { mode: 'requires_plugin_bridge' }
  })
);

const dispatcher = new GatewayDispatcher({
  registry,
  defaultBackend: resolveBackendKind(process.env.ASHFOX_GATEWAY_BACKEND)
});

const config: ServerConfig = {
  host: process.env.ASHFOX_HOST ?? DEFAULT_HOST,
  port: toPort(process.env.ASHFOX_PORT),
  path: process.env.ASHFOX_PATH ?? DEFAULT_PATH
};

const stop = startServer(config, dispatcher, logger);
if (!stop) {
  logger.error('ashfox gateway failed to start', { host: config.host, port: config.port, path: config.path });
  process.exit(1);
}

logger.info('ashfox gateway started', {
  host: config.host,
  port: config.port,
  path: config.path,
  backend: resolveBackendKind(process.env.ASHFOX_GATEWAY_BACKEND)
});

const shutdown = () => {
  logger.info('ashfox gateway shutdown');
  stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
