import { ToolError } from '../types/internal';

export interface HostPort {
  schedulePluginReload(delayMs: number): ToolError | null;
}



