import type {
  AgentCommandPortApi
} from '../types';
import {
  agentCommandProtocol
} from '../agentCommandProtocol';

export type DomAgentResponse = readonly [
  requestId: string | null,
  result: unknown
];

interface ConnectDomAgentBridgeInput {
  host: Window;
  api: AgentCommandPortApi;
  execute: (serialized: string) => Promise<DomAgentResponse>;
  currentRevision: () => string;
}

const styleInput = (input: HTMLInputElement): void => {
  Object.assign(input.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '1px',
    height: '1px',
    padding: '0',
    border: '0',
    opacity: '0',
    pointerEvents: 'none'
  });
};

export const connectDomAgentBridge = ({
  host,
  api,
  execute,
  currentRevision
}: ConnectDomAgentBridgeInput): (() => void) => {
  const resultElement = host.document.createElement('meta');
  resultElement.setAttribute(agentCommandProtocol.resultAttribute, '');
  host.document.head.append(resultElement);
  let connected = true;
  let responseQueue = Promise.resolve();
  let input: HTMLInputElement;

  const respond = (
    requestId: string | null,
    result: unknown
  ): void => {
    if (!connected) return;
    resultElement.setAttribute(
      agentCommandProtocol.resultAttribute,
      JSON.stringify({ requestId, result })
    );
  };

  function receive(this: HTMLInputElement): void {
    const source = this;
    const serialized = source.value;
    source.value = '';
    source.blur();
    source.removeEventListener('input', receive);
    source.remove();
    if (connected && source === input) input = createInput();

    responseQueue = responseQueue
      .then(async () => {
        if (!connected) return;
        const [requestId, result] = await execute(serialized);
        if (connected) respond(requestId, result);
      })
      .catch(() => {
        if (!connected) return;
        respond(null, {
          ok: false,
          revision: currentRevision(),
          error: {
            code: 'invalid_state',
            message: 'Agent command could not be completed.'
          }
        });
      });
  }

  function createInput(): HTMLInputElement {
    const next = host.document.createElement('input');
    next.type = 'text';
    next.tabIndex = -1;
    next.setAttribute('aria-hidden', 'true');
    next.setAttribute('role', 'none');
    next.setAttribute(agentCommandProtocol.inputAttribute, '');
    styleInput(next);
    next.addEventListener('input', receive);
    host.document.body.append(next);
    return next;
  }

  host.ashfox = api;
  input = createInput();

  return () => {
    connected = false;
    input.removeEventListener('input', receive);
    input.remove();
    resultElement.remove();
    if (host.ashfox === api) delete host.ashfox;
  };
};
