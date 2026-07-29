import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  type ProjectDocument,
  type Revision
} from '../model';

export interface CreateProjectDocumentInput {
  id: string;
  name: string;
  revision: Revision;
  createdAt: string;
  textureResolution: number;
}

const requiredText = (value: string, label: string): string => {
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(`${label} is required.`);
  return normalized;
};

const textureResolution = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 1 || value > 8192) {
    throw new Error('Texture resolution must be an integer from 1 to 8192.');
  }
  return value;
};

export const createProjectDocument = ({
  id,
  name,
  revision,
  createdAt,
  textureResolution: requestedResolution
}: CreateProjectDocumentInput): ProjectDocument => {
  const timestamp = requiredText(createdAt, 'Creation timestamp');
  const resolution = textureResolution(requestedResolution);
  return {
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    id: requiredText(id, 'Project ID'),
    name: requiredText(name, 'Project name'),
    revision: requiredText(revision, 'Project revision'),
    formatProfile: {
      id: 'ashfox.generic',
      version: '1'
    },
    settings: {
      textureResolution: {
        width: resolution,
        height: resolution
      },
      uvPixelsPerUnit: 0.25,
      coordinateSystem: {
        up: 'y',
        handedness: 'right',
        unit: 'pixel',
        rotationUnit: 'degree',
        rotationOrder: 'xyz'
      }
    },
    scene: {
      roots: [],
      nodes: {}
    },
    textures: {},
    animations: {},
    createdAt: timestamp,
    updatedAt: timestamp
  };
};
