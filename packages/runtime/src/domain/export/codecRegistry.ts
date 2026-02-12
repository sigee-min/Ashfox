import { ok, fail, type DomainResult } from '../result';
import type { NonGltfExportFormat } from './types';
import type { ExportCodecStrategy } from './codecs/types';
import { GeckoGeoAnimCodec } from './codecs/geckoGeoAnimCodec';

export class CodecRegistry {
  private readonly strategies = new Map<NonGltfExportFormat, ExportCodecStrategy>();

  constructor(strategies?: ExportCodecStrategy[]) {
    const defaults: ExportCodecStrategy[] = [new GeckoGeoAnimCodec()];
    for (const strategy of strategies ?? defaults) {
      this.strategies.set(strategy.format, strategy);
    }
  }

  resolve(format: NonGltfExportFormat): DomainResult<ExportCodecStrategy> {
    const strategy = this.strategies.get(format);
    if (!strategy) {
      return fail(
        'unsupported_format',
        `Export codec is not registered: ${format}`,
        { format }
      );
    }
    return ok(strategy);
  }
}
