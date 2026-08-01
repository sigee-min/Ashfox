import {
  readProjectArchive,
  type ProjectArchiveFile
} from '../../files/projectArchive';

const MAX_GALLERY_PROJECT_BYTES = 64 * 1024 * 1024;
const GALLERY_PROJECT_PATH =
  /^\/demos\/[a-z0-9]+(?:-[a-z0-9]+)*\/project\.ashfox$/;

export const resolveGalleryProjectUrl = (
  search: string,
  origin: string
): string | null => {
  const requested = new URLSearchParams(search).get('project');
  if (!requested) return null;
  let originUrl: URL;
  let projectUrl: URL;
  try {
    originUrl = new URL(origin);
    projectUrl = new URL(requested, originUrl);
  } catch {
    return null;
  }
  if (
    projectUrl.origin !== originUrl.origin ||
    projectUrl.search.length > 0 ||
    projectUrl.hash.length > 0 ||
    !GALLERY_PROJECT_PATH.test(projectUrl.pathname)
  ) {
    return null;
  }
  return projectUrl.toString();
};

export const loadGalleryProject = async (
  url: string,
  signal: AbortSignal
): Promise<ProjectArchiveFile> => {
  const response = await fetch(url, {
    cache: 'default',
    credentials: 'same-origin',
    signal
  });
  if (!response.ok) {
    throw new Error(`Demo project request failed (${response.status}).`);
  }
  const declaredLength = Number(response.headers.get('content-length'));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_GALLERY_PROJECT_BYTES
  ) {
    throw new Error('Demo project exceeds the 64 MB limit.');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_GALLERY_PROJECT_BYTES) {
    throw new Error('Demo project is empty or exceeds the 64 MB limit.');
  }
  return readProjectArchive(bytes);
};
