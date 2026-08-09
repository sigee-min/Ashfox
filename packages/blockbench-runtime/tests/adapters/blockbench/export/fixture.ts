export type TestGlobals = {
  Blockbench?: unknown;
  Formats?: unknown;
  ModelFormat?: unknown;
  Codecs?: unknown;
};

const getGlobals = (): TestGlobals => globalThis as unknown as TestGlobals;

export const withGlobals = (overrides: TestGlobals, run: () => void) => {
  const globals = getGlobals();
  const before = {
    Blockbench: globals.Blockbench,
    Formats: globals.Formats,
    ModelFormat: globals.ModelFormat,
    Codecs: (globals as TestGlobals).Codecs
  };
  globals.Blockbench = overrides.Blockbench;
  globals.Formats = overrides.Formats;
  globals.ModelFormat = overrides.ModelFormat;
  (globals as TestGlobals).Codecs = overrides.Codecs;
  try {
    run();
  } finally {
    globals.Blockbench = before.Blockbench;
    globals.Formats = before.Formats;
    globals.ModelFormat = before.ModelFormat;
    (globals as TestGlobals).Codecs = before.Codecs;
  }
};

export const withGlobalsAsync = async (overrides: TestGlobals, run: () => Promise<void>) => {
  const globals = getGlobals();
  const before = {
    Blockbench: globals.Blockbench,
    Formats: globals.Formats,
    ModelFormat: globals.ModelFormat,
    Codecs: (globals as TestGlobals).Codecs
  };
  globals.Blockbench = overrides.Blockbench;
  globals.Formats = overrides.Formats;
  globals.ModelFormat = overrides.ModelFormat;
  (globals as TestGlobals).Codecs = overrides.Codecs;
  try {
    await run();
  } finally {
    globals.Blockbench = before.Blockbench;
    globals.Formats = before.Formats;
    globals.ModelFormat = before.ModelFormat;
    (globals as TestGlobals).Codecs = before.Codecs;
  }
};
