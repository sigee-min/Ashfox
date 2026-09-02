/** Reserved for synchronous command-local, non-persisted evidence. */
export interface CommandExecutionContext {}

export const createCommandExecutionContext = (): CommandExecutionContext => ({});
