import type {
  AuthoringAuthorityReference,
  AuthoringCompatibilityIssue
} from './authoringTypes';
import type { AuthoringPlanIssue } from './authoringPlanTypes';

export interface AuthoringProfileIssue {
  path: string;
  message: string;
  expected: string;
}

export const addAuthoringProfileIssue = (
  issues: AuthoringProfileIssue[],
  path: string,
  message: string,
  expected: string
): void => {
  issues.push({ path, message, expected });
};

export const authoringCompatibilityIssue = (
  code: AuthoringCompatibilityIssue['code'],
  path: string,
  message: string,
  expected: string,
  authority?: AuthoringAuthorityReference
): AuthoringCompatibilityIssue => ({
  code,
  path,
  message,
  expected,
  ...(authority ? { authority } : {})
});

interface AuthoringPlanIssueContext {
  authority?: AuthoringAuthorityReference;
  partIds?: readonly string[];
  clipIds?: readonly string[];
}

export const authoringPlanIssue = (
  code: AuthoringPlanIssue['code'],
  path: string,
  message: string,
  expected: string,
  context: AuthoringPlanIssueContext = {}
): AuthoringPlanIssue => ({
  code,
  path,
  message,
  expected,
  ...(context.authority !== undefined
    ? { authority: context.authority }
    : {}),
  ...(context.partIds !== undefined ? { partIds: context.partIds } : {}),
  ...(context.clipIds !== undefined ? { clipIds: context.clipIds } : {})
});
