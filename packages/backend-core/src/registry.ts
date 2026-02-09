import type { BackendKind, BackendPort } from './types';

export class BackendRegistry {
  private readonly ports = new Map<BackendKind, BackendPort>();

  register(port: BackendPort): void {
    this.ports.set(port.kind, port);
  }

  resolve(kind: BackendKind): BackendPort | null {
    return this.ports.get(kind) ?? null;
  }

  require(kind: BackendKind): BackendPort {
    const port = this.resolve(kind);
    if (!port) {
      throw new Error(`Backend is not registered: ${kind}`);
    }
    return port;
  }

  listKinds(): BackendKind[] {
    return Array.from(this.ports.keys());
  }
}
