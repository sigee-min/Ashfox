import { loadLocalProject } from './indexedDbProjectRepository';
import type {
  LocalProjectRecord,
  ProjectRevisionMessage
} from './localProjectRecord';

const CHANNEL_NAME = 'ashfox-project-revisions';

export const publishLocalRevision = (
  message: ProjectRevisionMessage
): void => {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(message);
    channel.close();
  } catch {}
};

export const subscribeLocalProject = (
  projectId: string,
  onRecord: (record: LocalProjectRecord) => void
): (() => void) => {
  if (typeof BroadcastChannel === 'undefined') return () => undefined;

  let channel: BroadcastChannel;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return () => undefined;
  }
  channel.addEventListener(
    'message',
    (event: MessageEvent<ProjectRevisionMessage>) => {
      if (event.data?.projectId !== projectId) return;
      void loadLocalProject(projectId).then((record) => {
        if (record?.revision === event.data.revision) onRecord(record);
      }).catch(() => undefined);
    }
  );
  return () => channel.close();
};
