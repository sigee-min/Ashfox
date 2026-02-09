import { createEngineBackend } from '@ashfox/backend-engine';
import type { BackendAvailability } from '@ashfox/backend-core';
import { ConsoleLogger, type LogLevel } from '@ashfox/runtime/logging';

const DEFAULT_HEARTBEAT_MS = 5000;

const toPositiveInt = (raw: string | undefined, fallback: number): number => {
  const value = Number(raw ?? fallback);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
};

const logLevel: LogLevel = (process.env.ASHFOX_WORKER_LOG_LEVEL as LogLevel) ?? 'info';
const heartbeatMs = toPositiveInt(process.env.ASHFOX_WORKER_HEARTBEAT_MS, DEFAULT_HEARTBEAT_MS);
const logger = new ConsoleLogger('ashfox-worker', () => logLevel);

const backend = createEngineBackend({
  version: '0.0.0-scaffold',
  details: { queue: 'in-memory-placeholder' }
});

const heartbeat = async () => {
  const health = await backend.getHealth();
  const availability: BackendAvailability = health.availability;
  logger.info('ashfox worker heartbeat', {
    kind: health.kind,
    availability,
    version: health.version,
    details: health.details
  });
};

logger.info('ashfox worker started', { heartbeatMs });
void heartbeat();
const timer = setInterval(() => {
  void heartbeat();
}, heartbeatMs);

const shutdown = () => {
  clearInterval(timer);
  logger.info('ashfox worker shutdown');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
