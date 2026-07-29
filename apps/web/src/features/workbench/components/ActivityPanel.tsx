import type {
  CommandReceipt,
  CommandSource
} from '@ashfox/engine-core';

import { Icon } from '../Icon';

const sourceLabel = (source: CommandSource): string => {
  switch (source) {
    case 'web':
      return 'UI';
    case 'agent':
      return 'AI IDE';
    case 'import':
      return 'Import';
    case 'system':
      return 'System';
  }
};

const affectedEntityCount = (
  receipt: CommandReceipt
): number =>
  receipt.effects.changedEntityIds.length +
  receipt.effects.createdEntityIds.length +
  receipt.effects.removedEntityIds.length;

const firstAffectedEntityId = (
  receipt: CommandReceipt
): string | undefined =>
  receipt.effects.changedEntityIds[0] ??
  receipt.effects.createdEntityIds[0];

interface ActivityPanelProps {
  activity: readonly CommandReceipt[];
  onSelectNode: (nodeId: string) => void;
}

export function ActivityPanel({
  activity,
  onSelectNode
}: ActivityPanelProps) {
  return (
    <div className="activity-main">
      <div className="activity-heading">
        <span>Command receipts</span>
        <small>Newest first · persisted with project</small>
      </div>
      <div className="activity-list">
        {activity.length > 0 ? (
          activity.slice(0, 8).map((receipt) => {
            const entityId = firstAffectedEntityId(receipt);
            const entityCount = affectedEntityCount(receipt);
            return (
              <button
                type="button"
                className="activity-row"
                data-ashfox-command-id={receipt.commandId}
                key={receipt.commandId}
                onClick={() => {
                  if (entityId) onSelectNode(entityId);
                }}
              >
                <span className={`source-badge is-${receipt.source}`}>
                  {sourceLabel(receipt.source)}
                </span>
                <span className="activity-copy">
                  <strong>{receipt.summary}</strong>
                  <small>
                    {new Date(receipt.completedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                    {' · '}
                    {entityCount} {entityCount === 1 ? 'entity' : 'entities'}
                  </small>
                </span>
                <span className="activity-revision">
                  {receipt.beforeRevision}
                  <Icon name="chevron" />
                  {receipt.revision}
                </span>
              </button>
            );
          })
        ) : (
          <div className="activity-empty">
            <Icon name="spark" />
            <strong>No commands yet</strong>
            <span>UI and AI IDE edits will appear here.</span>
          </div>
        )}
      </div>
    </div>
  );
}
