import type { AuthoringSlotAssignment } from '../../../authoring/contract';
import type { ModelPartSpec, ProjectIntent } from '../../../model';
import type { IntentProgramIr } from '../../../project/program/types';
import type {
  IntentProgramLimbPair,
  IntentProgramModuleHost,
  IntentProgramWheelPair
} from './contract';
import type {
  IntentProgramAttachmentReflection,
  IntentProgramCompilationPlan,
  IntentProgramGraphNode,
  IntentProgramPlannedAttachment
} from '../contract';

/** Read-only artifact view exposed to geometry emitters. */
export interface IntentProgramLoweringArtifacts {
  readonly parts: readonly ModelPartSpec[];
  readonly slots: readonly AuthoringSlotAssignment[];
  readonly graph: readonly IntentProgramGraphNode[];
  readonly attachmentReflections: readonly IntentProgramAttachmentReflection[];
}

export interface IntentProgramLoweringEnvironment {
  readonly program: IntentProgramIr;
  readonly compilation: IntentProgramCompilationPlan;
  readonly intent: ProjectIntent;
}

export interface PartEmissionPort {
  readonly parts: readonly ModelPartSpec[];
  readonly partCount: number;
  addPart(part: ModelPartSpec): void;
  addParts(...parts: readonly ModelPartSpec[]): void;
  part(partId: string): ModelPartSpec | undefined;
  rootPart(): ModelPartSpec | undefined;
  hasPart(partId: string): boolean;
  partsSince(index: number): readonly ModelPartSpec[];
  replacePart(partId: string, part: ModelPartSpec): void;
}

export interface SlotEmissionPort {
  readonly slots: readonly AuthoringSlotAssignment[];
  addSlot(slot: AuthoringSlotAssignment): void;
  slot(slotId: string): AuthoringSlotAssignment | undefined;
  replaceSlot(slotId: string, slot: AuthoringSlotAssignment): void;
}

export interface TopologyEmissionPort {
  readonly graph: readonly IntentProgramGraphNode[];
  addGraph(node: Omit<IntentProgramGraphNode, 'children'>): void;
  plannedAttachment(moduleId: string): IntentProgramPlannedAttachment | undefined;
  registerHost(host: IntentProgramModuleHost): void;
  host(moduleId: string): IntentProgramModuleHost | undefined;
  requireHost(moduleId: string): IntentProgramModuleHost;
  registerLimbPair(pair: IntentProgramLimbPair): void;
  limbPair(moduleId: string): IntentProgramLimbPair | undefined;
  registerWheelPair(pair: IntentProgramWheelPair): void;
  wheelPair(moduleId: string): IntentProgramWheelPair | undefined;
}

export interface AttachmentReflectionPort {
  readonly attachmentReflections: readonly IntentProgramAttachmentReflection[];
  addAttachmentReflection(reflection: IntentProgramAttachmentReflection): void;
}

/**
 * Mutation authority for one lowering run. Collections and indexes are
 * private to the implementation; emitters can only mutate through operations
 * that keep the array view and its O(1) index consistent.
 */
export interface IntentProgramLoweringContext
  extends IntentProgramLoweringArtifacts,
  IntentProgramLoweringEnvironment,
  PartEmissionPort,
  SlotEmissionPort,
  TopologyEmissionPort,
  AttachmentReflectionPort {}

/** Narrow ports used by the two largest emitter families. */
export type BodyEmissionPort = IntentProgramLoweringEnvironment &
  PartEmissionPort & SlotEmissionPort & TopologyEmissionPort;

export type SupportEmissionPort = BodyEmissionPort & AttachmentReflectionPort;

class LoweringContext implements IntentProgramLoweringContext {
  readonly program: IntentProgramIr;
  readonly compilation: IntentProgramCompilationPlan;
  readonly intent: ProjectIntent;

  readonly #parts: ModelPartSpec[] = [];
  readonly #partsById = new Map<string, ModelPartSpec>();
  readonly #partIndexes = new Map<string, number>();
  #rootPartId: string | null = null;
  readonly #slots: AuthoringSlotAssignment[] = [];
  readonly #slotsById = new Map<string, AuthoringSlotAssignment>();
  readonly #slotIndexes = new Map<string, number>();
  readonly #graph: IntentProgramGraphNode[] = [];
  readonly #graphIds = new Set<string>();
  readonly #attachmentReflections: IntentProgramAttachmentReflection[] = [];
  readonly #attachmentKeys = new Set<string>();
  readonly #plannedAttachments: ReadonlyMap<string, IntentProgramPlannedAttachment>;
  readonly #moduleHosts = new Map<string, IntentProgramModuleHost>();
  readonly #limbPairs = new Map<string, IntentProgramLimbPair>();
  readonly #wheelPairs = new Map<string, IntentProgramWheelPair>();

  constructor(
    program: IntentProgramIr,
    compilation: IntentProgramCompilationPlan,
    intent: ProjectIntent
  ) {
    this.program = program;
    this.compilation = compilation;
    this.intent = intent;
    this.#plannedAttachments = new Map(compilation.attachments.map(
      (attachment) => [attachment.moduleId, attachment]
    ));
  }

  get parts(): readonly ModelPartSpec[] { return this.#parts; }
  get slots(): readonly AuthoringSlotAssignment[] { return this.#slots; }
  get graph(): readonly IntentProgramGraphNode[] { return this.#graph; }
  get attachmentReflections(): readonly IntentProgramAttachmentReflection[] {
    return this.#attachmentReflections;
  }
  get partCount(): number { return this.#parts.length; }

  addPart(part: ModelPartSpec): void { this.addParts(part); }
  addParts(...parts: readonly ModelPartSpec[]): void {
    for (const part of parts) {
      if (this.#partsById.has(part.partId)) {
        throw new Error(`Compiler emitted duplicate part "${part.partId}".`);
      }
      this.#partIndexes.set(part.partId, this.#parts.length);
      this.#parts.push(part);
      this.#partsById.set(part.partId, part);
      if (part.parentPartId === null) this.#rootPartId = part.partId;
    }
  }
  part(partId: string): ModelPartSpec | undefined {
    return this.#partsById.get(partId);
  }
  rootPart(): ModelPartSpec | undefined {
    return this.#rootPartId ? this.#partsById.get(this.#rootPartId) : undefined;
  }
  hasPart(partId: string): boolean { return this.#partsById.has(partId); }
  partsSince(index: number): readonly ModelPartSpec[] {
    return this.#parts.slice(index);
  }
  replacePart(partId: string, part: ModelPartSpec): void {
    const index = this.#partIndexes.get(partId);
    if (index === undefined || part.partId !== partId) {
      throw new Error(`Cannot replace unknown compiler part "${partId}".`);
    }
    this.#parts[index] = part;
    this.#partsById.set(partId, part);
  }

  addSlot(slot: AuthoringSlotAssignment): void {
    if (this.#slotsById.has(slot.slotId)) {
      throw new Error(`Compiler emitted duplicate slot "${slot.slotId}".`);
    }
    this.#slotIndexes.set(slot.slotId, this.#slots.length);
    this.#slots.push(slot);
    this.#slotsById.set(slot.slotId, slot);
  }
  slot(slotId: string): AuthoringSlotAssignment | undefined {
    return this.#slotsById.get(slotId);
  }
  replaceSlot(slotId: string, slot: AuthoringSlotAssignment): void {
    const index = this.#slotIndexes.get(slotId);
    if (index === undefined || slot.slotId !== slotId) {
      throw new Error(`Cannot replace unknown compiler slot "${slotId}".`);
    }
    this.#slots[index] = slot;
    this.#slotsById.set(slotId, slot);
  }

  addGraph(node: Omit<IntentProgramGraphNode, 'children'>): void {
    if (this.#graphIds.has(node.id)) {
      throw new Error(`Compiler emitted duplicate graph node "${node.id}".`);
    }
    this.#graphIds.add(node.id);
    this.#graph.push({ ...node, children: [] });
  }
  addAttachmentReflection(reflection: IntentProgramAttachmentReflection): void {
    const key = `${reflection.sourcePartId}:${reflection.reflectedPartId}`;
    if (this.#attachmentKeys.has(key)) return;
    this.#attachmentKeys.add(key);
    this.#attachmentReflections.push(reflection);
  }
  plannedAttachment(moduleId: string): IntentProgramPlannedAttachment | undefined {
    return this.#plannedAttachments.get(moduleId);
  }
  registerHost(host: IntentProgramModuleHost): void {
    if (this.#moduleHosts.has(host.moduleId)) {
      throw new Error(`Compiler registered duplicate host "${host.moduleId}".`);
    }
    this.#moduleHosts.set(host.moduleId, host);
  }
  host(moduleId: string): IntentProgramModuleHost | undefined {
    return this.#moduleHosts.get(moduleId);
  }
  requireHost(moduleId: string): IntentProgramModuleHost {
    const host = this.host(moduleId);
    if (!host) {
      throw new Error(`Compiler plan references unresolved host "${moduleId}".`);
    }
    return host;
  }
  registerLimbPair(pair: IntentProgramLimbPair): void {
    if (this.#limbPairs.has(pair.moduleId)) {
      throw new Error(`Compiler registered duplicate limb pair "${pair.moduleId}".`);
    }
    this.#limbPairs.set(pair.moduleId, pair);
  }
  limbPair(moduleId: string): IntentProgramLimbPair | undefined {
    return this.#limbPairs.get(moduleId);
  }
  registerWheelPair(pair: IntentProgramWheelPair): void {
    if (this.#wheelPairs.has(pair.moduleId)) {
      throw new Error(`Compiler registered duplicate wheel pair "${pair.moduleId}".`);
    }
    this.#wheelPairs.set(pair.moduleId, pair);
  }
  wheelPair(moduleId: string): IntentProgramWheelPair | undefined {
    return this.#wheelPairs.get(moduleId);
  }
}

export const createIntentProgramLoweringContext = (
  program: IntentProgramIr,
  compilation: IntentProgramCompilationPlan,
  intent: ProjectIntent
): IntentProgramLoweringContext => new LoweringContext(
  program,
  compilation,
  intent
);
