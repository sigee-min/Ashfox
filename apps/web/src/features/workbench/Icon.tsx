import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'add'
  | 'bone'
  | 'camera'
  | 'check'
  | 'chevron'
  | 'cube'
  | 'eye'
  | 'eyeOff'
  | 'grid'
  | 'key'
  | 'locator'
  | 'mesh'
  | 'move'
  | 'pause'
  | 'play'
  | 'redo'
  | 'rotate'
  | 'scale'
  | 'search'
  | 'spark'
  | 'texture'
  | 'undo'
  | 'warning'
  | 'wire';

const paths: Record<IconName, ReactNode> = {
  add: <path d="M12 5v14M5 12h14" />,
  bone: (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="m7.5 7.5 9 9M8.5 5.5l10 10" />
    </>
  ),
  camera: (
    <>
      <path d="M4 7h4l2-2h4l2 2h4v11H4z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  cube: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="m4.3 7.5 7.7 4.4 7.7-4.4M12 12v9" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  eyeOff: (
    <>
      <path d="m4 4 16 16M9.5 6.4A9 9 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.1 2.8M6.2 7.7A17 17 0 0 0 2.5 12s3.5 6 9.5 6a9 9 0 0 0 3-.5" />
    </>
  ),
  grid: (
    <>
      <path d="M4 4h16v16H4zM4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16" />
    </>
  ),
  key: (
    <>
      <circle cx="8.5" cy="10.5" r="4" />
      <path d="m11.5 13.5 6.5 6.5M15 17l2-2M17 19l2-2" />
    </>
  ),
  locator: (
    <>
      <circle cx="12" cy="12" r="2.3" />
      <path d="M12 2v7M12 15v7M2 12h7M15 12h7" />
    </>
  ),
  mesh: (
    <>
      <path d="m4 18 3-12 10-2 3 13-9 3zM7 6l4 14M17 4l-6 16M7 6l13 11M4 18l13-14" />
    </>
  ),
  move: (
    <>
      <path d="M12 2v20M2 12h20" />
      <path d="m9 5 3-3 3 3M19 9l3 3-3 3M9 19l3 3 3-3M5 9l-3 3 3 3" />
    </>
  ),
  pause: (
    <>
      <path d="M8 5v14M16 5v14" />
    </>
  ),
  play: <path d="m8 5 11 7-11 7z" />,
  redo: (
    <>
      <path d="m15 5 4 4-4 4" />
      <path d="M19 9h-8a6 6 0 0 0-6 6v2" />
    </>
  ),
  rotate: (
    <>
      <path d="M20 7v5h-5" />
      <path d="M19 12a7 7 0 1 0-2 5" />
    </>
  ),
  scale: (
    <>
      <path d="M5 19 19 5M12 5h7v7M12 19H5v-7" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  spark: (
    <>
      <path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7z" />
      <path d="m19 17 .7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7z" />
    </>
  ),
  texture: (
    <>
      <path d="M4 4h16v16H4z" />
      <path d="m4 15 4-4 3 3 3-3 6 6M15.5 8.5h.01" />
    </>
  ),
  undo: (
    <>
      <path d="m9 5-4 4 4 4" />
      <path d="M5 9h8a6 6 0 0 1 6 6v2" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3 2.8 20h18.4z" />
      <path d="M12 9v5M12 17h.01" />
    </>
  ),
  wire: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9M12 3v9" />
    </>
  )
};

export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
