import manifest from '../../../agent-manifest.json';

export const agentCommandProtocol = {
  href: manifest.href,
  inputAttribute: manifest.domBridge.input.attribute,
  resultAttribute: manifest.domBridge.result.attribute
} as const;
