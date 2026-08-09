import type { OperationLeaseToken } from '../../../application/operationLease';

interface ExecuteLeasedOperationInput<Result> {
  lease: OperationLeaseToken;
  start: () => void;
  cleanup: () => void;
  complete: () => void;
  execute: () => Promise<Result>;
  failure: (error: unknown) => Result;
}

export const executeLeasedOperation = async <Result>({
  lease,
  start,
  cleanup,
  complete,
  execute,
  failure
}: ExecuteLeasedOperationInput<Result>): Promise<Result> => {
  start();
  try {
    return await Promise.resolve().then(execute);
  } catch (error) {
    return failure(error);
  } finally {
    cleanup();
    lease.release();
    complete();
  }
};
