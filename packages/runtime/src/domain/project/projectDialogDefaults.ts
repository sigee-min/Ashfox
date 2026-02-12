type DialogDefaultsInput = {
  formatId: string | null;
  name: string;
};

export const buildProjectDialogDefaults = (input: DialogDefaultsInput): Record<string, unknown> => {
  const defaults: Record<string, unknown> = {};
  const { formatId } = input;
  if (formatId) {
    defaults.format = formatId;
  }
  return defaults;
};
