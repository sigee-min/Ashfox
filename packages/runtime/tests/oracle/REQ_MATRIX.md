# ReqID Trace Matrix (Spec v1)

This matrix maps requirement IDs (ReqIDs) to automated evidence in this repo.

## Authoring Profile / Guard

- SPEC-PRO-001~005:
  - /Users/sigee/Dev/ashfox/packages/runtime/tests/projectCreation.test.ts
  - /Users/sigee/Dev/ashfox/packages/runtime/tests/projectLifecycleService.test.ts

## Export Codec / Fallback

- SPEC-EXP-001~007:
  - /Users/sigee/Dev/ashfox/packages/runtime/tests/exportService.test.ts
  - /Users/sigee/Dev/ashfox/packages/runtime/tests/exporters.test.ts
  - /Users/sigee/Dev/ashfox/packages/runtime/tests/oracleRunner.test.ts (FX-001~006)

- SPEC-EXP-010~014 (gecko_geo_anim sidecar):
  - /Users/sigee/Dev/ashfox/packages/runtime/tests/oracleRunner.test.ts
    - FX-001 (basic geo+anim)
    - FX-002 (triggers)
    - FX-003 (object-form keyframe)
    - FX-006 (fallback export path)

## Animation Meta Preservation

- SPEC-ANM-001~004:
  - /Users/sigee/Dev/ashfox/packages/runtime/tests/oracleRunner.test.ts (FX-003)

## No-Render Profile

- SPEC-DAT-001~004:
  - /Users/sigee/Dev/ashfox/packages/runtime/tests/oracleRunner.test.ts (FX-006)

## Oracle / Acceptance Gates

- ORC-001~004:
  - /Users/sigee/Dev/ashfox/packages/runtime/tests/oracleRunner.test.ts (JSON structural diff + tolerance + time buckets)

- PASS-001~004:
  - /Users/sigee/Dev/ashfox/packages/runtime/tests/oracleRunner.test.ts (FX-001~006, deterministic hash check)
