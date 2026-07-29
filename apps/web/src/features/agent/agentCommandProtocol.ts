import manifest from '../../../agent-manifest.json';

export const agentCommandProtocol = {
  workbench: manifest.workbench,
  href: manifest.href,
  inputAttribute: manifest.domBridge.input.attribute,
  resultAttribute: manifest.domBridge.result.attribute
} as const;
