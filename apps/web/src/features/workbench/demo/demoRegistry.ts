import {
  AETHER_SPEAR_ROCKET_DEMO
} from './aetherSpearRocket';
import {
  ASHFOX_EMBER_SENTINEL_DEMO
} from './ashfoxEmberSentinel';
import {
  createDemoHistory,
  type DemoDefinition
} from './demoFactory';
import {
  ECLIPSE_CATHEDRAL_WYRM_DEMO
} from './eclipseCathedralWyrm';
import {
  FORGEHEART_NOMAD_DEMO
} from './forgeheartNomad';
import {
  IRONROOT_TRACTOR_DEMO
} from './ironrootTractor';
import {
  KINGS_RANSOM_MIMIC_DEMO
} from './kingsRansomMimic';
import {
  MOSSBACK_BELLWALKER_DEMO
} from './mossbackBellwalker';
import {
  MOONVEIL_KIRIN_DEMO
} from './moonveilKirin';

export const DEMO_DEFINITIONS = [
  MOONVEIL_KIRIN_DEMO,
  IRONROOT_TRACTOR_DEMO,
  AETHER_SPEAR_ROCKET_DEMO,
  KINGS_RANSOM_MIMIC_DEMO,
  ASHFOX_EMBER_SENTINEL_DEMO,
  MOSSBACK_BELLWALKER_DEMO,
  FORGEHEART_NOMAD_DEMO,
  ECLIPSE_CATHEDRAL_WYRM_DEMO
] as const;

export const DEFAULT_DEMO = MOONVEIL_KIRIN_DEMO;

export const resolveDemoDefinition = (
  search: string
): DemoDefinition | null => {
  const slug = new URLSearchParams(search).get('demo');
  return DEMO_DEFINITIONS.find(
    (definition) => definition.slug === slug
  ) ?? null;
};

export const createDefaultDemoHistory = () =>
  createDemoHistory(DEFAULT_DEMO);
