import { FormatDescriptor, FormatPort } from '../../ports/formats';

/* Blockbench globals (provided at runtime). */
declare const ModelFormat: any;

export class BlockbenchFormats implements FormatPort {
  listFormats(): FormatDescriptor[] {
    const modelFormat = (globalThis as any).ModelFormat;
    const formats = (globalThis as any).Formats ?? modelFormat?.formats ?? {};
    if (!formats || typeof formats !== 'object') return [];
    return Object.entries(formats).map(([id, format]) => ({
      id,
      name: (format as any)?.name ?? id
    }));
  }

  getActiveFormatId(): string | null {
    const modelFormat = (globalThis as any).ModelFormat;
    const active = (globalThis as any).Format ?? modelFormat?.selected ?? null;
    return active?.id ?? null;
  }
}
