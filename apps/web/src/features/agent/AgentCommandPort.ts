import {
  parseSerializedAgentCommandEnvelope,
  type AgentCommandEnvelope
} from './port/agentCommandEnvelope';
import type {
  AgentCommandPortDependencies
} from './port/agentCommandPortTypes';
import {
  AgentPortLifecycle
} from './port/AgentPortLifecycle';
import {
  CaptureRequestController
} from './port/CaptureRequestController';
import {
  connectDomAgentBridge,
  type DomAgentResponse
} from './port/connectDomAgentBridge';
import {
  InspectRequestController
} from './port/InspectRequestController';
import {
  PresentRequestController
} from './port/PresentRequestController';
import {
  RunRequestController
} from './port/RunRequestController';
import type {
  AgentCaptureRequest,
  AgentCommandPortApi,
  AgentRunRequest,
  CaptureResult,
  InspectRequest,
  InspectResult,
  PresentRequest,
  PresentResult,
  RunResult
} from './types';

export type {
  AgentCommandPortDependencies,
  AgentCommandPortStatus
} from './port/agentCommandPortTypes';

export class AgentCommandPort implements AgentCommandPortApi {
  private readonly lifecycle: AgentPortLifecycle;
  private readonly inspectController: InspectRequestController;
  private readonly presentController: PresentRequestController;
  private readonly captureController: CaptureRequestController;
  private readonly runController: RunRequestController;

  constructor(private readonly dependencies: AgentCommandPortDependencies) {
    this.lifecycle = new AgentPortLifecycle(dependencies);
    this.inspectController = new InspectRequestController(dependencies);
    this.presentController = new PresentRequestController(
      dependencies,
      this.lifecycle
    );
    this.captureController = new CaptureRequestController(
      dependencies,
      this.lifecycle
    );
    this.runController = new RunRequestController(
      dependencies,
      this.lifecycle
    );
  }

  connect(host: Window): () => void {
    return connectDomAgentBridge({
      host,
      api: this,
      execute: (serialized) =>
        this.executeSerializedCommand(serialized),
      currentRevision: this.dependencies.currentRevision
    });
  }

  inspect(request?: InspectRequest): InspectResult {
    return this.inspectController.inspect(request);
  }

  present(request: PresentRequest): Promise<PresentResult> {
    return this.presentController.present(request);
  }

  capture(request: AgentCaptureRequest): Promise<CaptureResult> {
    return this.captureController.capture(request);
  }

  run(request: AgentRunRequest): Promise<RunResult> {
    return this.runController.run(request);
  }

  private async executeSerializedCommand(
    serialized: string
  ): Promise<DomAgentResponse> {
    const request =
      parseSerializedAgentCommandEnvelope(serialized);
    if (!request) {
      return [null, {
        ok: false,
        revision: this.dependencies.currentRevision(),
        error: {
          code: 'invalid_request',
          path: '$',
          expected: 'agent command request'
        }
      }];
    }
    return [
      request.requestId,
      await this.executeConnectedCommand(request)
    ];
  }

  private executeConnectedCommand(
    request: AgentCommandEnvelope
  ): unknown | Promise<unknown> {
    switch (request.method) {
      case 'inspect':
        return this.inspect(
          request.payload as InspectRequest | undefined
        );
      case 'present':
        return this.present(request.payload as PresentRequest);
      case 'capture':
        return this.capture(request.payload as AgentCaptureRequest);
      case 'run':
        return this.runController.runConnected(
          request.payload,
          request.requestId
        );
    }
  }
}
