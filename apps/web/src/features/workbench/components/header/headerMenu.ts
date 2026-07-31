export type HeaderMenu =
  | 'new'
  | 'project'
  | 'export'
  | 'capture'
  | null;

export type OpenHeaderMenu = Exclude<HeaderMenu, null>;
