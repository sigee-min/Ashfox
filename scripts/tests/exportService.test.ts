import assert from 'node:assert/strict';

import { ProjectSession } from '../../src/session';
import { ExportService } from '../../src/usecases/ExportService';
import type { Capabilities, ToolError } from '../../src/types';
import { createEditorStubWithState, createFormatPortStub } from './fakes';
import { EXPORT_FORMAT_MISMATCH, EXPORT_FORMAT_NOT_ENABLED } from '../../src/shared/messages';

type HarnessOptions = {
  capabilities?: Capabilities;
  exportPolicy?: 'strict' | 'best_effort';
  nativeError?: ToolError | null;
  writeFileError?: ToolError | null;
  snapshotOverride?: ReturnType<ProjectSession['snapshot']>;
  ensureActiveError?: ToolError | null;
  listFormats?: Array<{ id: string; name: string }>;
  matchOverrideKind?: () => 'Java Block/Item' | 'geckolib' | 'animated_java' | null;
};

const baseCapabilities = (): Capabilities => ({
  pluginVersion: 'test',
  blockbenchVersion: 'test',
  formats: [
    { format: 'Java Block/Item', animations: true, enabled: true },
    { format: 'geckolib', animations: true, enabled: true },
    { format: 'animated_java', animations: true, enabled: true }
  ],
  limits: { maxCubes: 64, maxTextureSize: 256, maxAnimationSeconds: 120 }
});

const createHarness = (options: HarnessOptions = {}) => {
  const session = new ProjectSession();
  const created = session.create('geckolib', 'dragon', 'geckolib_model');
  assert.equal(created.ok, true);
  const editorStub = createEditorStubWithState();
  const editor = {
    ...editorStub.editor,
    writeFile: (path: string, contents: string) => {
      if (options.writeFileError) return options.writeFileError;
      editorStub.state.writes.push({ path, contents });
      return null;
    }
  };
  const service = new ExportService({
    capabilities: options.capabilities ?? baseCapabilities(),
    editor,
    exporter: {
      exportNative: () => options.nativeError ?? null
    },
    formats:
      options.listFormats === undefined
        ? createFormatPortStub('geckolib_model', 'GeckoLib')
        : {
            listFormats: () => options.listFormats ?? [],
            getActiveFormatId: () => null
          },
    projectState: {
      matchOverrideKind: options.matchOverrideKind ?? (() => null)
    } as never,
    getSnapshot: () => options.snapshotOverride ?? session.snapshot(),
    ensureActive: () => options.ensureActiveError ?? null,
    policies: {
      exportPolicy: options.exportPolicy ?? 'best_effort',
      formatOverrides: undefined
    }
  });
  return { service, writes: editorStub.state.writes, session };
};

{
  const capabilities = baseCapabilities();
  capabilities.formats = [{ format: 'geckolib', animations: true, enabled: false }];
  const { service } = createHarness({ capabilities });
  const res = service.exportModel({ format: 'gecko_geo_anim', destPath: 'out.json' });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.error.code, 'unsupported_format');
    assert.equal(res.error.message, `${EXPORT_FORMAT_NOT_ENABLED('geckolib')}.`);
  }
}

{
  const { service } = createHarness();
  const res = service.exportModel({ format: 'java_block_item_json', destPath: 'out.json' });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.error.code, 'invalid_payload');
    assert.equal(res.error.message, `${EXPORT_FORMAT_MISMATCH}.`);
  }
}

{
  const { service } = createHarness({
    snapshotOverride: {
      ...new ProjectSession().snapshot(),
      id: 'p_override',
      format: null,
      formatId: 'unknown_format'
    }
  });
  const res = service.exportModel({ format: 'gecko_geo_anim', destPath: 'out.json' });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.error.code, 'invalid_payload');
  }
}

{
  const { service } = createHarness({
    snapshotOverride: {
      ...new ProjectSession().snapshot(),
      id: 'p1',
      format: 'geckolib',
      formatId: null,
      name: 'dragon'
    },
    listFormats: []
  });
  const res = service.exportModel({ format: 'gecko_geo_anim', destPath: 'out.json' });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.error.code, 'unsupported_format');
  }
}

{
  const { service } = createHarness({ nativeError: null });
  const res = service.exportModel({ format: 'gecko_geo_anim', destPath: 'out.json' });
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.value.path, 'out.json');
  }
}

{
  const { service } = createHarness({
    exportPolicy: 'strict',
    nativeError: { code: 'not_implemented', message: 'native unavailable' }
  });
  const res = service.exportModel({ format: 'gecko_geo_anim', destPath: 'out.json' });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.error.code, 'not_implemented');
  }
}

{
  const { service, writes } = createHarness({
    exportPolicy: 'best_effort',
    nativeError: { code: 'not_implemented', message: 'native unavailable' }
  });
  const res = service.exportModel({ format: 'gecko_geo_anim', destPath: 'out.json' });
  assert.equal(res.ok, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, 'out.json');
}

{
  const { service, writes } = createHarness({
    exportPolicy: 'best_effort',
    nativeError: { code: 'io_error', message: 'disk failed' }
  });
  const res = service.exportModel({ format: 'gecko_geo_anim', destPath: 'out.json' });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.error.code, 'io_error');
  }
  assert.equal(writes.length, 0);
}

{
  const { service } = createHarness({
    exportPolicy: 'best_effort',
    nativeError: { code: 'unsupported_format', message: 'native unavailable' },
    writeFileError: { code: 'io_error', message: 'write failed' }
  });
  const res = service.exportModel({ format: 'gecko_geo_anim', destPath: 'out.json' });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.error.code, 'io_error');
  }
}

{
  const { service } = createHarness({
    ensureActiveError: { code: 'invalid_state', message: 'no active project' }
  });
  const res = service.exportModel({ format: 'gecko_geo_anim', destPath: 'out.json' });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.error.code, 'invalid_state');
  }
}
