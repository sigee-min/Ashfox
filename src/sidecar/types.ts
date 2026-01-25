export type SidecarLaunchConfig = {
  host: string;
  port: number;
  path: string;
  execPath?: string;
  toolProfile?: 'full' | 'texture_minimal';
};
