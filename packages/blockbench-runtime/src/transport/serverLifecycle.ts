export type TransportServerHandle = {
  stop: () => void;
  ready: Promise<void>;
};
