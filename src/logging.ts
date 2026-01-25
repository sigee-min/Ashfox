export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogLevelProvider = LogLevel | (() => LogLevel);

export interface Logger {
  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export const errorMessage = (err: unknown, fallback?: string): string => {
  if (err instanceof Error) return err.message;
  if (fallback !== undefined) return fallback;
  return String(err);
};

export class ConsoleLogger implements Logger {
  private readonly prefix: string;
  private readonly minLevel: LogLevelProvider;

  constructor(prefix: string, minLevel: LogLevelProvider = 'info') {
    this.prefix = prefix;
    this.minLevel = minLevel;
  }

  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;
    const payload = meta ? `${message} ${JSON.stringify(meta)}` : message;
    // eslint-disable-next-line no-console
    console.log(`[${this.prefix}] [${level}] ${payload}`);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  private shouldLog(level: LogLevel): boolean {
    const order: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const minLevel = typeof this.minLevel === 'function' ? this.minLevel() : this.minLevel;
    return order.indexOf(level) >= order.indexOf(minLevel);
  }
}
