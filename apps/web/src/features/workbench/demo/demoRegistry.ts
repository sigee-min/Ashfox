import {
  AETHER_SPEAR_ROCKET_DEMO
} from './aetherSpearRocket';
import {
  createDemoHistory,
  type DemoDefinition
} from './demoFactory';
import {
  IRONROOT_TRACTOR_DEMO
} from './ironrootTractor';
import {
  MOONVEIL_KIRIN_DEMO
} from './moonveilKirin';

export const DEMO_DEFINITIONS = [
  MOONVEIL_KIRIN_DEMO,
  IRONROOT_TRACTOR_DEMO,
  AETHER_SPEAR_ROCKET_DEMO
] as const;

export const DEFAULT_DEMO = MOONVEIL_KIRIN_DEMO;

export const resolveDemoDefinition = (
  search: string
): DemoDefinition => {
  const slug = new URLSearchParams(search).get('demo');
  return DEMO_DEFINITIONS.find(
    (definition) => definition.slug === slug
  ) ?? DEFAULT_DEMO;
};

export const createDefaultDemoHistory = () =>
  createDemoHistory(DEFAULT_DEMO);
