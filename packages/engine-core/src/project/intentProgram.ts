import { canonicalJsonString } from '../canonicalJson';
import type {
  ProjectSemanticContract,
  ProjectSupportedSurfaceObligation
} from '../model';
import type {
  IntentProgramDiagnostic,
  IntentProgramFace,
  IntentProgramIr,
  IntentProgramModule,
  IntentProgramParseResult,
  IntentProgramRest,
  IntentProgramSpan,
  IntentProgramStyle,
  IntentProgramSurface
} from './intentProgramTypes';

export type {
  IntentProgramAst,
  IntentProgramDiagnostic,
  IntentProgramFace,
  IntentProgramIr,
  IntentProgramModule,
  IntentProgramParseResult,
  IntentProgramRest,
  IntentProgramSpan,
  IntentProgramStyle,
  IntentProgramSurface
} from './intentProgramTypes';

type TokenKind = 'word' | 'string' | 'open' | 'close' | 'line' | 'end';
interface Token { kind: TokenKind; value: string; span: IntentProgramSpan; }
interface RawProgram {
  asset?: string; track?: 'essential' | 'hero'; domain?: 'organism' | 'constructed';
  frame?: 'north' | 'south' | 'east' | 'west'; symmetry?: 'bilateral' | 'asymmetric';
  rest?: IntentProgramRest; body: IntentProgramModule[];
  surfaces: IntentProgramSurface[]; face?: IntentProgramFace; style: IntentProgramStyle;
}

const rootKeywords = new Set([
  'asset', 'track', 'domain', 'frame', 'symmetry', 'rest', 'body',
  'core', 'mass', 'chain', 'limb', 'wheel', 'radial', 'surface', 'face', 'eyes',
  'nose', 'mouth', 'style', 'palette'
]);

const position = (source: string, offset: number) => {
  const before = source.slice(0, offset);
  const line = before.split('\n').length;
  const lineStart = before.lastIndexOf('\n') + 1;
  return { offset, line, column: offset - lineStart + 1 };
};
const span = (source: string, start: number, end: number): IntentProgramSpan => ({
  start: position(source, start), end: position(source, end)
});
const hashText = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `intent:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};
const normalizeText = (value: string): string => value.trim().replace(/\s+/g, ' ');
const statementSpan = (tokens: readonly Token[]): IntentProgramSpan => ({
  start: tokens[0]!.span.start,
  end: tokens[tokens.length - 1]!.span.end
});
const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index]!;
    if (character === ' ' || character === '\t' || character === '\r') { index += 1; continue; }
    if (character === '\n' || character === ';') {
      tokens.push({ kind: 'line', value: character, span: span(source, index, index + 1) }); index += 1; continue;
    }
    if (character === '{' || character === '}') {
      tokens.push({ kind: character === '{' ? 'open' : 'close', value: character, span: span(source, index, index + 1) }); index += 1; continue;
    }
    if (character === '#') { while (index < source.length && source[index] !== '\n') index += 1; continue; }
    if (character === '"') {
      const start = index; index += 1; let value = '';
      while (index < source.length && source[index] !== '"') {
        if (source[index] === '\\' && index + 1 < source.length) index += 1;
        value += source[index]!; index += 1;
      }
      if (source[index] === '"') index += 1;
      tokens.push({ kind: 'string', value, span: span(source, start, index) }); continue;
    }
    const start = index;
    while (index < source.length && !/[\s;{}#]/.test(source[index]!)) index += 1;
    tokens.push({ kind: 'word', value: source.slice(start, index).toLowerCase(), span: span(source, start, index) });
  }
  tokens.push({ kind: 'end', value: '', span: span(source, source.length, source.length) });
  return tokens;
};

class Reader {
  private index = 0;
  readonly diagnostics: IntentProgramDiagnostic[] = [];
  readonly sourceMap: Record<string, IntentProgramSpan> = {};
  readonly statements: {
    keyword: string;
    values: readonly string[];
    span: IntentProgramSpan;
  }[] = [];
  readonly raw: RawProgram = { body: [], surfaces: [], style: {} };
  constructor(private readonly tokens: readonly Token[]) {}
  private current(): Token { return this.tokens[this.index]!; }
  private take(): Token { const value = this.current(); this.index += 1; return value; }
  private error(code: string, message: string, token = this.current()): void {
    this.diagnostics.push({ severity: 'error', code, message, span: token.span });
  }
  private consumeLines(): void { while (this.current().kind === 'line') this.take(); }
  private values(): Token[] { const values: Token[] = []; while (!['line', 'open', 'close', 'end'].includes(this.current().kind)) values.push(this.take()); return values; }
  private record(keyword: string, values: readonly Token[]): void {
    const all = values.length === 0 ? [this.tokens[this.index - 1]!] : [this.tokens[this.index - values.length - 1]!, ...values];
    this.statements.push({ keyword, values: values.map((value) => value.value), span: statementSpan(all) });
  }
  private set(path: string, value: unknown, origin: IntentProgramSpan): void { this.sourceMap[path] = origin; void value; }
  parse(): void {
    this.consumeLines();
    while (this.current().kind !== 'end') {
      if (this.current().kind === 'close') { this.error('intent.unexpected_close', 'Unexpected closing brace.'); this.take(); }
      else this.statement();
      this.consumeLines();
    }
  }
  private statement(): void {
    const keyword = this.take();
    if (keyword.kind !== 'word') { this.error('intent.expected_statement', 'Expected an intent statement.', keyword); return; }
    if (!rootKeywords.has(keyword.value)) { this.error('intent.unknown_statement', `Unknown intent statement "${keyword.value}".`, keyword); this.values(); return; }
    if (this.current().kind === 'open') { this.take(); this.record(keyword.value, []); this.block(keyword.value); return; }
    const values = this.values(); this.record(keyword.value, values); this.declaration(keyword, values);
  }
  private block(context: string): void {
    this.consumeLines();
    while (this.current().kind !== 'close' && this.current().kind !== 'end') {
      if (context === 'body' && this.current().kind === 'word' && ['core', 'mass', 'chain', 'limb', 'wheel', 'radial'].includes(this.current().value)) this.statement();
      else if (context === 'face' && this.current().kind === 'word' && ['eyes', 'nose', 'mouth'].includes(this.current().value)) this.statement();
      else if (context === 'style' && this.current().kind === 'word' && this.current().value === 'palette') this.statement();
      else { this.error('intent.invalid_block_statement', `This statement is not allowed in ${context}.`); this.values(); }
      this.consumeLines();
    }
    if (this.current().kind === 'close') this.take(); else this.error('intent.unclosed_block', `Unclosed ${context} block.`);
  }
  private declaration(keyword: Token, values: readonly Token[]): void {
    const origin = statementSpan([keyword, ...values]);
    switch (keyword.value) {
      case 'asset': this.assign('asset', normalizeText(values.map((item) => item.value).join(' ')), origin); break;
      case 'track': this.assignEnum('track', values, ['essential', 'hero'], origin); break;
      case 'domain': this.assignEnum('domain', values, ['organism', 'constructed'], origin); break;
      case 'frame': this.frame(values, origin); break;
      case 'symmetry': this.assignEnum('symmetry', values, ['bilateral', 'asymmetric'], origin); break;
      case 'rest': this.rest(values, origin); break;
      case 'body': {
        const [kind, ...moduleValues] = values;
        if (!kind || !['core', 'mass', 'chain', 'limb', 'wheel', 'radial'].includes(kind.value)) {
          this.error('intent.invalid_body', 'Use: body core|mass|chain|limb|wheel|radial <id> ... .', keyword);
        } else {
          this.module(kind.value as IntentProgramModule['kind'], moduleValues, origin);
        }
        break;
      }
      case 'core': case 'mass': case 'chain': case 'limb': case 'wheel': case 'radial': this.module(keyword.value as IntentProgramModule['kind'], values, origin); break;
      case 'surface': this.surface(values, origin); break;
      case 'face': this.face(values, origin); break;
      case 'eyes': case 'nose': case 'mouth': this.faceProperty(keyword.value, values, origin); break;
      case 'style': this.style(values, origin); break;
      case 'palette': this.styleProperty(keyword.value, values, origin); break;
      default: this.error('intent.unsupported_statement', `Unsupported statement ${keyword.value}.`, keyword);
    }
  }
  private assign(name: 'asset', value: string, origin: IntentProgramSpan): void { if (!value) this.error('intent.missing_value', 'Expected a value.'); else if (this.raw.asset) this.error('intent.duplicate_declaration', `${name} is declared more than once.`); else { this.raw.asset = value; this.set(name, value, origin); } }
  private assignEnum(name: 'track' | 'domain' | 'symmetry', values: readonly Token[], allowed: readonly string[], origin: IntentProgramSpan): void {
    const value = values[0]?.value;
    if (values.length !== 1 || !value || !allowed.includes(value)) { this.error('intent.invalid_value', `Expected ${name} to be one of: ${allowed.join(', ')}.`, values[1] ?? values[0] ?? this.current()); return; }
    if (this.raw[name]) { this.error('intent.duplicate_declaration', `${name} is declared more than once.`); return; }
    (this.raw[name] as string | undefined) = value; this.set(name, value, origin);
  }
  private frame(values: readonly Token[], origin: IntentProgramSpan): void {
    if (values.length !== 2 || values[0]?.value !== 'front' || !['north', 'south', 'east', 'west'].includes(values[1]?.value ?? '')) {
      this.error('intent.invalid_frame', 'Use: frame front north|south|east|west.', values[2] ?? values[0] ?? this.current());
      return;
    }
    if (this.raw.frame) { this.error('intent.duplicate_declaration', 'frame is declared more than once.'); return; }
    this.raw.frame = values[1]!.value as RawProgram['frame']; this.set('frame', this.raw.frame, origin);
  }
  private rest(values: readonly Token[], origin: IntentProgramSpan): void {
    const kind = values[0]?.value; const detail = values.slice(1).map((token) => token.value);
    let rest: IntentProgramRest | undefined;
    if ((kind === 'neutral' && detail.length === 1 && detail[0] === 'feet') || (kind === 'feet' && detail.length === 0)) rest = { kind: 'feet' };
    if ((kind === 'neutral' && detail.length === 1 && detail[0] === 'base') || (kind === 'base' && detail.length === 0)) rest = { kind: 'base' };
    if (kind === 'airborne' && detail.length === 0) rest = { kind: 'airborne' };
    if (!rest) { this.error('intent.invalid_rest', 'Use: rest neutral feet|base, or rest airborne.'); return; }
    if (this.raw.rest) { this.error('intent.duplicate_declaration', 'rest is declared more than once.'); return; }
    this.raw.rest = rest; this.set('rest', rest, origin);
  }
  private module(kind: IntentProgramModule['kind'], values: readonly Token[], origin: IntentProgramSpan): void {
    const id = values[0]?.value; if (!id) { this.error('intent.missing_module_id', `Expected a ${kind} ID.`); return; }
    const tokens = values.slice(1).map((token) => token.value);
    const configurationTokens = tokens.filter((token) => token === 'single' || token === 'pair' || token === 'paired');
    const fromIndexes = tokens.flatMap((token, index) => token === 'from' ? [index] : []);
    const fromIndex = fromIndexes[0] ?? -1;
    const from = fromIndex >= 0 ? tokens[fromIndex + 1] : undefined;
    const modifiers = tokens.filter((token, index) => token !== 'from' && index !== fromIndex + 1 && token !== 'single' && token !== 'pair' && token !== 'paired');
    if (this.raw.body.some((module) => module.id === id)) { this.error('intent.duplicate_module', `Module "${id}" is declared more than once.`); return; }
    if (configurationTokens.length > 1 || fromIndexes.length > 1 || (fromIndex >= 0 && !from) || modifiers.length > 0) {
      this.error(
        'intent.unsupported_module_modifier',
        `Module "${id}" must use each of pairing and host at most once, with no trailing modifiers.`,
        values.find((entry) => modifiers.includes(entry.value)) ?? values[values.length - 1]
      );
      return;
    }
    const configurationText = configurationTokens[0];
    const configuration = configurationText === 'single'
      ? 'single'
      : configurationText === 'pair' || configurationText === 'paired'
        ? 'paired'
        : undefined;
    const module: IntentProgramModule = { id, kind, ...(from ? { from } : {}), ...(configuration ? { configuration } : {}), modifiers: [] };
    this.raw.body.push(module); this.set(`body.${id}`, module, origin);
  }
  private surface(values: readonly Token[], origin: IntentProgramSpan): void {
    const [id, configurationText, roleText, ...properties] = values.map((token) => token.value);
    const role = roleText === 'membrane' ? 'wing' : roleText;
    const configuration = configurationText === 'pair' ? 'paired' : configurationText === 'single' ? 'single' : undefined;
    const [fromKeyword, from, extendsKeyword, extension] = properties;
    if (
      !id ||
      !configuration ||
      !['wing', 'fin', 'sail', 'panel'].includes(role ?? '') ||
      fromKeyword !== 'from' ||
      !from ||
      extendsKeyword !== 'extends' ||
      !['lateral', 'up', 'forward', 'rearward'].includes(extension ?? '') ||
      properties.length !== 4
    ) {
      this.error('intent.invalid_surface', 'Use: surface <id> single|pair wing|fin|sail|panel from <module> extends lateral|up|forward|rearward.'); return;
    }
    if (this.raw.surfaces.some((surface) => surface.id === id)) { this.error('intent.duplicate_surface', `Surface "${id}" is declared more than once.`); return; }
    const surface: IntentProgramSurface = { id, configuration, role: role as IntentProgramSurface['role'], from, extension: extension as IntentProgramSurface['extension'] };
    this.raw.surfaces.push(surface); this.set(`surfaces.${id}`, surface, origin);
  }
  private face(values: readonly Token[], origin: IntentProgramSpan): void {
    if (this.raw.face) { this.error('intent.duplicate_declaration', 'face is declared more than once.'); return; }
    if (values[0]?.value === 'none' && values.length === 1) { this.raw.face = { kind: 'none' }; this.set('face', this.raw.face, origin); return; }
    if (values.length === 1 && values[0]?.value === 'full') { this.raw.face = { kind: 'full' }; this.set('face', this.raw.face, origin); return; }
    if (values.length === 0 || ['eyes', 'nose', 'mouth'].includes(values[0]?.value ?? '')) {
      this.raw.face = { kind: 'full' }; this.set('face', this.raw.face, origin);
      if (values.length > 0) this.inlineFace(values, origin);
      return;
    }
    this.error('intent.invalid_face', 'Use: face none, face full, or face eyes|nose|mouth ... .', values[0] ?? this.current());
  }
  private faceProperty(keyword: string, values: readonly Token[], origin: IntentProgramSpan): void {
    if (!this.raw.face) { this.raw.face = { kind: 'full' }; this.set('face', this.raw.face, origin); }
    this.inlineFace([{ value: keyword, kind: 'word', span: { start: origin.start, end: origin.end } }, ...values], origin);
  }
  private inlineFace(values: readonly Token[], origin: IntentProgramSpan): void {
    if (!this.raw.face || this.raw.face.kind === 'none') { this.error('intent.invalid_face_property', 'Face properties require a full face.'); return; }
    for (let index = 0; index < values.length; index += 1) {
      const token = values[index]!.value;
      if (token === 'eyes') {
        if (this.raw.face.eyes) { this.error('intent.duplicate_declaration', 'eyes is declared more than once.', values[index]!); return; }
        const configuration = values[index + 1]?.value;
        const statesGaze = values[index + 2]?.value === 'gaze';
        const gaze = statesGaze ? values[index + 3]?.value : 'center';
        if (
          !['single', 'pair', 'paired'].includes(configuration ?? '') ||
          gaze !== 'center'
        ) {
          this.error(
            'intent.invalid_eyes',
            'Use: eyes single|pair [gaze center].'
          );
        } else {
          this.raw.face.eyes = configuration === 'single' ? 'single' : 'paired';
          this.raw.face.gaze = 'center';
          this.set('face.eyes', this.raw.face.eyes, origin);
        }
        index += statesGaze ? 3 : 1;
      }
      else if (token === 'nose') { if (this.raw.face.nose) { this.error('intent.duplicate_declaration', 'nose is declared more than once.', values[index]!); return; } const nose = values[index + 1]?.value; if (!['present', 'absent'].includes(nose ?? '')) this.error('intent.invalid_nose', 'Use: nose present|absent.'); else { this.raw.face.nose = nose as IntentProgramFace['nose']; this.set('face.nose', nose, origin); } index += 1; }
      else if (token === 'mouth') { if (this.raw.face.mouth) { this.error('intent.duplicate_declaration', 'mouth is declared more than once.', values[index]!); return; } const mouth = values[index + 1]?.value; if (!['absent', 'neutral', 'beak', 'fang'].includes(mouth ?? '')) this.error('intent.invalid_mouth', 'Use: mouth absent|neutral|beak|fang.'); else { this.raw.face.mouth = mouth as IntentProgramFace['mouth']; this.set('face.mouth', mouth, origin); } index += 1; }
      else { this.error('intent.invalid_face', 'Use only eyes, nose, and mouth face properties.', values[index]!); }
    }
  }
  private style(values: readonly Token[], origin: IntentProgramSpan): void { this.inlineStyle(values, origin); }
  private styleProperty(keyword: string, values: readonly Token[], origin: IntentProgramSpan): void { this.inlineStyle([{ kind: 'word', value: keyword, span: { start: origin.start, end: origin.end } }, ...values], origin); }
  private inlineStyle(values: readonly Token[], origin: IntentProgramSpan): void { for (let index = 0; index < values.length; index += 1) { const key = values[index]!.value; const item = values[index + 1]?.value; if (key === 'palette' && item) { if (this.raw.style.palette) { this.error('intent.duplicate_declaration', 'palette is declared more than once.', values[index]!); return; } if (!['natural', 'ember', 'ocean', 'noir', 'metal', 'gold'].includes(item)) this.error('intent.invalid_palette', 'Use one semantic palette: natural, ember, ocean, noir, metal, or gold.', values[index + 1]); else { this.raw.style = { ...this.raw.style, palette: item }; this.set('style.palette', item, origin); } index += 1; } else { this.error('intent.invalid_style', 'Use: style palette <semantic-palette>.', values[index] ?? this.current()); } } }
}

const normalize = (raw: RawProgram, reader: Reader): IntentProgramIr | null => {
  const required = ['asset', 'track', 'domain', 'frame', 'symmetry', 'rest'] as const;
  required.forEach((field) => { if (!raw[field]) reader.diagnostics.push({ severity: 'error', code: 'intent.missing_required', message: `Missing required ${field} declaration.`, span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 0, line: 1, column: 1 } } }); });
  const face = raw.face ?? { kind: 'none' as const };
  if (face.kind === 'full' && (!face.eyes || !face.gaze || !face.nose || !face.mouth)) reader.diagnostics.push({ severity: 'error', code: 'intent.incomplete_face', message: 'A full face requires eyes, gaze center, nose, and mouth.', span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 0, line: 1, column: 1 } } });
  if (raw.symmetry === 'bilateral' && raw.surfaces.some((surface) => surface.configuration === 'single' && surface.extension === 'lateral')) reader.diagnostics.push({ severity: 'error', code: 'intent.invalid_bilateral_surface', message: 'A bilateral lateral surface must be pair, or declare asymmetric symmetry.', span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 0, line: 1, column: 1 } } });
  if (raw.symmetry === 'bilateral' && raw.body.some((module) => module.configuration !== 'paired' && ['limb', 'wheel'].includes(module.kind))) reader.diagnostics.push({ severity: 'error', code: 'intent.unpaired_bilateral_module', message: 'Bilateral limb and wheel modules must be declared pair.', span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 0, line: 1, column: 1 } } });
  if (raw.symmetry === 'asymmetric' && raw.rest?.kind === 'feet') reader.diagnostics.push({ severity: 'error', code: 'intent.asymmetric_feet_unsupported', message: 'Neutral feet currently require bilateral symmetry; use bilateral symmetry, a base, or airborne rest.', span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 0, line: 1, column: 1 } } });
  if (reader.diagnostics.some((diagnostic) => diagnostic.severity === 'error') || !raw.asset || !raw.track || !raw.domain || !raw.frame || !raw.symmetry || !raw.rest) return null;
  const surfaces = [...raw.surfaces].sort((left, right) => left.id.localeCompare(right.id));
  const obligations: ProjectSupportedSurfaceObligation[] = surfaces.map((surface) => ({ id: surface.id, role: surface.role, configuration: surface.configuration, extension: surface.extension }));
  const semanticContract: ProjectSemanticContract = { subjectDomain: raw.domain, canonicalSupport: raw.rest.kind === 'feet' ? { kind: 'standing-feet' } : raw.rest.kind === 'base' ? { kind: 'supported-base' } : { kind: 'airborne' }, face: face.kind === 'none' ? { kind: 'none' } : { kind: 'full', eyeConfiguration: face.eyes!, nasal: face.nose!, oral: face.mouth === 'absent' ? 'absent' : 'present' }, supportedSurfaces: obligations };
  return { asset: raw.asset, track: raw.track, domain: raw.domain, frame: { facing: raw.frame }, symmetry: raw.symmetry, rest: raw.rest, body: [...raw.body].sort((left, right) => left.id.localeCompare(right.id)), surfaces, face, style: { ...(raw.style.palette ? { palette: raw.style.palette } : {}) }, semanticContract };
};

/** Parses the closed, coordinate-free Intent Program language. */
export const parseIntentProgram = (source: string): IntentProgramParseResult => {
  const reader = new Reader(tokenize(source));
  reader.parse();
  const ir = normalize(reader.raw, reader);
  const canonical = ir ? canonicalJsonString(ir) : null;
  return { source, ast: { statements: reader.statements }, ir, canonical, hash: canonical ? hashText(canonical) : null, diagnostics: reader.diagnostics, sourceMap: reader.sourceMap };
};
