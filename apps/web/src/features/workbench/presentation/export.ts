import type {
  ExportAvailabilityViewModel
} from '../exportAvailability';

export interface ExportTriggerViewModel {
  readonly label: string;
  readonly ariaLabel: string;
  readonly blocked: boolean;
}

export const presentExportTrigger = (
  availability: ExportAvailabilityViewModel,
  exporting: boolean
): ExportTriggerViewModel => ({
  label: exporting
    ? 'Exporting…'
    : availability.allowed
      ? 'Export delivery files'
      : 'Export unavailable',
  ariaLabel: availability.allowed
    ? 'Export delivery files'
    : 'Export unavailable; open to review requirements',
  blocked: !availability.allowed
});
