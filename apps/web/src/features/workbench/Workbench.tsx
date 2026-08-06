'use client';

import { useCallback, useEffect } from 'react';

import { agentCommandProtocol } from '../agent/agentCommandProtocol';
import { useProjectFileActions } from '../files/useProjectFileActions';
import { BottomWorkspace } from './components/BottomWorkspace';
import { ViewportWorkspace } from './components/ViewportWorkspace';
import { WorkbenchHeader } from './components/WorkbenchHeader';
import { WorkbenchToolbar } from './components/WorkbenchToolbar';
import {
  useWorkbenchAgentController
} from './controller/useWorkbenchAgentController';
import {
  useWorkbenchProjectSession
} from './controller/useWorkbenchProjectSession';
import {
  useWorkbenchViewController
} from './controller/useWorkbenchViewController';
import {
  useWorkbenchProjectCommands
} from './hooks/useWorkbenchProjectCommands';
import {
  useWorkbenchShortcuts
} from './hooks/useWorkbenchShortcuts';
import type { NewProjectInput } from './newProject';

export function Workbench() {
  const project = useWorkbenchProjectSession();
  const view = useWorkbenchViewController({
    document: project.document,
    initialSelectionId: project.initialSelectionId,
    initialClipId: project.initialClipId
  });
  const files = useProjectFileActions({
    document: project.document,
    assets: project.assets,
    onLoad: project.replaceProject,
    operationLease: project.operationLease
  });
  const commands = useWorkbenchProjectCommands({
    document: project.document,
    selectedNodeId: view.selectedNodeId,
    dispatch: project.dispatchUserMutation
  });

  useEffect(() => {
    if (project.galleryProjectStatus.phase !== 'loaded') return;
    view.changeActiveClip(
      Object.keys(project.document.animations)[0] ?? null
    );
  }, [
    project.document.animations,
    project.galleryProjectStatus.phase,
    view.changeActiveClip
  ]);

  const createProject = useCallback((input: NewProjectInput): void => {
    if (project.operationLease.currentOwner() !== null) return;
    commands.createProject(input);
    view.resetProjectView();
  }, [
    commands.createProject,
    project.operationLease,
    view.resetProjectView
  ]);

  useWorkbenchShortcuts({
    onUndo: commands.undo,
    onRedo: commands.redo,
    onTransformMode: view.changeTransformMode,
    onTogglePlayback: view.togglePlayback,
    onClosePanels: view.closePanels
  });

  const agent = useWorkbenchAgentController({
    document: project.document,
    projectGeneration: project.storage.generation,
    assets: project.assets,
    activity: project.history.activity,
    visualReviews: project.visualReviews,
    onRecordVisualReview: project.recordVisualReview,
    commandOutcomes: project.history.commandOutcomes,
    selectedNodeId: view.selectedNodeId,
    report: project.report,
    dispatch: project.dispatchProject,
    buildDocuments: project.buildCaptureDocuments,
    operationLease: project.operationLease,
    selectNode: view.selectNode,
    prepareView: view.prepareAgentView,
    setPlayhead: view.setPlayhead,
    setPlaying: view.setPlaying,
    deliver: files.exportTarget,
    capture: files.capture
  });

  return (
    <main
      className="workbench-shell"
      data-agent-command-port={agent.status}
      data-ashfox-agent-manifest={agentCommandProtocol.href}
      data-ashfox-revision={project.document.revision}
      data-ashfox-file-operation={files.operation.phase}
      data-ashfox-file-kind={files.operation.kind ?? ''}
      data-ashfox-file-operation-id={files.operation.operationId}
      data-ashfox-project-load={project.galleryProjectStatus.phase}
      onDragOver={(event) => event.preventDefault()}
      onDrop={files.drop}
    >
      <WorkbenchHeader
        document={project.document}
        fileOperation={files.operation}
        artifactFile={files.artifactFile}
        buildDocuments={project.buildCaptureDocuments}
        activity={project.history.activity}
        activeClipId={view.activeClipId}
        environment={view.environment}
        cameraMode={view.cameraCommand.mode}
        captureFile={files.captureFile}
        onCreateProject={createProject}
        onOpen={files.open}
        onSave={files.save}
        onUpdateProject={commands.updateProjectSettings}
        onExport={files.exportTarget}
        onActiveClipChange={view.changeActiveClip}
        onCapture={files.captureGif}
        onCancelFileOperation={files.cancel}
      />
      <WorkbenchToolbar
        canUndo={project.history.past.length > 0}
        canRedo={project.history.future.length > 0}
        transformMode={view.transformMode}
        snapEnabled={view.snapEnabled}
        cameraMode={view.cameraCommand.mode}
        viewportOptions={view.viewportOptions}
        onUndo={commands.undo}
        onRedo={commands.redo}
        onTransformMode={view.changeTransformMode}
        onToggleSnap={view.toggleSnap}
        onSetCamera={view.setCamera}
        onToggleViewportOption={view.toggleViewportOption}
      />
      {(project.galleryProjectStatus.phase === 'loading' ||
        project.galleryProjectStatus.phase === 'error') && (
        <div
          className="gallery-project-status"
          data-phase={project.galleryProjectStatus.phase}
          role="status"
        >
          {project.galleryProjectStatus.message}
        </div>
      )}
      <ViewportWorkspace
        document={project.document}
        assets={project.assets}
        report={project.report}
        selectedNodeId={view.selectedNodeId}
        transformMode={view.transformMode}
        snapEnabled={view.snapEnabled}
        viewportOptions={view.viewportOptions}
        environment={view.environment}
        cameraCommand={view.cameraCommand}
        viewportStats={view.viewportStats}
        activeClipId={view.activeClipId}
        playhead={view.playhead}
        playing={view.playing}
        presentationNonce={agent.presentationNonce}
        activeOverlay={view.activeOverlay}
        onEnvironmentChange={view.setEnvironment}
        onOverlayChange={view.setActiveOverlay}
        onSelectNode={view.selectNode}
        onToggleVisibility={commands.toggleVisibility}
        onTransformProperty={commands.updateTransformProperty}
        onCommitTransform={commands.commitNodeTransform}
        onStats={view.setViewportStats}
        onPresented={agent.onPresented}
      />
      <BottomWorkspace
        mode={view.bottomMode}
        document={project.document}
        activity={project.history.activity}
        activeClipId={view.activeClipId}
        activeClip={view.activeClip}
        playhead={view.playhead}
        playing={view.playing}
        storageStatus={project.storageStatus}
        onModeChange={view.setBottomMode}
        onActiveClipChange={view.changeActiveClip}
        onTogglePlayback={view.togglePlayback}
        onSeek={view.setPlayhead}
        onSelectNode={view.selectNode}
      />
    </main>
  );
}
