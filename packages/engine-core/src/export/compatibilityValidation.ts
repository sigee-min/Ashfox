import type { ExportAdaptedDocument } from './adapter';
import type {
  InvariantFinding
} from '../validation/types';
import {
  exportCompatibilityFor,
  exportCompatibilityOptions,
  type ExportPreset,
  type MinecraftGameVersion
} from './compatibility';

const supportedGameVersionText = (
  target: ExportPreset
): string =>
  exportCompatibilityOptions(target)
    .flatMap(({ gameVersion }) =>
      gameVersion === null ? [] : [gameVersion]
    )
    .join(' | ');

export const validateExportCompatibilityProfile = (
  document: ExportAdaptedDocument
): readonly InvariantFinding[] => {
  const findings: InvariantFinding[] = [];
  const profile = document.formatProfile;
  const unsupportedGameVersion = (
    target: ExportPreset,
    value: unknown,
    path: string
  ): void => {
    findings.push({
      code: 'format.unsupported_data',
      severity: 'error',
      message:
        `Game version "${String(value)}" is not supported by ${target}.`,
      path,
      fix:
        `Use one curated version: ${supportedGameVersionText(target)}.`
    });
  };

  if (profile.id === 'minecraft.java_block') {
    const compatibility = exportCompatibilityFor(
      'java_block',
      profile.minecraftVersion as MinecraftGameVersion
    );
    if (!compatibility) {
      unsupportedGameVersion(
        'java_block',
        profile.minecraftVersion,
        'formatProfile.minecraftVersion'
      );
      return findings;
    }
    if (
      profile.resourcePackFormat !==
      compatibility.profile.resourcePackFormat
    ) {
      findings.push({
        code: 'format.unsupported_data',
        severity: 'error',
        message:
          `Java ${profile.minecraftVersion} requires resource pack format ` +
          `${compatibility.profile.resourcePackFormat}.`,
        path: 'formatProfile.resourcePackFormat'
      });
    }
    return findings;
  }

  if (profile.id === 'minecraft.bedrock') {
    const compatibility = exportCompatibilityFor(
      'bedrock',
      profile.minecraftVersion as MinecraftGameVersion
    );
    if (!compatibility) {
      unsupportedGameVersion(
        'bedrock',
        profile.minecraftVersion,
        'formatProfile.minecraftVersion'
      );
      return findings;
    }
    for (const [path, actual, expected] of [
      [
        'formatProfile.geometryFormatVersion',
        profile.geometryFormatVersion,
        compatibility.profile.geometryFormatVersion
      ],
      [
        'formatProfile.animationFormatVersion',
        profile.animationFormatVersion,
        compatibility.profile.animationFormatVersion
      ]
    ] as const) {
      if (actual === expected) continue;
      findings.push({
        code: 'format.unsupported_data',
        severity: 'error',
        message:
          `Bedrock ${profile.minecraftVersion} requires format version ${expected}.`,
        path
      });
    }
    return findings;
  }

  if (profile.id !== 'minecraft.java.geckolib5') {
    return findings;
  }

  const compatibility = exportCompatibilityFor(
    'geckolib5',
    profile.minecraftVersion as MinecraftGameVersion
  );
  if (!compatibility) {
    unsupportedGameVersion(
      'geckolib5',
      profile.minecraftVersion,
      'formatProfile.minecraftVersion'
    );
    return findings;
  }
  for (const [path, actual, expected] of [
    [
      'formatProfile.version',
      profile.version,
      compatibility.profile.version
    ],
    [
      'formatProfile.geometryFormatVersion',
      profile.geometryFormatVersion,
      compatibility.profile.geometryFormatVersion
    ],
    [
      'formatProfile.animationFormatVersion',
      profile.animationFormatVersion,
      compatibility.profile.animationFormatVersion
    ]
  ] as const) {
    if (actual === expected) continue;
    findings.push({
      code: 'format.unsupported_data',
      severity: 'error',
      message:
        `GeckoLib 5 on Java ${profile.minecraftVersion} requires ` +
        `format version ${expected}.`,
      path
    });
  }
  return findings;
};
