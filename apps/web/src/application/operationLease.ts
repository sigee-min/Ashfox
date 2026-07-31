export interface OperationLeaseToken {
  readonly owner: string;
  release: () => void;
}

export interface OperationLease {
  tryAcquire: (owner: string) => OperationLeaseToken | null;
  isActive: (token: OperationLeaseToken) => boolean;
  currentOwner: () => string | null;
}

export const createOperationLease = (): OperationLease => {
  let active: OperationLeaseToken | null = null;

  return {
    tryAcquire: (owner) => {
      if (active !== null) return null;
      let released = false;
      const token: OperationLeaseToken = {
        owner,
        release: () => {
          if (released) return;
          released = true;
          if (active === token) active = null;
        }
      };
      active = token;
      return token;
    },
    isActive: (token) => active === token,
    currentOwner: () => active?.owner ?? null
  };
};
