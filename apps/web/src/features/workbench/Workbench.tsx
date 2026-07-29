'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState
} from 'react';
import type { TransformControlsMode } from 'three/addons/controls/TransformControls.js';

import {
  executeCommandBatch,
  validateProjectDocument,
  type CommandBatch,
  type ProjectDocument,
  type ProjectCommandOperation,
  type Transform,
  type Vec3
} from '@ashfox/engine-core';

import {
  BottomWorkspace,
  type BottomWorkspaceMode
} from './components/BottomWorkspace';
import {
  ViewportWorkspace,
  type ViewportOverlay
} from './components/ViewportWorkspace';
import { WorkbenchHeader } from './components/WorkbenchHeader';
import { WorkbenchToolbar } from './components/WorkbenchToolbar';
import { useAnimationPlayback } from './hooks/useAnimationPlayback';
import { useWorkbenchShortcuts } from './hooks/useWorkbenchShortcuts';
import type { LocalProjectRecord } from './persistence/localProjectRecord';
import { useLocalProjectPersistence } from './persistence/useLocalProjectPersistence';
import { useProjectFileActions } from '../files/useProjectFileActions';
import type { AshfoxProjectFile } from '../files/projectArchive';
import type { ProjectAssets } from '../files/projectAssets';
import {
  useAgentCommandPort
} from '../agent/useAgentCommandPort';
import {
  createWorkbenchProject
} from './sampleProject';
import {
  createHistoryState,
  historyReducer
} from './state/historyReducer';
import type {
  CameraCommand,
  ViewportOptions,
  ViewportStats
} from './viewport/viewportTypes';
import {
  projectUsesExportTarget,
  type ProjectExportTarget
} from './presentation/projectExportTarget';
import {
  createMinecraftTextureOperation
} from '../textures/minecraftTextureCommand';

const INITIAL_SELECTION_ID = 'cube-head';
const LOCAL_ACTOR_ID = 'local-user';

interface ProjectPersistenceSession {
  generation: number;
  restoreFromStorage: boolean;
}

export function Workbench() {
  const [history, dispatch] = useReducer(
    historyReducer,
    undefined,
    () => createHistoryState(createWorkbenchProject())
  );
  const document = history.present;
  const [assets, setAssets] = useState<ProjectAssets>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    INITIAL_SELECTION_ID
  );
  const [transformMode, setTransformMode] =
    useState<TransformControlsMode>('translate');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [viewportOptions, setViewportOptions] = useState<ViewportOptions>({
    showGrid: true,
    showSkeleton: true,
    showWireframe: true
  });
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>({
    mode: 'perspective',
    nonce: 0
  });
  const [renderedRevision, setRenderedRevision] = useState(document.revision);
  const [viewportStats, setViewportStats] = useState<ViewportStats>({
    calls: 0,
    triangles: 0
  });
  const [activeClipId, setActiveClipId] = useState<string | null>(
    Object.keys(document.animations)[0] ?? null
  );
  const [activeOverlay, setActiveOverlay] =
    useState<ViewportOverlay>(null);
  const [bottomMode, setBottomMode] =
    useState<BottomWorkspaceMode>('animation');
  const [persistenceSession, setPersistenceSession] =
    useState<ProjectPersistenceSession>({
      generation: 0,
      restoreFromStorage: true
    });

  const report = useMemo(
    () => validateProjectDocument(document),
    [document]
  );
  const selectedNode = selectedNodeId
    ? document.scene.nodes[selectedNodeId]
    : undefined;
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
    setAssets(record.assets);
    dispatch({ type: 'hydrate', record });
  }, []);
  const receiveExternalProject = useCallback(
    (record: LocalProjectRecord): void => {
      setAssets(record.assets);
      dispatch({ type: 'external', record });
    },
    []
  );
  const { status: storageStatus, lastSavedAt } = useLocalProjectPersistence({
    projectId: document.id,
    projectGeneration: persistenceSession.generation,
    restoreFromStorage: persistenceSession.restoreFromStorage,
    document,
    assets,
    activity: history.activity,
    onHydrate: hydrateProject,
    onExternal: receiveExternalProject
  });

  const loadProject = useCallback((project: AshfoxProjectFile): void => {
    const nextDocument = project.document;
    const savedAt = new Date().toISOString();
    setAssets(project.assets);
    dispatch({
      type: 'hydrate',
      record: {
        schemaVersion: 1,
        projectId: nextDocument.id,
        revision: nextDocument.revision,
        document: nextDocument,
        assets: project.assets,
        activity: [],
        savedAt
      }
    });
    setPersistenceSession((current) => ({
      generation: current.generation + 1,
      restoreFromStorage: false
    }));
  }, []);
  const projectFiles = useProjectFileActions({
    document,
    assets,
    onLoad: loadProject
  });
  const exportTargetFile = projectFiles.exportTarget;

  const execute = useCallback(
    (operations: readonly ProjectCommandOperation[]): void => {
      dispatch({
        type: 'execute',
        batch: {
          batchId: crypto.randomUUID(),
          baseRevision: document.revision,
          operations
        },
        actorId: LOCAL_ACTOR_ID,
        source: 'web',
        committedAt: new Date().toISOString()
      });
    },
    [document.revision]
  );

  const renameProject = useCallback(
    (name: string): void => {
      execute([{
        name: 'project.rename',
        payload: { name }
      }]);
    },
    [execute]
  );

  const generateMinecraftTexture = useCallback((): void => {
    const operation = createMinecraftTextureOperation(document);
    if (!operation) return;
    execute([operation]);
  }, [document, execute]);

  const exportProject = useCallback(
    (target: ProjectExportTarget): void => {
      if (projectUsesExportTarget(document, target)) {
        exportTargetFile(document);
        return;
      }
      const batch: CommandBatch = {
        batchId: crypto.randomUUID(),
        baseRevision: document.revision,
        operations: [{
          name: 'project.target.set',
          payload: target
        }]
      };
      const projected = executeCommandBatch(document, batch);
      if (!projected.ok) return;
      dispatch({
        type: 'execute',
        batch,
        actorId: LOCAL_ACTOR_ID,
        source: 'web',
        committedAt: new Date().toISOString()
      });
      exportTargetFile(projected.document);
    },
    [document, exportTargetFile]
  );

  const commitNodeTransform = useCallback(
    (nodeId: string, transform: Transform): void => {
      execute([
        {
          name: 'scene.nodes.transform',
          payload: {
            nodeIds: [nodeId],
            transform
          }
        }
      ]);
    },
    [execute]
  );

  const updateTransformProperty = useCallback(
    (property: keyof Transform, value: Vec3): void => {
      if (!selectedNodeId) return;
      execute([
        {
          name: 'scene.nodes.transform',
          payload: {
            nodeIds: [selectedNodeId],
            transform: {
              [property]: value
            }
          }
        }
      ]);
    },
    [execute, selectedNodeId]
  );

  const toggleVisibility = useCallback(
    (nodeId: string): void => {
      const node = document.scene.nodes[nodeId];
      if (!node) return;
      execute([
        {
          name: 'scene.nodes.visibility',
          payload: {
            nodeIds: [nodeId],
            visible: !node.visible
          }
        }
      ]);
    },
    [document.scene.nodes, execute]
  );

  const addCube = useCallback((): void => {
    const serial = history.serial + 1;
    const id = `cube-new-${serial}`;
    const parentId = selectedNode?.kind === 'bone'
      ? selectedNode.id
      : selectedNode?.parentId ?? document.scene.roots[0] ?? null;
    execute([
      {
        name: 'scene.cubes.create',
        payload: {
          cubes: [
            {
              id,
              name: `Cube ${serial}`,
              parentId,
              bounds: {
                from: [-2, 1, -2],
                to: [2, 5, 2]
              },
              transform: {
                pivot: [0, 3, 0]
              }
            }
          ]
        }
      }
    ]);
    setSelectedNodeId(id);
  }, [
    document.scene.roots,
    execute,
    history.serial,
    selectedNode
  ]);

  const undo = useCallback((): void => {
    dispatch({
      type: 'undo',
      commandId: crypto.randomUUID(),
      committedAt: new Date().toISOString()
    });
  }, []);
  const redo = useCallback((): void => {
    dispatch({
      type: 'redo',
      commandId: crypto.randomUUID(),
      committedAt: new Date().toISOString()
    });
  }, []);
  const togglePlayback = useCallback((): void => {
    if (!activeClip) return;
    setPlaying((current) => !current);
  }, [activeClip, setPlaying]);
  const closePanels = useCallback((): void => {
    setActiveOverlay(null);
  }, []);
  const changeTransformMode = useCallback(
    (mode: TransformControlsMode): void => {
      setTransformMode(mode);
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
    setCameraCommand((current) => ({
      mode,
      nonce: current.nonce + 1
    }));
  }, []);

  const toggleViewportOption = useCallback(
    (option: keyof ViewportOptions): void => {
      setViewportOptions((current) => ({
        ...current,
        [option]: !current[option]
      }));
    },
    []
  );

  const changeActiveClip = useCallback(
    (clipId: string | null): void => {
      setActiveClipId(clipId);
      setPlayhead(0);
    },
    [setPlayhead]
  );

  useEffect(() => {
    if (
      selectedNodeId &&
      document.scene.nodes[selectedNodeId]
    ) {
      return;
    }
    setSelectedNodeId(
      document.scene.roots[0] ??
      Object.keys(document.scene.nodes)[0] ??
      null
    );
  }, [document.scene.nodes, document.scene.roots, selectedNodeId]);

  useEffect(() => {
    if (activeClipId && document.animations[activeClipId]) return;
    const fallbackClipId = Object.keys(document.animations)[0] ?? null;
    if (fallbackClipId === activeClipId) return;
    setActiveClipId(fallbackClipId);
    setPlaying(false);
    setPlayhead(0);
  }, [
    activeClipId,
    document.animations,
    setPlayhead,
    setPlaying
  ]);

  const agentStatus = useAgentCommandPort({
    document,
    commandOutcome: history.lastCommandOutcome,
    selectedNodeId,
    report,
    dispatch,
    onFocusEntity: setSelectedNodeId
  });

  return (
    <main
      className="workbench-shell"
      data-agent-command-port={agentStatus}
      data-ashfox-revision={document.revision}
      onDragOver={(event) => event.preventDefault()}
      onDrop={projectFiles.drop}
    >
      <WorkbenchHeader
        document={document}
        isRendered={renderedRevision === document.revision}
        storageStatus={storageStatus}
        lastSavedAt={lastSavedAt}
        fileOperation={projectFiles.operation}
        onOpen={projectFiles.open}
        onSave={projectFiles.save}
        onRenameProject={renameProject}
        onExport={exportProject}
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
        onToggleSnap={() => setSnapEnabled((current) => !current)}
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
        cameraCommand={cameraCommand}
        viewportStats={viewportStats}
        activeClipId={activeClipId}
        playhead={playhead}
        playing={playing}
        agentStatus={agentStatus}
        activeOverlay={activeOverlay}
        onOverlayChange={setActiveOverlay}
        onSelectNode={setSelectedNodeId}
        onAddCube={addCube}
        onToggleVisibility={toggleVisibility}
        onTransformProperty={updateTransformProperty}
        onCommitTransform={commitNodeTransform}
        onRenderedRevision={setRenderedRevision}
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
        onSelectNode={setSelectedNodeId}
      />
    </main>
  );
}
