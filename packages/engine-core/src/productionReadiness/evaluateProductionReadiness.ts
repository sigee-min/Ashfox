import type { ProjectDocument } from '../model';
import {
  validateProjectDocument,
  type InvariantFinding,
  type ValidationReport
} from '../validation';
import { evaluateAnimationReadiness } from './animationReadiness';
import { evaluateGeometryReadiness } from './geometryReadiness';
import { evaluateIntentReadiness } from './intentReadiness';
import type {
  ProductionReadinessReport
} from './types';

const structuralBlockers = (
  report: ValidationReport
): readonly InvariantFinding[] =>
  report.findings.filter(
    (finding) =>
      finding.severity === 'error' || finding.severity === 'warning'
  );

const severityCount = (
  report: ValidationReport,
  severity: InvariantFinding['severity']
): number =>
  report.findings.filter(
    (finding) => finding.severity === severity
  ).length;

export const evaluateProductionReadiness = (
  document: ProjectDocument,
  validationReport: ValidationReport = validateProjectDocument(document)
): ProductionReadinessReport => {
  const geometry = evaluateGeometryReadiness(document);
  const animation = evaluateAnimationReadiness(
    document,
    geometry.visibleNodeIds
  );
  const intent = evaluateIntentReadiness(document);
  const findings = [
    ...geometry.findings,
    ...animation.findings,
    ...intent.findings
  ];
  const blockers = structuralBlockers(validationReport);
  return {
    structurallyValid: validationReport.valid,
    mechanicallyReady:
      validationReport.valid &&
      blockers.length === 0 &&
      findings.length === 0,
    semanticReviewRequired: true,
    counts: {
      structuralErrors: severityCount(validationReport, 'error'),
      structuralWarnings: severityCount(validationReport, 'warning'),
      ...geometry.counts,
      ...animation.counts,
      ...intent.counts
    },
    findings,
    firstBlockingFinding:
      blockers.find((finding) => finding.severity === 'error') ??
      findings[0] ??
      blockers[0] ??
      null
  };
};
