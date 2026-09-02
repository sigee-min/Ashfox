export type HeaderMenu =
  | 'export'
  | 'capture'
  | null;

export type OpenHeaderMenu = Exclude<HeaderMenu, null>;
