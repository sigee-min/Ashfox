import type { Locale } from '@/lib/i18n';
import enAshfox from '../../content/capabilities/en/ashfox.json';
import enBlockbenchPlugin from '../../content/capabilities/en/blockbench-plugin.json';
import koAshfox from '../../content/capabilities/ko/ashfox.json';
import koBlockbenchPlugin from '../../content/capabilities/ko/blockbench-plugin.json';

export type CapabilityTrack = 'blockbench-plugin' | 'ashfox';

export type CapabilityScopeRow = {
  area: string;
  included: string;
  status: string;
  notes: string;
};

export type CapabilityDeliveryRow = {
  capability: string;
  provided: string;
  completion: string;
  validation: string;
};

export type CapabilityMatrix = {
  scope: {
    heading: string;
    columns: {
      area: string;
      included: string;
      status: string;
      notes: string;
    };
    rows: CapabilityScopeRow[];
  };
  delivery: {
    heading: string;
    columns: {
      capability: string;
      provided: string;
      completion: string;
      validation: string;
    };
    rows: CapabilityDeliveryRow[];
  };
};

const capabilityMatrices: Record<Locale, Record<CapabilityTrack, CapabilityMatrix>> = {
  en: {
    'blockbench-plugin': enBlockbenchPlugin,
    ashfox: enAshfox,
  },
  ko: {
    'blockbench-plugin': koBlockbenchPlugin,
    ashfox: koAshfox,
  },
};

export function getCapabilityMatrix(locale: Locale, track: CapabilityTrack): CapabilityMatrix {
  return capabilityMatrices[locale][track];
}
