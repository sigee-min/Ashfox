export type HeaderMenu =
  | 'new'
  | 'export'
  | 'capture'
  | null;

export type OpenHeaderMenu = Exclude<HeaderMenu, null>;
