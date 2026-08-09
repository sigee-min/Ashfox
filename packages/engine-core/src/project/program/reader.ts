import { readAppearanceSourceStatement } from '../appearance/source';
import {
  fallbackIntentProgramSpan,
  intentProgramStatementSpan,
  type IntentProgramToken
} from './lexer';
import {
  createRawIntentProgram,
  identifierPattern,
  type RawIntentProgram
} from './syntax';
import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from './language';
import { resolveIntentProgramSourceSpan } from './types';
import type {
  IntentProgramAstField,
  IntentProgramAstStatement,
  IntentProgramDiagnostic,
  IntentProgramRootBlock,
  IntentProgramSpan
} from './types';
import {
  invalidBodyBlockMessage,
  isBodySourceKind,
  readBodyModuleSourceStatement
} from './read/body';
import type { IntentProgramReadContext } from './read/contract';
import {
  invalidFaceBlockMessage,
  isFaceBlockKeyword,
  readFacePropertySourceStatement,
  readFaceSourceStatement
} from './read/face';
import { readMetadataStatement } from './read/metadata';
import { readModelStatement } from './read/model';
import { readAnimationStatement } from './read/animation';
import { readSurfaceSourceStatement } from './read/surface';
import {
  intentProgramAllowsOccurrence,
  resolveIntentProgramVocabulary
} from './schema';
import { sourceToken } from './read/schema';
import {
  completeSurfaceShape,
  createSurfaceShapeDraft,
  readSurfaceShapeProperty,
  type SurfaceShapeDraft
} from './shape';

const modelStatements = INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.model;
const rootStatement = INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.root;
const authorityNames = resolveIntentProgramVocabulary(rootStatement.allowed);
const rootBlocks = new Set<string>(authorityNames);
const [metadataAuthority, modelAuthority, animationAuthority] = authorityNames;
const surfaceKeyword = modelStatements.surface.sourceTokens[0];
const bodyHeader = modelStatements.body.sourceHeader;
const faceHeader = modelStatements.face.sourceHeader;
const shapeHeader = modelStatements.shape.sourceHeader;
const faceLayouts = modelStatements.face.sourceTokensByProperty;

const nestedHeaderMismatch = (
  keyword: IntentProgramToken,
  values: readonly IntentProgramToken[]
): IntentProgramToken => {
  const header = [bodyHeader, faceHeader, shapeHeader].find(
    (candidate) => candidate[0] === keyword.value
  );
  if (!header) return keyword;
  return [keyword, ...values][header.length] ?? keyword;
};

export class IntentProgramReader {
  private index = 0;
  private activeFields: IntentProgramAstField[] | null = null;
  private readonly context: IntentProgramReadContext;
  readonly diagnostics: IntentProgramDiagnostic[];
  readonly sourceMap: Record<string, IntentProgramSpan> = {};
  readonly statements: IntentProgramAstStatement[] = [];
  readonly raw: RawIntentProgram = createRawIntentProgram();

  constructor(
    private readonly tokens: readonly IntentProgramToken[],
    lexicalDiagnostics: readonly IntentProgramDiagnostic[]
  ) {
    this.diagnostics = [...lexicalDiagnostics];
    this.context = {
      raw: this.raw,
      current: () => this.current(),
      error: (code, message, token) => this.error(code, message, token),
      identifier: (token, label, missingCode) =>
        this.identifier(token, label, missingCode),
      field: (path, value, origin) => this.field(path, value, origin),
      span: (path, origin) => { this.sourceMap[path] ??= origin; }
    };
  }

  private current(): IntentProgramToken {
    const token = this.tokens[this.index];
    if (!token) {
      throw new Error('Intent Program token stream is missing its end token.');
    }
    return token;
  }

  private take(): IntentProgramToken {
    const token = this.current();
    this.index += 1;
    return token;
  }

  private error(
    code: string,
    message: string,
    token = this.current()
  ): void {
    this.diagnostics.push({ severity: 'error', code, message, span: token.span });
  }

  reportPath(code: string, message: string, path: string): void {
    this.diagnostics.push({
      severity: 'error',
      code,
      message,
      span: resolveIntentProgramSourceSpan(this.sourceMap, path) ??
        fallbackIntentProgramSpan
    });
  }

  hasErrors(): boolean {
    return this.diagnostics.some((entry) => entry.severity === 'error');
  }

  private consumeLines(): void {
    while (this.current().kind === 'line') this.take();
  }

  private values(): IntentProgramToken[] {
    const values: IntentProgramToken[] = [];
    while (!['line', 'open', 'close', 'end'].includes(this.current().kind)) {
      values.push(this.take());
    }
    return values;
  }

  private identifier(
    token: IntentProgramToken | undefined,
    label: string,
    missingCode = 'intent.invalid_identifier'
  ): string | null {
    if (!token) {
      this.error(missingCode, `Expected ${label}.`);
      return null;
    }
    if (token.kind !== 'word' || !identifierPattern.test(token.value)) {
      this.error('intent.invalid_identifier',
        `${label} must be lower-kebab-case (for example, "front-leg").`,
        token);
      return null;
    }
    return token.value;
  }

  private field(path: string, value: string, origin: IntentProgramSpan): void {
    this.sourceMap[path] ??= origin;
    this.activeFields?.push({ path, value, span: origin });
  }

  private record(
    keyword: IntentProgramToken,
    values: readonly IntentProgramToken[],
    fields: readonly IntentProgramAstField[]
  ): void {
    this.statements.push({
      keyword: keyword.value,
      values: values.map((value) => value.value),
      span: intentProgramStatementSpan([keyword, ...values]),
      fields
    });
  }

  private declaration(
    keyword: IntentProgramToken,
    values: readonly IntentProgramToken[],
    read: () => void
  ): void {
    const fields: IntentProgramAstField[] = [];
    this.activeFields = fields;
    read();
    this.activeFields = null;
    this.record(keyword, values, fields);
  }

  parse(): void {
    this.consumeLines();
    while (this.current().kind !== 'end') {
      if (this.current().kind === 'close') {
        this.error('intent.unexpected_close', 'Unexpected closing brace.');
        this.take();
      } else this.rootStatement();
      this.consumeLines();
    }
  }

  private rootStatement(): void {
    const keyword = this.take();
    if (keyword.kind !== 'word') {
      this.error('intent.expected_root_block',
        `Expected one authority block: ${authorityNames.join(', ')}.`, keyword);
      this.values();
      return;
    }
    const values = this.values();
    if (!rootBlocks.has(keyword.value)) {
      this.error('intent.unknown_root_block',
        `Unknown root authority "${keyword.value}"; only ${
          authorityNames.join(', ')
        } are allowed.`, keyword);
      if (this.current().kind === 'open') {
        this.take();
        this.skipBlock();
      }
      return;
    }
    if (values.length > 0 || this.current().kind !== 'open') {
      this.error('intent.root_requires_block',
        `${keyword.value} must use one complete authority block.`,
        values[0] ?? keyword);
      return;
    }
    const block = keyword.value as IntentProgramRootBlock;
    this.take();
    if (!intentProgramAllowsOccurrence(
      this.raw.authorities[block] ? 1 : 0,
      rootStatement.cardinalityPerBlock
    )) {
      this.error('intent.duplicate_authority_block',
        `${block} authority is declared more than once.`, keyword);
      this.skipBlock();
      return;
    }
    this.raw.authorities[block] = true;
    this.sourceMap[block] ??= keyword.span;
    this.record(keyword, [], []);
    this.authorityBlock(block);
  }

  private skipBlock(): void {
    let depth = 1;
    while (depth > 0 && this.current().kind !== 'end') {
      const token = this.take();
      if (token.kind === 'open') depth += 1;
      if (token.kind === 'close') depth -= 1;
    }
  }

  private authorityBlock(block: IntentProgramRootBlock): void {
    this.consumeLines();
    while (this.current().kind !== 'close' && this.current().kind !== 'end') {
      this.authorityStatement(block);
      this.consumeLines();
    }
    if (this.current().kind === 'close') this.take();
    else this.error('intent.unclosed_block', `Unclosed ${block} block.`);
  }

  private authorityStatement(block: IntentProgramRootBlock): void {
    const keyword = this.take();
    if (keyword.kind !== 'word') {
      this.error('intent.expected_statement',
        `Expected a statement inside ${block}.`, keyword);
      this.values();
      return;
    }
    const values = this.values();
    if (this.current().kind === 'open') {
      this.take();
      this.nestedBlock(block, keyword, values);
      return;
    }
    this.declaration(keyword, values, () => {
      if (block === metadataAuthority) {
        readMetadataStatement(this.context, keyword, values);
      } else if (block === modelAuthority) {
        if (keyword.value === surfaceKeyword) {
          readSurfaceSourceStatement(this.context, keyword, values);
        } else readModelStatement(this.context, keyword, values);
      } else if (block === animationAuthority) {
        readAnimationStatement(this.context, keyword, values);
      } else {
        readAppearanceSourceStatement(
          this.raw.appearance,
          keyword,
          values,
          this.context
        );
      }
    });
  }

  private nestedBlock(
    owner: IntentProgramRootBlock,
    keyword: IntentProgramToken,
    values: readonly IntentProgramToken[]
  ): void {
    this.record(keyword, values, []);
    if (owner !== modelAuthority) {
      this.error('intent.invalid_nested_block',
        `${keyword.value} cannot use a nested block inside ${owner}.`, keyword);
      this.skipBlock();
      return;
    }
    const statementTokens = [keyword, ...values];
    if (keyword.value === bodyHeader[0] &&
      statementTokens.length === bodyHeader.length) {
      this.bodyBlock();
      return;
    }
    if (keyword.value === faceHeader[0] &&
      statementTokens.length === faceHeader.length) {
      this.faceBlock();
      return;
    }
    if (keyword.value === shapeHeader[0] &&
      statementTokens.length === shapeHeader.length) {
      this.shapeBlock(sourceToken(
        shapeHeader,
        statementTokens,
        'surfaceId'
      ));
      return;
    }
    this.error('intent.invalid_model_block',
      'model allows body { ... }, face { ... }, and shape <surface-id> { ... }.',
      nestedHeaderMismatch(keyword, values));
    this.skipBlock();
  }

  private nestedStatements(
    label: string,
    read: (keyword: IntentProgramToken, values: readonly IntentProgramToken[]) => void
  ): void {
    this.consumeLines();
    while (this.current().kind !== 'close' && this.current().kind !== 'end') {
      const keyword = this.take();
      if (keyword.kind !== 'word') {
        this.error('intent.expected_statement',
          `Expected a statement inside ${label}.`, keyword);
        this.values();
        this.consumeLines();
        continue;
      }
      const values = this.values();
      if (this.current().kind === 'open') {
        this.error('intent.invalid_nested_block',
          `${label} cannot contain another nested block.`, keyword);
        this.take();
        this.skipBlock();
      } else this.declaration(keyword, values, () => read(keyword, values));
      this.consumeLines();
    }
    if (this.current().kind === 'close') this.take();
    else this.error('intent.unclosed_block', `Unclosed ${label} block.`);
  }

  private bodyBlock(): void {
    this.nestedStatements(bodyHeader[0], (kind, values) => {
      if (!isBodySourceKind(kind)) {
        this.error('intent.invalid_block_statement',
          invalidBodyBlockMessage, kind);
        return;
      }
      readBodyModuleSourceStatement(this.context, kind, values);
    });
  }

  private faceBlock(): void {
    this.nestedStatements(faceHeader[0], (keyword, values) => {
      if (!isFaceBlockKeyword(keyword)) {
        this.error('intent.invalid_block_statement',
          invalidFaceBlockMessage, keyword);
        return;
      }
      if (keyword.value === faceLayouts.none[0] ||
        keyword.value === faceLayouts.full[0]) {
        readFaceSourceStatement(this.context, [keyword, ...values]);
      } else {
        readFacePropertySourceStatement(this.context, keyword, values);
      }
    });
  }

  private shapeBlock(idToken: IntentProgramToken | undefined): void {
    let draft: SurfaceShapeDraft | null = null;
    const fields: IntentProgramAstField[] = [];
    this.activeFields = fields;
    draft = createSurfaceShapeDraft(this.raw, idToken, this.context);
    this.activeFields = null;
    this.consumeLines();
    while (this.current().kind !== 'close' && this.current().kind !== 'end') {
      const keyword = this.take();
      const values = this.values();
      if (keyword.kind !== 'word') {
        this.error('intent.expected_statement',
          'Expected a shape property.', keyword);
      } else if (this.current().kind === 'open') {
        this.error('intent.invalid_nested_block',
          'shape properties cannot contain a block.', keyword);
        this.take();
        this.skipBlock();
      } else if (draft) {
        this.declaration(keyword, values, () =>
          readSurfaceShapeProperty(draft!, keyword, values, this.context));
      }
      this.consumeLines();
    }
    if (this.current().kind === 'close') this.take();
    else this.error('intent.unclosed_block', 'Unclosed shape block.');
    if (draft) completeSurfaceShape(this.raw, draft, this.context);
  }
}
