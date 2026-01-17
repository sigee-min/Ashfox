export type FormatDescriptor = { id: string; name?: string };

export interface FormatPort {
  listFormats: () => FormatDescriptor[];
  getActiveFormatId: () => string | null;
}
