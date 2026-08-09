import type {
  AgentCommandPortStatus
} from '../../agent/AgentCommandPort';

const CONNECTION_LABELS: Readonly<Record<AgentCommandPortStatus, string>> = {
  disconnected: 'AI agent disconnected',
  connecting: 'Connecting AI agent',
  connected: 'AI agent connected',
  working: 'AI agent working'
};

export const presentAgentConnection = (
  status: AgentCommandPortStatus
): string => CONNECTION_LABELS[status];
