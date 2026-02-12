import type { ResolvedExportFormat } from './types';

export const exportRequiresAuthoringFormat = (format: ResolvedExportFormat): boolean => format === 'gecko_geo_anim';
