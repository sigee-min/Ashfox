import { PLUGIN_ID } from '../config';
import type { Capabilities } from '../types';
import type { ReadGlobals, ServerSettings } from './types';

export const registerDebugMenu = (deps: { readGlobals: ReadGlobals; capabilities: Capabilities }) => {
  const globals = deps.readGlobals();
  const blockbench = globals.Blockbench;
  const menuBar = globals.MenuBar;
  if (!blockbench || !menuBar) return;
  const action = {
    id: `${PLUGIN_ID}_debug_capabilities`,
    name: 'bbmcp: show capabilities',
    icon: 'info',
    click: () => {
      blockbench.textPrompt?.('bbmcp capabilities', JSON.stringify(deps.capabilities, null, 2), () => {});
    }
  };
  menuBar.addAction(action, 'help');
};

export const registerDevReloadAction = (deps: { readGlobals: ReadGlobals }) => {
  const globals = deps.readGlobals();
  const blockbench = globals.Blockbench;
  const menuBar = globals.MenuBar;
  const plugins = globals.Plugins;
  if (!blockbench || !menuBar) return;
  const action = {
    id: `${PLUGIN_ID}_dev_reload`,
    name: 'bbmcp: dev reload plugins',
    icon: 'refresh',
    click: () => {
      if (typeof plugins?.devReload === 'function') {
        plugins.devReload();
        blockbench.showQuickMessage?.('bbmcp unloaded', 1200);
      } else {
        blockbench.showQuickMessage?.('Plugins.devReload not available', 1200);
      }
    }
  };
  menuBar.addAction(action, 'help');
};

export const registerInspectorAction = (deps: { readGlobals: ReadGlobals }) => {
  const globals = deps.readGlobals();
  const menuBar = globals.MenuBar;
  const blockbench = globals.Blockbench;
  if (!menuBar || !blockbench) return;
  const action = {
    id: `${PLUGIN_ID}_inspect_plugins`,
    name: 'bbmcp: log plugin state',
    icon: 'search',
    click: () => {
      const plugins = deps.readGlobals().Plugins;
      const path = plugins?.path;
      const registered = plugins?.registered;
      console.log('[bbmcp] Plugins.path', path);
      console.log('[bbmcp] Plugins.registered keys', registered ? Object.keys(registered) : 'n/a');
      blockbench.showQuickMessage?.('Logged plugin state to console.', 1200);
    }
  };
  menuBar.addAction(action, 'help');
};

export const registerServerConfigAction = (deps: {
  readGlobals: ReadGlobals;
  serverConfig: ServerSettings;
  restartServer: () => void;
}) => {
  const globals = deps.readGlobals();
  const menuBar = globals.MenuBar;
  const blockbench = globals.Blockbench;
  if (!menuBar || !blockbench) return;
  const action = {
    id: `${PLUGIN_ID}_server_config`,
    name: 'bbmcp: set MCP endpoint',
    icon: 'settings',
    click: async () => {
      const host = await blockbench.textPrompt?.('MCP host', deps.serverConfig.host, () => {});
      if (typeof host === 'string' && host.length > 0) {
        deps.serverConfig.host = host;
      }
      const portStr = await blockbench.textPrompt?.('MCP port', String(deps.serverConfig.port), () => {});
      const portNum = parseInt(portStr ?? `${deps.serverConfig.port}`, 10);
      if (!Number.isNaN(portNum)) {
        deps.serverConfig.port = portNum;
      }
      const path = await blockbench.textPrompt?.('MCP path', deps.serverConfig.path, () => {});
      if (typeof path === 'string' && path.length > 0) {
        deps.serverConfig.path = path.startsWith('/') ? path : `/${path}`;
      }
      deps.restartServer();
      blockbench.showQuickMessage?.(
        `MCP endpoint: ${deps.serverConfig.host}:${deps.serverConfig.port}${deps.serverConfig.path}`,
        1500
      );
    }
  };
  menuBar.addAction(action, 'help');
};
