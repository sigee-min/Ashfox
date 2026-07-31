'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from 'react';
import type { TransformControlsMode } from 'three/addons/controls/TransformControls.js';

import {
  analyzeAnimationPreview,
  validateProjectDocument
} from '@ashfox/engine-core';

import {
  BottomWorkspace
} from './components/BottomWorkspace';
import {
  ViewportWorkspace
} from './components/ViewportWorkspace';
import { WorkbenchHeader } from './components/WorkbenchHeader';
import { WorkbenchToolbar } from './components/WorkbenchToolbar';
import { useAnimationPlayback } from './hooks/useAnimationPlayback';
import {
  useWorkbenchProjectCommands
} from './hooks/useWorkbenchProjectCommands';
import { useWorkbenchShortcuts } from './hooks/useWorkbenchShortcuts';
import {
  createLocalProjectRecord,
  type LocalProjectRecord
} from '../../application/localProjectRecord';
import { useLocalProjectPersistence } from './persistence/useLocalProjectPersistence';
import { useProjectFileActions } from '../files/useProjectFileActions';
import type { ProjectArchiveFile } from '../files/projectArchive';
import {
  useAgentCommandPort
} from '../agent/useAgentCommandPort';
import {
  advanceCycleObservation,
  createCycleObservation,
  cyclePresentationTimeoutMs,
  type CycleObservation
} from '../agent/cycleObservation';
import type {
  PresentRequest,
  PresentResult
} from '../agent/types';
import { agentCommandProtocol } from '../agent/agentCommandProtocol';
import {
  resolveDemoDefinition
} from './demo/demoRegistry';
import {
  createDemoHistory
} from './demo/demoFactory';
import {
  createHistoryState,
  type HistoryAction
} from '../../application/historyReducer';
import {
  createProjectSessionState,
  projectSessionReducer
} from './state/projectSessionReducer';
import {
  resolveActiveClipId,
  resolveSelectedNodeId
} from './state/workbenchSelection';
import {
  createWorkbenchViewState,
  workbenchViewReducer
} from './state/workbenchViewState';
import {
  createBlankWorkbenchProject,
  type NewProjectInput
} from './newProject';
import type {
  CameraCommand,
  ViewportOptions,
  ViewportPresentationFrame,
  ViewportStats
} from './viewport/viewportTypes';

const FRAME_PRESENTATION_TIMEOUT_MS = 5_000;

export function Workbench() {
  const initialProject = useMemo(
    () => {
      const search =
        typeof window === 'undefined' ? '' : window.location.search;
      const definition = resolveDemoDefinition(search);
      return {
        definition,
        history: definition
          ? createDemoHistory(definition)
          : createHistoryState(
              createBlankWorkbenchProject(new Date().toISOString())
            ),
        isShowcase: definition !== null
      };
    },
    []
  );
  const [project, dispatchProject] = useReducer(
    projectSessionReducer,
    initialProject,
    ({ history, isShowcase }) =>
      createProjectSessionState(
        history,
        {},
        !isShowcase
      )
  );
  const initialDemo = initialProject.definition;
  const { history, assets, storage } = project;
  const document = history.present;
  const [view, dispatchView] = useReducer(
    workbenchViewReducer,
    initialDemo,
    () => createWorkbenchViewState(
      initialDemo?.initialSelectionId ?? null,
      Object.keys(initialProject.history.present.animations)[0] ?? null
    )
  );
  const {
    preferredNodeId,
    preferredClipId,
    transformMode,
    snapEnabled,
    viewportOptions,
    environment,
    cameraCommand,
    activeOverlay,
    bottomMode
  } = view;
  const [viewportStats, setViewportStats] = useState<ViewportStats>({
    calls: 0,
    triangles: 0
  });
  const [presentationNonce, setPresentationNonce] = useState(0);
  const nextPresentationNonceRef = useRef(0);
  const currentDocumentRevisionRef = useRef(document.revision);
  currentDocumentRevisionRef.current = document.revision;
  const pendingPresentationRef = useRef<{
    nonce: number;
    timeout: number;
    resolve: (result: PresentResult) => void;
    projectId: string;
    sourceRevision: string;
    mode: PresentRequest['mode'];
    camera: CameraCommand['mode'];
    clipId: string | null;
    timeSeconds: number;
    cycle: CycleObservation | null;
    phase: 'observing' | 'closing';
    previewIssues: ReturnType<typeof analyzeAnimationPreview>;
  } | null>(null);
  const dispatch = useCallback((action: HistoryAction): void => {
    dispatchProject(action);
  }, []);
  const selectNode = useCallback((nodeId: string | null): void => {
    dispatchView({ type: 'node.select', nodeId });
  }, []);
  const setEnvironment = useCallback(
    (nextEnvironment: typeof environment): void => {
      dispatchView({
        type: 'environment.set',
        environment: nextEnvironment
      });
    },
    []
  );
  const setActiveOverlay = useCallback(
    (overlay: typeof activeOverlay): void => {
      dispatchView({ type: 'overlay.set', overlay });
    },
    []
  );
  const setBottomMode = useCallback(
    (mode: typeof bottomMode): void => {
      dispatchView({ type: 'bottom.set', mode });
    },
    []
  );

  const report = useMemo(
    () => validateProjectDocument(document),
    [document]
  );
  const buildCaptureDocuments = useMemo(
    () => [...history.past, document],
    [document, history.past]
  );
  const selectedNodeId = resolveSelectedNodeId(
    document,
    preferredNodeId
  );
  const activeClipId = resolveActiveClipId(
    document,
    preferredClipId
  );
  const activeClip = activeClipId
    ? document.animations[activeClipId]
    : undefined;
  const {
    playhead,
    setPlayhead,
    playing,
    setPlaying
  } = useAnimationPlayback(activeClip);

  const hydrateProject = useCallback((record: LocalProjectRecord): void => {
    dispatchProject({ type: 'hydrate', record });
  }, []);
  const receiveExternalProject = useCallback(
    (record: LocalProjectRecord): void => {
      dispatchProject({ type: 'external', record });
    },
    []
  );
  const { status: storageStatus } = useLocalProjectPersistence({
    enabled: !initialProject.isShowcase,
    projectId: document.id,
    projectGeneration: storage.generation,
    restoreFromStorage: storage.restoreFromStorage,
    document,
    assets,
    activity: history.activity,
    onHydrate: hydrateProject,
    onExternal: receiveExternalProject
  });

  const loadProject = useCallback((project: ProjectArchiveFile): void => {
    const nextDocument = project.document;
    const savedAt = new Date().toISOString();
    dispatchProject({
      type: 'replace',
      record: createLocalProjectRecord({
        document: nextDocument,
        assets: project.assets,
        activity: [],
        savedAt
      })
    });
  }, []);
  const projectFiles = useProjectFileActions({
    document,
    assets,
    commandOutcome: history.lastCommandOutcome,
    dispatch,
    onLoad: loadProject
  });
  const {
    createProject: executeCreateProject,
    updateProjectSettings,
    exportProject,
    commitNodeTransform,
    updateTransformProperty,
    toggleVisibility,
    undo,
    redo
  } = useWorkbenchProjectCommands({
    document,
    selectedNodeId,
    dispatch,
    exportTargetFile: projectFiles.exportTarget
  });
  const createProject = useCallback((input: NewProjectInput): void => {
    executeCreateProject(input);
    dispatchView({ type: 'node.select', nodeId: null });
    dispatchView({ type: 'clip.select', clipId: null });
    dispatchView({ type: 'overlay.set', overlay: null });
    setPlaying(false);
    setPlayhead(0);
  }, [executeCreateProject, setPlayhead, setPlaying]);
  const togglePlayback = useCallback((): void => {
    if (!activeClip) return;
    setPlaying((current) => !current);
  }, [activeClip, setPlaying]);
  const closePanels = useCallback((): void => {
    dispatchView({ type: 'overlay.set', overlay: null });
  }, []);
  const changeTransformMode = useCallback(
    (mode: TransformControlsMode): void => {
      dispatchView({ type: 'transform.set', mode });
    },
    []
  );

  useWorkbenchShortcuts({
    onUndo: undo,
    onRedo: redo,
    onTransformMode: changeTransformMode,
    onTogglePlayback: togglePlayback,
    onClosePanels: closePanels
  });

  const setCamera = useCallback((mode: CameraCommand['mode']): void => {
    dispatchView({ type: 'camera.set', mode });
  }, []);

  const toggleViewportOption = useCallback(
    (option: keyof ViewportOptions): void => {
      dispatchView({ type: 'viewport.toggle', option });
    },
    []
  );

  const changeActiveClip = useCallback(
    (clipId: string | null): void => {
      dispatchView({ type: 'clip.select', clipId });
      setPlayhead(0);
    },
    [setPlayhead]
  );
  const onPresented = useCallback((
    frame: ViewportPresentationFrame
  ): void => {
    const pending = pendingPresentationRef.current;
    if (
      !pending ||
      pending.nonce !== frame.presentationNonce
    ) {
      return;
    }
    const finish = (result: PresentResult): void => {
      pendingPresentationRef.current = null;
      window.clearTimeout(pending.timeout);
      setPresentationNonce(0);
      pending.resolve(result);
    };
    if (
      frame.projectId !== pending.projectId ||
      frame.revision !== pending.sourceRevision
    ) {
      setPlaying(false);
      finish({
        ok: false,
        revision: frame.revision,
        error: {
          code: 'stale_revision',
          path: 'revision',
          expected: pending.sourceRevision
        }
      });
      return;
    }
    if (frame.projectionStatus === 'failed') {
      setPlaying(false);
      finish({
        ok: false,
        revision: frame.revision,
        error: {
          code: 'preview_unavailable',
          path: 'textures',
          expected:
            frame.projectionError ??
            'all viewport textures decoded successfully'
        }
      });
      return;
    }
    if (frame.projectionStatus !== 'ready') return;
    if (
      frame.camera !== pending.camera ||
      frame.clipId !== pending.clipId
    ) {
      return;
    }
    if (pending.mode === 'frame') {
      if (
        frame.playing ||
        Math.abs(frame.timeSeconds - pending.timeSeconds) > 0.000001
      ) {
        return;
      }
      finish({
        ok: true,
        revision: frame.revision,
        data: {
          frameNonce: frame.frameNonce,
          mode: pending.mode,
          camera: frame.camera,
          cameraMatrix: frame.cameraMatrix,
          clipId: frame.clipId,
          playing: frame.playing,
          observedTimeSeconds: frame.timeSeconds,
          completedCycles: 0,
          previewIssues: pending.previewIssues
        }
      });
      return;
    }
    if (pending.phase === 'closing') {
      if (frame.playing) return;
      if (frame.timeSeconds > 0.000001) {
        setPlayhead(0);
        return;
      }
      finish({
        ok: true,
        revision: frame.revision,
        data: {
          frameNonce: frame.frameNonce,
          mode: pending.mode,
          camera: frame.camera,
          cameraMatrix: frame.cameraMatrix,
          clipId: frame.clipId,
          playing: frame.playing,
          observedTimeSeconds: frame.timeSeconds,
          completedCycles: 1,
          previewIssues: pending.previewIssues
        }
      });
      return;
    }
    if (!pending.cycle) return;
    const advanced = advanceCycleObservation(
      pending.cycle,
      frame.timeSeconds
    );
    pending.cycle = advanced.observation;
    if (!frame.playing) {
      if (
        frame.timeSeconds +
          advanced.observation.toleranceSeconds <
            advanced.observation.durationSeconds ||
        !advanced.complete
      ) {
        return;
      }
      pending.phase = 'closing';
      setPlayhead(0);
      return;
    }
    if (!advanced.complete) return;
    pending.phase = 'closing';
    setPlaying(false);
    setPlayhead(0);
  }, [setPlayhead, setPlaying]);

  useEffect(() => () => {
    const pending = pendingPresentationRef.current;
    if (!pending) return;
    pendingPresentationRef.current = null;
    window.clearTimeout(pending.timeout);
    pending.resolve({
      ok: false,
      revision: currentDocumentRevisionRef.current,
      error: {
        code: 'invalid_state',
        path: '$',
        expected: 'mounted viewport'
      }
    });
  }, []);

  const presentAgentView = useCallback(
    (request: PresentRequest): Promise<PresentResult> => {
      const clip = request.clipId === null
        ? null
        : document.animations[request.clipId];
      if (request.clipId !== null && !clip) {
        return Promise.resolve({
          ok: false,
          revision: document.revision,
          error: {
            code: 'not_found',
            path: 'clipId',
            expected: 'existing animation clip ID'
          }
        });
      }
      const timeSeconds = clip
        ? Math.min(request.timeSeconds, clip.durationSeconds)
        : 0;
      const previewIssues = clip
        ? analyzeAnimationPreview(clip)
        : [];
      if (previewIssues.length > 0) {
        return Promise.resolve({
          ok: false,
          revision: document.revision,
          error: {
            code: 'preview_unfaithful',
            path: `animations.${clip?.id ?? ''}`,
            expected: 'animation features supported by the live renderer'
          }
        });
      }
      const previous = pendingPresentationRef.current;
      if (previous) {
        pendingPresentationRef.current = null;
        window.clearTimeout(previous.timeout);
        previous.resolve({
          ok: false,
          revision: document.revision,
          error: {
            code: 'invalid_state',
            path: '$',
            expected: 'one presentation request at a time'
          }
        });
      }
      const nonce = nextPresentationNonceRef.current + 1;
      nextPresentationNonceRef.current = nonce;
      dispatchView({
        type: 'clip.select',
        clipId: clip?.id ?? null
      });
      dispatchView({ type: 'bottom.set', mode: 'animation' });
      dispatchView({ type: 'overlay.set', overlay: null });
      dispatchView({ type: 'camera.set', mode: request.camera });
      setPlayhead(timeSeconds);
      setPlaying(request.mode === 'cycle');
      setPresentationNonce(nonce);
      return new Promise<PresentResult>((resolve) => {
        const timeoutMs = request.mode === 'cycle' && clip
          ? cyclePresentationTimeoutMs(clip.durationSeconds)
          : FRAME_PRESENTATION_TIMEOUT_MS;
        const timeout = window.setTimeout(() => {
          const pending = pendingPresentationRef.current;
          if (!pending || pending.nonce !== nonce) return;
          pendingPresentationRef.current = null;
          resolve({
            ok: false,
            revision: document.revision,
            error: {
              code: 'render_timeout',
              path: '$',
              expected:
                request.mode === 'cycle'
                  ? 'one observed animation cycle and closing frame'
                  : 'a rendered viewport frame within 5 seconds'
            }
          });
          setPlaying(false);
          setPresentationNonce(0);
        }, timeoutMs);
        pendingPresentationRef.current = {
          nonce,
          timeout,
          resolve,
          projectId: document.id,
          sourceRevision: document.revision,
          mode: request.mode,
          camera: request.camera,
          clipId: clip?.id ?? null,
          timeSeconds,
          cycle: clip && request.mode === 'cycle'
            ? createCycleObservation(
                clip.durationSeconds,
                clip.fps
              )
            : null,
          phase: 'observing',
          previewIssues
        };
      });
    },
    [document.animations, document.revision, setPlayhead, setPlaying]
  );

  const agentStatus = useAgentCommandPort({
    document,
    assets,
    activity: history.activity,
    commandOutcomes: history.commandOutcomes,
    selectedNodeId,
    report,
    dispatch,
    onFocusEntity: selectNode,
    onPresent: presentAgentView
  });

  return (
    <main
      className="workbench-shell"
      data-agent-command-port={agentStatus}
      data-ashfox-agent-manifest={agentCommandProtocol.href}
      data-ashfox-revision={document.revision}
      data-ashfox-file-operation={projectFiles.operation.phase}
      data-ashfox-file-kind={projectFiles.operation.kind ?? ''}
      data-ashfox-file-operation-id={projectFiles.operation.operationId}
      onDragOver={(event) => event.preventDefault()}
      onDrop={projectFiles.drop}
    >
      <WorkbenchHeader
        document={document}
        fileOperation={projectFiles.operation}
        artifactFile={projectFiles.artifactFile}
        buildDocuments={buildCaptureDocuments}
        activity={history.activity}
        activeClipId={activeClipId}
        environment={environment}
        cameraMode={cameraCommand.mode}
        captureFile={projectFiles.captureFile}
        onCreateProject={createProject}
        onOpen={projectFiles.open}
        onSave={projectFiles.save}
        onUpdateProject={updateProjectSettings}
        onExport={exportProject}
        onActiveClipChange={changeActiveClip}
        onCapture={projectFiles.captureGif}
        onCancelFileOperation={projectFiles.cancel}
      />
      <WorkbenchToolbar
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        transformMode={transformMode}
        snapEnabled={snapEnabled}
        cameraMode={cameraCommand.mode}
        viewportOptions={viewportOptions}
        onUndo={undo}
        onRedo={redo}
        onTransformMode={changeTransformMode}
        onToggleSnap={() => dispatchView({ type: 'snap.toggle' })}
        onSetCamera={setCamera}
        onToggleViewportOption={toggleViewportOption}
      />
      <ViewportWorkspace
        document={document}
        assets={assets}
        report={report}
        selectedNodeId={selectedNodeId}
        transformMode={transformMode}
        snapEnabled={snapEnabled}
        viewportOptions={viewportOptions}
        environment={environment}
        cameraCommand={cameraCommand}
        viewportStats={viewportStats}
        activeClipId={activeClipId}
        playhead={playhead}
        playing={playing}
        presentationNonce={presentationNonce}
        activeOverlay={activeOverlay}
        onEnvironmentChange={setEnvironment}
        onOverlayChange={setActiveOverlay}
        onSelectNode={selectNode}
        onToggleVisibility={toggleVisibility}
        onTransformProperty={updateTransformProperty}
        onCommitTransform={commitNodeTransform}
        onStats={setViewportStats}
        onPresented={onPresented}
      />
      <BottomWorkspace
        mode={bottomMode}
        document={document}
        activity={history.activity}
        activeClipId={activeClipId}
        activeClip={activeClip}
        playhead={playhead}
        playing={playing}
        storageStatus={storageStatus}
        onModeChange={setBottomMode}
        onActiveClipChange={changeActiveClip}
        onTogglePlayback={togglePlayback}
        onSeek={setPlayhead}
        onSelectNode={selectNode}
      />
    </main>
  );
}
