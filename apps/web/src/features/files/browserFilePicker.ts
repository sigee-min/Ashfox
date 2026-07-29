const PROJECT_FILE_ACCEPT =
  '.ashfox,application/vnd.ashfox.project+zip,application/zip';
const FOCUS_SETTLE_DELAY_MS = 250;

interface FileSystemFileHandleLike {
  getFile(): Promise<File>;
}

interface FilePickerWindow extends Window {
  showOpenFilePicker?: (options: {
    multiple: boolean;
    types: readonly {
      description: string;
      accept: Readonly<Record<string, readonly string[]>>;
    }[];
  }) => Promise<readonly FileSystemFileHandleLike[]>;
}

let activeSelection: Promise<File | null> | null = null;

const isCancellation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  error.name === 'AbortError';

const selectWithNativePicker = async (
  picker: NonNullable<FilePickerWindow['showOpenFilePicker']>
): Promise<File | null> => {
  try {
    const handles = await picker.call(window, {
      multiple: false,
      types: [{
        description: 'Ashfox project',
        accept: {
          'application/vnd.ashfox.project+zip': ['.ashfox']
        }
      }]
    });
    return handles[0] ? handles[0].getFile() : null;
  } catch (error: unknown) {
    if (isCancellation(error)) return null;
    throw error;
  }
};

const selectWithFileInput = (): Promise<File | null> =>
  new Promise<File | null>((resolve, reject) => {
    const input = window.document.createElement('input');
    let focusTimer: number | undefined;
    let settled = false;

    input.type = 'file';
    input.accept = PROJECT_FILE_ACCEPT;
    input.hidden = true;

    const cleanup = (): void => {
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
      input.removeEventListener('change', onChange);
      input.removeEventListener('cancel', onCancel);
      window.removeEventListener('focus', onFocus, true);
      window.document.removeEventListener('visibilitychange', onVisibility);
      input.remove();
    };

    const settle = (file: File | null): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(file);
    };

    const fail = (error: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const settleAfterDialogCloses = (): void => {
      if (settled) return;
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        settle(input.files?.[0] ?? null);
      }, FOCUS_SETTLE_DELAY_MS);
    };

    function onChange(): void {
      settle(input.files?.[0] ?? null);
    }

    function onCancel(): void {
      settle(null);
    }

    function onFocus(): void {
      settleAfterDialogCloses();
    }

    function onVisibility(): void {
      if (window.document.visibilityState === 'visible') {
        settleAfterDialogCloses();
      }
    }

    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    window.addEventListener('focus', onFocus, true);
    window.document.addEventListener('visibilitychange', onVisibility);
    window.document.body.append(input);

    try {
      input.click();
    } catch (error: unknown) {
      fail(error);
    }
  });

const beginFileSelection = (): Promise<File | null> => {
  const picker = (window as FilePickerWindow).showOpenFilePicker;
  return picker
    ? selectWithNativePicker(picker)
    : selectWithFileInput();
};

export const selectProjectFile = (): Promise<File | null> => {
  if (activeSelection) return activeSelection;

  const selection = beginFileSelection();
  activeSelection = selection;
  const release = (): void => {
    if (activeSelection === selection) activeSelection = null;
  };
  void selection.then(release, release);
  return selection;
};
