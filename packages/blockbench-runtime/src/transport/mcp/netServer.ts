import { errorMessage, Logger } from '../../logging';
import { McpRouter } from './router';
import { ResponsePlan, SseConnection } from './types';
import { openSseConnection } from './transport';
import type { Server, Socket } from 'net';
import {
  MCP_INVALID_CONTENT_LENGTH,
  MCP_INVALID_HEADER,
  MCP_INVALID_REQUEST_LINE,
  MCP_PAYLOAD_READ_FAILED,
  MCP_PAYLOAD_TOO_LARGE,
  MCP_REQUEST_TIMEOUT,
  MCP_TOOL_EXECUTION_FAILED,
  MCP_TRANSFER_ENCODING_UNSUPPORTED
} from '../../shared/messages';
import {
  MCP_HTTP_MAX_HEADER_BYTES,
  MCP_MAX_TRANSPORT_CONNECTIONS,
  TRANSPORT_MAX_PAYLOAD_BYTES,
  TRANSPORT_REQUEST_TIMEOUT_MS
} from '../limits';
import { ByteAccumulator } from '../byteAccumulator';
import { decodeStrictUtf8 } from '../utf8';
import type { TransportServerHandle } from '../serverLifecycle';

export { MCP_HTTP_MAX_HEADER_BYTES, TRANSPORT_MAX_PAYLOAD_BYTES };

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  202: 'Accepted',
  400: 'Bad Request',
  401: 'Unauthorized',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  500: 'Internal Server Error'
};

type ParsedHead = {
  method: string;
  url: string;
  version: string;
  headers: Record<string, string>;
  contentLength: number;
  shouldClose: boolean;
};

export const parseRequestHead = (head: string): { ok: true; value: ParsedHead } | { ok: false; message: string } => {
  const lines = head.split('\r\n');
  const requestLine = /^([A-Z]+) (\S+) (HTTP\/1\.[01])$/.exec(lines[0]);
  if (!requestLine) {
    return { ok: false, message: MCP_INVALID_REQUEST_LINE };
  }
  const [, method, url, version] = requestLine;
  const headers: Record<string, string> = {};
  for (const line of lines.slice(1)) {
    const match = /^([!#$%&'*+\-.^_`|~0-9A-Za-z]+):[ \t]*(.*)$/.exec(line);
    if (!match) return { ok: false, message: MCP_INVALID_HEADER };
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (
      key === 'content-length' &&
      Object.prototype.hasOwnProperty.call(headers, key)
    ) {
      return { ok: false, message: MCP_INVALID_CONTENT_LENGTH };
    }
    headers[key] = headers[key] ? `${headers[key]}, ${value}` : value;
  }
  if (Object.prototype.hasOwnProperty.call(headers, 'transfer-encoding')) {
    return { ok: false, message: MCP_TRANSFER_ENCODING_UNSUPPORTED };
  }
  let contentLength = 0;
  if (Object.prototype.hasOwnProperty.call(headers, 'content-length')) {
    const lengthRaw = headers['content-length'];
    if (!/^[0-9]+$/.test(lengthRaw)) {
      return { ok: false, message: MCP_INVALID_CONTENT_LENGTH };
    }
    const parsed = Number(lengthRaw);
    if (!Number.isSafeInteger(parsed)) {
      return { ok: false, message: MCP_INVALID_CONTENT_LENGTH };
    }
    contentLength = parsed;
  }
  const connection = headers.connection?.toLowerCase();
  const shouldClose = connection === 'close' || (version === 'HTTP/1.0' && connection !== 'keep-alive');
  return { ok: true, value: { method, url, version, headers, contentLength, shouldClose } };
};

const writeHeaders = (socket: Socket, status: number, headers: Record<string, string>, hasBody: boolean) => {
  const statusText = STATUS_TEXT[status] ?? 'OK';
  const base = [`HTTP/1.1 ${status} ${statusText}`];
  for (const [key, value] of Object.entries(headers)) {
    base.push(`${key}: ${value}`);
  }
  if (!hasBody) {
    base.push('Content-Length: 0');
  }
  base.push('', '');
  socket.write(base.join('\r\n'));
};

const writePlan = (
  socket: Socket,
  plan: ResponsePlan,
  closeAfter: boolean,
  onOpen?: (conn: SseConnection) => void | (() => void),
  canOpen: () => boolean = () => true
): boolean => {
  if (plan.kind === 'sse') {
    const headers: Record<string, string> = {
      ...plan.headers,
      Connection: 'close'
    };
    delete headers['Content-Length'];
    delete headers['Transfer-Encoding'];
    writeHeaders(socket, plan.status, headers, true);
    for (const event of plan.events) {
      socket.write(event);
    }
    if (plan.onOpen || !plan.close) {
      if (!canOpen()) {
        return false;
      }
      openSseConnection(
        {
          send: (payload) => socket.write(payload),
          close: () => socket.end(),
          onClose: (handler) => socket.on('close', handler)
        },
        onOpen ?? plan.onOpen
      );
      if (plan.close) {
        socket.end();
      }
      return true;
    }
    socket.end();
    return true;
  }

  if (plan.kind === 'json') {
    const body = plan.body ?? '';
    const headers = { ...plan.headers, 'Content-Length': Buffer.byteLength(body).toString() };
    writeHeaders(socket, plan.status, headers, true);
    socket.write(body);
    if (closeAfter) socket.end();
    return true;
  }

  if (plan.kind === 'binary') {
    const body = plan.body ?? new Uint8Array();
    const headers = { ...plan.headers, 'Content-Length': body.length.toString() };
    writeHeaders(socket, plan.status, headers, true);
    socket.write(body);
    if (closeAfter) socket.end();
    return true;
  }

  writeHeaders(socket, plan.status, plan.headers, false);
  if (closeAfter) socket.end();
  return true;
};

const jsonPlan = (status: number, body: unknown): ResponsePlan => ({
  kind: 'json',
  status,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

export type NetServerConfig = {
  host: string;
  port: number;
  requestTimeoutMs?: number;
};

type NetModule = {
  createServer: (handler: (socket: Socket) => void) => Server;
};

export const startMcpNetServer = (
  net: NetModule,
  config: NetServerConfig,
  router: McpRouter,
  log: Logger
): TransportServerHandle => {
  const server = net.createServer((socket: Socket) => {
    const buffer = new ByteAccumulator();
    let closed = false;
    let handedOff = false;
    let processing = false;
    let pendingHead: ParsedHead | null = null;
    let cancelPendingSse: (() => void) | null = null;
    let requestTimer: ReturnType<typeof setTimeout> | null = null;
    const requestTimeoutMs =
      Number.isFinite(config.requestTimeoutMs) &&
      (config.requestTimeoutMs as number) > 0
        ? Math.trunc(config.requestTimeoutMs as number)
        : TRANSPORT_REQUEST_TIMEOUT_MS;

    const clearRequestDeadline = () => {
      if (!requestTimer) return;
      clearTimeout(requestTimer);
      requestTimer = null;
    };

    const closeSocket = () => {
      if (closed) return;
      closed = true;
      cancelPendingSse?.();
      cancelPendingSse = null;
      clearRequestDeadline();
      try {
        socket.end();
      } catch (err) {
        socket.destroy?.();
      }
    };

    const armRequestDeadline = () => {
      clearRequestDeadline();
      requestTimer = setTimeout(() => {
        log.warn('MCP net request timed out', {
          message: MCP_REQUEST_TIMEOUT
        });
        closeSocket();
      }, requestTimeoutMs);
    };

    armRequestDeadline();

    const processBuffer = async () => {
      if (processing || closed) return;
      processing = true;
      try {
        while (!closed) {
          if (!pendingHead) {
            const headerEnd = buffer.indexOf('\r\n\r\n');
            if (headerEnd < 0) return;
            if (headerEnd + 4 > MCP_HTTP_MAX_HEADER_BYTES) {
              closeSocket();
              return;
            }
            const headText = decodeStrictUtf8(buffer.view(0, headerEnd));
            if (headText === null) {
              writePlan(socket, jsonPlan(400, {
                error: {
                  code: 'invalid_payload',
                  message: MCP_INVALID_HEADER
                }
              }), true);
              closeSocket();
              return;
            }
            const parsed = parseRequestHead(headText);
            if (!parsed.ok) {
              const plan = jsonPlan(400, { error: { code: 'invalid_payload', message: parsed.message } });
              writePlan(socket, plan, true);
              closeSocket();
              return;
            }
            if (parsed.value.contentLength > TRANSPORT_MAX_PAYLOAD_BYTES) {
              const plan = jsonPlan(413, { error: { code: 'payload_too_large', message: MCP_PAYLOAD_TOO_LARGE } });
              writePlan(socket, plan, true);
              closeSocket();
              return;
            }
            buffer.consume(headerEnd + 4);
            pendingHead = parsed.value;
          }

          if (buffer.length < pendingHead.contentLength) return;
          const requestHead = pendingHead;
          const bodyBytes = buffer.take(requestHead.contentLength);
          pendingHead = null;
          const body = decodeStrictUtf8(bodyBytes);
          if (body === null) {
            writePlan(socket, jsonPlan(400, {
              error: {
                code: 'invalid_payload',
                message: MCP_PAYLOAD_READ_FAILED
              }
            }), true);
            closeSocket();
            return;
          }

          let plan: ResponsePlan;
          try {
            plan = await router.handle({
              method: requestHead.method,
              url: requestHead.url,
              headers: requestHead.headers,
              body
            });
          } catch (err) {
            if (closed) return;
            log.error('MCP net request failed', {
              message: errorMessage(err, MCP_TOOL_EXECUTION_FAILED)
            });
            writePlan(socket, jsonPlan(500, {
              error: {
                code: 'unknown',
                message: MCP_TOOL_EXECUTION_FAILED
              }
            }), true);
            closeSocket();
            return;
          }
          if (closed) {
            if (plan.kind === 'sse') plan.onCancel?.();
            return;
          }
          let sseState: 'pending' | 'opened' | 'cancelled' | null = null;
          let cancelSse: (() => void) | undefined;
          let openSse: ((conn: SseConnection) => void | (() => void)) | undefined;
          if (plan.kind === 'sse' && plan.onCancel) {
            sseState = 'pending';
            cancelSse = () => {
              if (sseState !== 'pending') return;
              sseState = 'cancelled';
              if (cancelPendingSse === cancelSse) cancelPendingSse = null;
              plan.onCancel?.();
            };
            openSse = (conn) => {
              if (sseState !== 'pending') {
                conn.close();
                return undefined;
              }
              sseState = 'opened';
              if (cancelPendingSse === cancelSse) cancelPendingSse = null;
              try {
                return plan.onOpen?.(conn);
              } catch (err) {
                plan.onCancel?.();
                conn.close();
                return undefined;
              }
            };
            cancelPendingSse = cancelSse;
          }
          try {
            const wroteResponse = writePlan(
              socket,
              plan,
              requestHead.shouldClose,
              openSse,
              () => !closed
            );
            if (!wroteResponse) {
              cancelSse?.();
              closeSocket();
              return;
            }
          } catch (err) {
            cancelSse?.();
            log.error('MCP net response failed', {
              message: errorMessage(err, MCP_TOOL_EXECUTION_FAILED)
            });
            closeSocket();
            return;
          }
          if (sseState === 'pending') cancelSse?.();
          if (plan.kind === 'sse') {
            clearRequestDeadline();
            buffer.clear();
            if (plan.close) {
              closed = true;
            } else {
              handedOff = true;
            }
            return;
          }
          if (requestHead.shouldClose) {
            closeSocket();
            return;
          }
          armRequestDeadline();
        }
      } finally {
        processing = false;
      }
    };

    socket.on('data', (chunk: Buffer) => {
      if (closed || handedOff) return;
      if (
        buffer.length + chunk.length >
        TRANSPORT_MAX_PAYLOAD_BYTES + MCP_HTTP_MAX_HEADER_BYTES
      ) {
        closeSocket();
        return;
      }
      buffer.append(chunk);
      if (!pendingHead) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (
          (headerEnd < 0 && buffer.length > MCP_HTTP_MAX_HEADER_BYTES) ||
          (headerEnd >= 0 && headerEnd + 4 > MCP_HTTP_MAX_HEADER_BYTES)
        ) {
          closeSocket();
          return;
        }
      }
      processBuffer();
    });

    socket.on('error', (err: unknown) => {
      log.warn('MCP net socket error', { message: errorMessage(err) });
      closeSocket();
    });

    socket.on('close', () => {
      closed = true;
      cancelPendingSse?.();
      cancelPendingSse = null;
      clearRequestDeadline();
      buffer.clear();
    });
  });

  let startSettled = false;
  let resolveReady: () => void = () => undefined;
  let rejectReady: (err: unknown) => void = () => undefined;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  server.on('error', (err: unknown) => {
    log.error('MCP net server error', { message: errorMessage(err) });
    if (!startSettled) {
      startSettled = true;
      rejectReady(err);
    }
  });
  server.maxConnections = MCP_MAX_TRANSPORT_CONNECTIONS;

  try {
    server.listen(config.port, config.host, () => {
      if (!startSettled) {
        startSettled = true;
        resolveReady();
      }
      log.info('MCP server started (net)', { host: config.host, port: config.port });
    });
  } catch (err) {
    startSettled = true;
    rejectReady(err);
  }

  let stopped = false;
  return {
    ready,
    stop: () => {
      if (stopped) return;
      stopped = true;
      server.close();
      log.info('MCP server stopped (net)');
    }
  };
};
