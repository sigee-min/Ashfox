import { ToolError } from '../types/internal';

export type ExportNativeParams = {
  formatId: string;
  destPath: string;
};

export interface ExportPort {
  exportNative: (params: ExportNativeParams) => ToolError | null;
}



