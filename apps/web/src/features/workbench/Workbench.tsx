'use client';

import {
  useCallback,
  useMemo,
  useReducer,
  useState
} from 'react';
import type { TransformControlsMode } from 'three/addons/controls/TransformControls.js';

import { validateProjectDocument } from '@ashfox/engine-core';

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
} from './persistence/localProjectRecord';
import { useLocalProjectPersistence } from './persistence/useLocalProjectPersistence';
import { useProjectFileActions } from '../files/useProjectFileActions';
import type { ProjectArchiveFile } from '../files/projectArchive';
import {
  useAgentCommandPort
} from '../agent/useAgentCommandPort';
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
} from './state/historyReducer';
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
  createNewProjectDocument,
  type NewProjectInput
} from './newProject';
import type {
  CameraCommand,
  ViewportOptions,
  ViewportStats
} from './viewport/viewportTypes';

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

  const createProject = useCallback((input: NewProjectInput): void => {
    const createdAt = new Date().toISOString();
    const nextDocument = createNewProjectDocument(input, {
      id: `project-${crypto.randomUUID()}`,
      createdAt
    });
    dispatchProject({
      type: 'replace',
      record: createLocalProjectRecord({
        document: nextDocument,
        assets: {},
        activity: [],
        savedAt: createdAt
      })
    });
    dispatchView({ type: 'node.select', nodeId: null });
    dispatchView({ type: 'clip.select', clipId: null });
    dispatchView({ type: 'overlay.set', overlay: null });
    setPlaying(false);
    setPlayhead(0);
  }, [setPlayhead, setPlaying]);

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
    onLoad: loadProject
  });
  const {
    renameProject,
    generateMinecraftTexture,
    exportProject,
    commitNodeTransform,
    updateTransformProperty,
    toggleVisibility,
    addCube,
    undo,
    redo
  } = useWorkbenchProjectCommands({
    document,
    historySerial: history.serial,
    selectedNodeId,
    dispatch,
    onSelectNode: selectNode,
    exportTargetFile: projectFiles.exportTarget
  });
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

  const agentStatus = useAgentCommandPort({
    document,
    commandOutcome: history.lastCommandOutcome,
    selectedNodeId,
    report,
    dispatch,
    onFocusEntity: selectNode
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
        onRenameProject={renameProject}
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
        onGenerateMinecraftTexture={generateMinecraftTexture}
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
        activeOverlay={activeOverlay}
        onEnvironmentChange={setEnvironment}
        onOverlayChange={setActiveOverlay}
        onSelectNode={selectNode}
        onAddCube={addCube}
        onToggleVisibility={toggleVisibility}
        onTransformProperty={updateTransformProperty}
        onCommitTransform={commitNodeTransform}
        onStats={setViewportStats}
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
