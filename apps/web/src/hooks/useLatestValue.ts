import { useRef } from 'react';

export const useLatestValue = <T>(value: T) => {
  const ref = useRef(value);
  ref.current = value;
  return ref;
};
