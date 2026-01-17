import { Dispatcher, ToolResponse } from '../types';
import { ProxyRouter } from '../proxy';
import { Logger } from '../logging';
import { createLineDecoder, encodeMessage } from '../transport/codec';
import {
  PROTOCOL_VERSION,
  SidecarMessage,
  SidecarRequestMessage,
  SidecarResponseMessage
} from '../transport/protocol';

type Readable = {
  on: (event: string, handler: (chunk: any) => void) => void;
  removeListener?: (event: string, handler: (chunk: any) => void) => void;
};

type Writable = {
  write: (data: string) => void;
};

export class SidecarHost {
  private readonly readable: Readable;
  private readonly writable: Writable;
  private readonly dispatcher: Dispatcher;
  private readonly proxy: ProxyRouter;
  private readonly log: Logger;
  private readonly decoder;
  private readonly onData: (chunk: any) => void;

  constructor(readable: Readable, writable: Writable, dispatcher: Dispatcher, proxy: ProxyRouter, log: Logger) {
    this.readable = readable;
    this.writable = writable;
    this.dispatcher = dispatcher;
    this.proxy = proxy;
    this.log = log;
    this.decoder = createLineDecoder(
      (message) => this.handleMessage(message),
      (err) => this.log.error('sidecar ipc decode error', { message: err.message })
    );
    this.onData = (chunk: any) => this.decoder.push(chunk);

    this.readable.on('data', this.onData);
    this.readable.on('error', (err: any) => {
      const messageText = err instanceof Error ? err.message : String(err);
      this.log.error('sidecar ipc stream error', { message: messageText });
    });
    this.readable.on('end', () => this.log.warn('sidecar ipc stream ended'));
  }

  send(message: SidecarMessage) {
    try {
      this.writable.write(encodeMessage(message));
    } catch (err) {
      const messageText = err instanceof Error ? err.message : String(err);
      this.log.error('sidecar ipc send failed', { message: messageText });
    }
  }

  dispose() {
    if (this.readable.removeListener) {
      this.readable.removeListener('data', this.onData);
    }
  }

  private handleMessage(message: SidecarMessage) {
    if (message.type === 'hello') {
      this.send({ type: 'ready', version: PROTOCOL_VERSION, ts: Date.now() });
      return;
    }
    if (message.type !== 'request') return;
    this.handleRequest(message);
  }

  private handleRequest(message: SidecarRequestMessage) {
    if (!message.id) {
      this.log.warn('sidecar request missing id');
      return;
    }
    const mode = message.mode === 'proxy' ? 'proxy' : 'direct';
    let result: ToolResponse<any>;
    try {
      result =
        mode === 'proxy'
          ? (this.proxy.handle as any)(message.tool, message.payload)
          : (this.dispatcher.handle as any)(message.tool, message.payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'handler error';
      const response: SidecarResponseMessage = {
        type: 'response',
        id: message.id,
        ts: Date.now(),
        ok: false,
        error: { code: 'unknown', message: msg }
      };
      this.send(response);
      return;
    }

    const response: SidecarResponseMessage = {
      type: 'response',
      id: message.id,
      ts: Date.now(),
      ok: result.ok,
      data: result.ok ? result.data : undefined,
      error: result.ok ? undefined : result.error
    };
    this.send(response);
  }
}
