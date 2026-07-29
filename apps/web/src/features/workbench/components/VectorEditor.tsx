import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent
} from 'react';

import type { Vec3 } from '@ashfox/engine-core';

import { roundProjectValue } from '../presentation/nodePresentation';

const AXES = [
  { label: 'X', className: 'axis-x' },
  { label: 'Y', className: 'axis-y' },
  { label: 'Z', className: 'axis-z' }
] as const;

interface VectorEditorProps {
  label: string;
  value: Vec3;
  step: number;
  onChange: (value: Vec3) => void;
}

interface AxisInputProps {
  label: string;
  step: number;
  value: number;
  onCommit: (value: number) => void;
}

const formattedValue = (value: number): string =>
  String(roundProjectValue(value));

function AxisInput({
  label,
  step,
  value,
  onCommit
}: AxisInputProps) {
  const [draft, setDraft] = useState(() => formattedValue(value));
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) setDraft(formattedValue(value));
  }, [value]);

  const commit = (): void => {
    if (!editingRef.current) return;
    editingRef.current = false;
    const number = Number(draft);
    if (draft.trim().length === 0 || !Number.isFinite(number)) {
      setDraft(formattedValue(value));
      return;
    }
    setDraft(formattedValue(number));
    if (number !== value) onCommit(number);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
      return;
    }
    if (event.key === 'Escape') {
      editingRef.current = false;
      setDraft(formattedValue(value));
      event.currentTarget.blur();
    }
  };

  return (
    <input
      aria-label={label}
      type="number"
      step={step}
      value={draft}
      onFocus={() => {
        editingRef.current = true;
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
    />
  );
}

export function VectorEditor({
  label,
  value,
  step,
  onChange
}: VectorEditorProps) {
  return (
    <div className="vector-editor">
      <div className="field-label">{label}</div>
      <div className="vector-inputs">
        {AXES.map((axis, index) => (
          <label className="axis-input" key={axis.label}>
            <span className={axis.className}>{axis.label}</span>
            <AxisInput
              label={`${label} ${axis.label}`}
              step={step}
              value={roundProjectValue(value[index])}
              onCommit={(number) => {
                const next = [...value] as [number, number, number];
                next[index] = number;
                onChange(next);
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
