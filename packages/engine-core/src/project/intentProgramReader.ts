import { resolveIntentProgramSourceSpan } from './intentProgramTypes';
import type {
  IntentProgramAstField,
  IntentProgramAstStatement,
  IntentProgramDiagnostic,
  IntentProgramIdleMotion,
  IntentProgramModule,
  IntentProgramModuleExtension,
  IntentProgramPalette,
  IntentProgramSpan,
  IntentProgramSurface,
  IntentProgramSurfaceExtension
} from './intentProgramTypes';
import {
  fallbackIntentProgramSpan,
  intentProgramStatementSpan,
  type IntentProgramToken
} from './intentProgramLexing';
import {
  identifierPattern,
  moduleDirections,
  moduleKinds,
  normalizeIntentText,
  pairedSurfaceDirections,
  palettes,
  rootKeywords,
  singleSurfaceDirections,
  type RawIntentProgram
} from './intentProgramSyntax';

export class IntentProgramReader {
  private index = 0;
  private activeFields: IntentProgramAstField[] | null = null;
  readonly diagnostics: IntentProgramDiagnostic[];
  readonly sourceMap: Record<string, IntentProgramSpan> = {};
  readonly statements: IntentProgramAstStatement[] = [];
  readonly raw: RawIntentProgram = { body: [], surfaces: [], style: {} };

  constructor(
    private readonly tokens: readonly IntentProgramToken[],
    lexicalDiagnostics: readonly IntentProgramDiagnostic[]
  ) { this.diagnostics = [...lexicalDiagnostics]; }

  private current(): IntentProgramToken { return this.tokens[this.index]!; }
  private take(): IntentProgramToken { const token = this.current(); this.index += 1; return token; }
  private error(code: string, message: string, token = this.current()): void {
    this.diagnostics.push({ severity: 'error', code, message, span: token.span });
  }
  reportPath(code: string, message: string, path: string): void {
    this.diagnostics.push({
      severity: 'error',
      code,
      message,
      span: resolveIntentProgramSourceSpan(this.sourceMap, path) ?? fallbackIntentProgramSpan
    });
  }
  private consumeLines(): void { while (this.current().kind === 'line') this.take(); }
  private values(): IntentProgramToken[] {
    const values: IntentProgramToken[] = [];
    while (!['line', 'open', 'close', 'end'].includes(this.current().kind)) values.push(this.take());
    return values;
  }
  private isWord(token: IntentProgramToken | undefined, value: string): boolean {
    return token?.kind === 'word' && token.value === value;
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
      this.error('intent.invalid_identifier', `${label} must be lower-kebab-case (for example, "front-leg").`, token);
      return null;
    }
    return token.value;
  }
  private set(path: string, value: string, origin: IntentProgramSpan): void {
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
  private declarationStatement(
    keyword: IntentProgramToken,
    values: readonly IntentProgramToken[],
    declaration: () => void
  ): void {
    const fields: IntentProgramAstField[] = [];
    this.activeFields = fields;
    declaration();
    this.activeFields = null;
    this.record(keyword, values, fields);
  }

  parse(): void {
    this.consumeLines();
    while (this.current().kind !== 'end') {
      if (this.current().kind === 'close') {
        this.error('intent.unexpected_close', 'Unexpected closing brace.');
        this.take();
      } else this.statement();
      this.consumeLines();
    }
  }

  private statement(): void {
    const keyword = this.take();
    if (keyword.kind !== 'word') {
      this.error('intent.expected_statement', 'Expected an intent statement.', keyword);
      return;
    }
    if (!rootKeywords.has(keyword.value)) {
      this.error('intent.unknown_statement', `Unknown intent statement "${keyword.value}".`, keyword);
      this.values();
      return;
    }
    if (this.current().kind === 'open') {
      this.take();
      if (keyword.value === 'body' || keyword.value === 'face' || keyword.value === 'style') {
        this.record(keyword, [], []);
        this.block(keyword.value);
      } else {
        this.error('intent.invalid_block', `${keyword.value} cannot use a block.`, keyword);
        this.skipBlock();
      }
      return;
    }
    const values = this.values();
    this.declarationStatement(keyword, values, () => this.declaration(keyword, values));
  }

  private skipBlock(): void {
    let depth = 1;
    while (depth > 0 && this.current().kind !== 'end') {
      const token = this.take();
      if (token.kind === 'open') depth += 1;
      if (token.kind === 'close') depth -= 1;
    }
  }
  private block(context: 'body' | 'face' | 'style'): void {
    this.consumeLines();
    while (this.current().kind !== 'close' && this.current().kind !== 'end') {
      if (context === 'body') this.bodyBlockStatement();
      else if (context === 'face') this.faceBlockStatement();
      else this.styleBlockStatement();
      this.consumeLines();
    }
    if (this.current().kind === 'close') this.take();
    else this.error('intent.unclosed_block', `Unclosed ${context} block.`);
  }
  private bodyBlockStatement(): void {
    const kind = this.take();
    if (kind.kind !== 'word' || !moduleKinds.has(kind.value)) {
      this.error('intent.invalid_block_statement', 'A body block contains only core, mass, chain, limb, wheel, or radial declarations.', kind);
      this.values();
      return;
    }
    const values = this.values();
    this.declarationStatement(kind, values, () => this.module(kind, values));
  }
  private faceBlockStatement(): void {
    const keyword = this.take();
    const values = this.values();
    if (keyword.kind !== 'word') {
      this.error('intent.invalid_block_statement', 'A face block contains full, eyes, nose, or mouth declarations.', keyword);
      return;
    }
    if (keyword.value === 'full') {
      this.declarationStatement(keyword, values, () => this.face([keyword, ...values]));
      return;
    }
    if (keyword.value === 'eyes' || keyword.value === 'nose' || keyword.value === 'mouth') {
      this.declarationStatement(keyword, values, () => this.faceProperty(keyword, values));
      return;
    }
    this.error('intent.invalid_block_statement', 'A face block contains full, eyes, nose, or mouth declarations.', keyword);
  }
  private styleBlockStatement(): void {
    const keyword = this.take();
    const values = this.values();
    if (keyword.kind === 'word' && keyword.value === 'palette') {
      this.declarationStatement(keyword, values, () => this.style([keyword, ...values]));
      return;
    }
    this.error('intent.invalid_block_statement', 'A style block contains only a palette declaration.', keyword);
  }

  private declaration(keyword: IntentProgramToken, values: readonly IntentProgramToken[]): void {
    switch (keyword.value) {
      case 'asset': this.asset(values); break;
      case 'track': this.assignEnum('track', values, ['essential', 'hero']); break;
      case 'domain': this.assignEnum('domain', values, ['organism', 'constructed']); break;
      case 'frame': this.frame(values); break;
      case 'symmetry': this.assignEnum('symmetry', values, ['bilateral', 'asymmetric']); break;
      case 'rest': this.rest(values); break;
      case 'body': this.body(values); break;
      case 'surface': this.surface(values); break;
      case 'face': this.face(values); break;
      case 'eyes':
      case 'nose':
      case 'mouth': this.faceProperty(keyword, values); break;
      case 'focal': this.focal(values); break;
      case 'motion': this.motion(values); break;
      case 'style': this.style(values); break;
      default: this.error('intent.unsupported_statement', `Unsupported statement ${keyword.value}.`, keyword);
    }
  }
  private asset(values: readonly IntentProgramToken[]): void {
    const value = values[0];
    if (values.length !== 1 || value?.kind !== 'string') {
      this.error('intent.asset_requires_quoted_string', 'Use: asset "Display Name".', values[1] ?? value ?? this.current());
      return;
    }
    const asset = normalizeIntentText(value.value);
    if (!asset) {
      this.error('intent.missing_value', 'Asset name cannot be empty.', value);
      return;
    }
    if (this.raw.asset) {
      this.error('intent.duplicate_declaration', 'asset is declared more than once.', value);
      return;
    }
    this.raw.asset = asset;
    this.set('asset', asset, value.span);
  }
  private assignEnum(
    name: 'track' | 'domain' | 'symmetry',
    values: readonly IntentProgramToken[],
    allowed: readonly string[]
  ): void {
    const value = values[0];
    if (values.length !== 1 || value?.kind !== 'word' || !allowed.includes(value.value)) {
      this.error('intent.invalid_value', `Expected ${name} to be one of: ${allowed.join(', ')}.`, values[1] ?? value ?? this.current());
      return;
    }
    if (this.raw[name]) {
      this.error('intent.duplicate_declaration', `${name} is declared more than once.`, value);
      return;
    }
    if (name === 'track') this.raw.track = value.value as RawIntentProgram['track'];
    if (name === 'domain') this.raw.domain = value.value as RawIntentProgram['domain'];
    if (name === 'symmetry') this.raw.symmetry = value.value as RawIntentProgram['symmetry'];
    this.set(name, value.value, value.span);
  }
  private frame(values: readonly IntentProgramToken[]): void {
    const direction = values[1];
    if (values.length !== 2 || !this.isWord(values[0], 'front') || direction?.kind !== 'word' || !['north', 'south', 'east', 'west'].includes(direction.value)) {
      this.error('intent.invalid_frame', 'Use: frame front north|south|east|west.', values[2] ?? values[0] ?? this.current());
      return;
    }
    if (this.raw.frame) {
      this.error('intent.duplicate_declaration', 'frame is declared more than once.', direction);
      return;
    }
    this.raw.frame = direction.value as RawIntentProgram['frame'];
    this.set('frame', direction.value, direction.span);
    this.set('frame.facing', direction.value, direction.span);
  }
  private rest(values: readonly IntentProgramToken[]): void {
    if (values.length === 1 && this.isWord(values[0], 'airborne')) {
      if (this.raw.rest) {
        this.error('intent.duplicate_declaration', 'rest is declared more than once.', values[0]!);
        return;
      }
      this.raw.rest = { kind: 'airborne' };
      this.set('rest', 'airborne', values[0]!.span);
      this.set('rest.kind', 'airborne', values[0]!.span);
      return;
    }
    const kind = values[1];
    const hostToken = values[3];
    if (values.length !== 4 || !this.isWord(values[0], 'neutral') || kind?.kind !== 'word' || !['feet', 'base', 'wheels'].includes(kind.value) || !this.isWord(values[2], 'on')) {
      this.error('intent.invalid_rest', 'Use: rest neutral feet|base|wheels on <body-id>, or rest airborne.', values[4] ?? values[0] ?? this.current());
      return;
    }
    const host = this.identifier(hostToken, 'a rest host body ID', 'intent.missing_rest_host');
    if (!host) return;
    if (this.raw.rest) {
      this.error('intent.duplicate_declaration', 'rest is declared more than once.', kind);
      return;
    }
    this.raw.rest = { kind: kind.value as 'feet' | 'base' | 'wheels', on: host };
    this.set('rest', kind.value, kind.span);
    this.set('rest.kind', kind.value, kind.span);
    this.set('rest.on', host, hostToken!.span);
  }
  private body(values: readonly IntentProgramToken[]): void {
    const kind = values[0];
    if (!kind || kind.kind !== 'word' || !moduleKinds.has(kind.value)) {
      this.error('intent.invalid_body', 'Use: body core|mass|chain|limb|wheel|radial <id> ... .', kind ?? this.current());
      return;
    }
    this.module(kind, values.slice(1));
  }
  private module(kindToken: IntentProgramToken, values: readonly IntentProgramToken[]): void {
    const kind = kindToken.value as IntentProgramModule['kind'];
    const idToken = values[0];
    const id = this.identifier(idToken, `${kind} body ID`, 'intent.missing_module_id');
    if (!id) return;
    if (this.raw.body.some((module) => module.id === id)) {
      this.error('intent.duplicate_module', `Module "${id}" is declared more than once.`, idToken);
      return;
    }
    if (kind === 'core') {
      if (values.length !== 1) {
        this.error('intent.invalid_core', 'Use: body core <id>.', values[1] ?? idToken);
        return;
      }
      this.raw.body.push({ id, kind: 'core', modifiers: [] });
      this.set(`body.${id}`, id, idToken!.span);
      this.set(`body.${id}.id`, id, idToken!.span);
      this.set(`body.${id}.kind`, kind, kindToken.span);
      return;
    }
    const requiresPair = kind === 'limb' || kind === 'wheel';
    const pairToken = requiresPair ? values[1] : undefined;
    const offset = requiresPair ? 2 : 1;
    const fromToken = values[offset];
    const hostToken = values[offset + 1];
    const extendsToken = values[offset + 2];
    const directionToken = values[offset + 3];
    const expectedLength = requiresPair ? 6 : 5;
    if (values.length !== expectedLength || (requiresPair && !this.isWord(pairToken, 'pair')) || !this.isWord(fromToken, 'from') || !this.isWord(extendsToken, 'extends') || directionToken?.kind !== 'word' || !moduleDirections.has(directionToken.value as IntentProgramModuleExtension)) {
      const configuration = requiresPair ? 'pair ' : '';
      this.error('intent.invalid_body_relation', `Use: body ${kind} <id> ${configuration}from <host> extends forward|rearward|up|down|left|right.`, values[expectedLength] ?? pairToken ?? fromToken ?? this.current());
      return;
    }
    const from = this.identifier(hostToken, 'a body host ID', 'intent.missing_module_host');
    if (!from) return;
    const extension = directionToken.value as IntentProgramModuleExtension;
    const module: IntentProgramModule = {
      id,
      kind,
      from,
      extension,
      ...(requiresPair ? { configuration: 'paired' as const } : {}),
      modifiers: []
    };
    this.raw.body.push(module);
    this.set(`body.${id}`, id, idToken!.span);
    this.set(`body.${id}.id`, id, idToken!.span);
    this.set(`body.${id}.kind`, kind, kindToken.span);
    this.set(`body.${id}.from`, from, hostToken!.span);
    this.set(`body.${id}.extension`, extension, directionToken.span);
    if (requiresPair) this.set(`body.${id}.configuration`, 'paired', pairToken!.span);
  }
  private surface(values: readonly IntentProgramToken[]): void {
    const [idToken, configurationToken, roleToken, fromToken, hostToken, extendsToken, extensionToken] = values;
    const id = this.identifier(idToken, 'a surface ID', 'intent.missing_surface_id');
    if (!id) return;
    if (values.length !== 7 || configurationToken?.kind !== 'word' || !['single', 'pair'].includes(configurationToken.value) || roleToken?.kind !== 'word' || !['wing', 'fin', 'sail', 'panel'].includes(roleToken.value) || !this.isWord(fromToken, 'from') || !this.isWord(extendsToken, 'extends') || extensionToken?.kind !== 'word') {
      this.error('intent.invalid_surface', 'Use: surface <id> single|pair wing|fin|sail|panel from <body-id> extends <direction>.', values[7] ?? configurationToken ?? this.current());
      return;
    }
    const configuration = configurationToken.value === 'pair' ? 'paired' : 'single';
    const extension = extensionToken.value as IntentProgramSurfaceExtension;
    const allowed = configuration === 'paired' ? pairedSurfaceDirections : singleSurfaceDirections;
    if (!allowed.has(extension)) {
      this.error('intent.invalid_surface_direction', configuration === 'paired' ? 'Paired surfaces extend lateral, up, forward, or rearward.' : 'Single surfaces extend left, right, up, forward, or rearward; lateral requires pair.', extensionToken);
      return;
    }
    const from = this.identifier(hostToken, 'a surface host body ID', 'intent.missing_surface_host');
    if (!from) return;
    if (this.raw.surfaces.some((surface) => surface.id === id)) {
      this.error('intent.duplicate_surface', `Surface "${id}" is declared more than once.`, idToken);
      return;
    }
    const surface: IntentProgramSurface = { id, configuration, role: roleToken.value as IntentProgramSurface['role'], from, extension };
    this.raw.surfaces.push(surface);
    this.set(`surfaces.${id}`, id, idToken!.span);
    this.set(`surfaces.${id}.id`, id, idToken!.span);
    this.set(`surfaces.${id}.configuration`, configuration, configurationToken.span);
    this.set(`surfaces.${id}.role`, roleToken.value, roleToken.span);
    this.set(`surfaces.${id}.from`, from, hostToken!.span);
    this.set(`surfaces.${id}.extension`, extension, extensionToken.span);
  }
  private face(values: readonly IntentProgramToken[]): void {
    if (this.raw.face) {
      this.error('intent.duplicate_declaration', 'face is declared more than once.', values[0] ?? this.current());
      return;
    }
    const kind = values[0];
    if (values.length === 1 && this.isWord(kind, 'none')) {
      this.raw.face = { kind: 'none' };
      this.set('face', 'none', kind!.span);
      this.set('face.kind', 'none', kind!.span);
      return;
    }
    const hostToken = values[2];
    if (values.length !== 3 || !this.isWord(kind, 'full') || !this.isWord(values[1], 'on')) {
      this.error('intent.invalid_face', 'Use: face none, or face full on <body-id>.', values[3] ?? kind ?? this.current());
      return;
    }
    const on = this.identifier(hostToken, 'a face host body ID', 'intent.missing_face_host');
    if (!on) return;
    this.raw.face = { kind: 'full', on };
    this.set('face', 'full', kind!.span);
    this.set('face.kind', 'full', kind!.span);
    this.set('face.on', on, hostToken!.span);
  }
  private faceProperty(keyword: IntentProgramToken, values: readonly IntentProgramToken[]): void {
    const face = this.raw.face;
    if (!face || face.kind !== 'full') {
      this.error('intent.invalid_face_property', 'Declare face full on <body-id> before face properties.', keyword);
      return;
    }
    if (keyword.value === 'eyes') {
      const configuration = values[0];
      const gaze = values[2];
      if (values.length !== 3 || configuration?.kind !== 'word' || !['single', 'pair'].includes(configuration.value) || !this.isWord(values[1], 'gaze') || !this.isWord(gaze, 'center')) {
        this.error('intent.invalid_eyes', 'Use: eyes single|pair gaze center.', values[3] ?? configuration ?? this.current());
        return;
      }
      if (face.eyes) {
        this.error('intent.duplicate_declaration', 'eyes is declared more than once.', keyword);
        return;
      }
      const eyes = configuration.value === 'pair' ? 'paired' : 'single';
      this.raw.face = { ...face, eyes, gaze: 'center' };
      this.set('face.eyes', eyes, configuration.span);
      this.set('face.gaze', 'center', gaze!.span);
      return;
    }
    if (keyword.value === 'nose') {
      const value = values[0];
      if (values.length !== 1 || value?.kind !== 'word' || !['present', 'absent'].includes(value.value)) {
        this.error('intent.invalid_nose', 'Use: nose present|absent.', values[1] ?? value ?? this.current());
        return;
      }
      if (face.nose) {
        this.error('intent.duplicate_declaration', 'nose is declared more than once.', keyword);
        return;
      }
      this.raw.face = { ...face, nose: value.value as 'present' | 'absent' };
      this.set('face.nose', value.value, value.span);
      return;
    }
    const value = values[0];
    if (values.length !== 1 || value?.kind !== 'word' || !['absent', 'neutral', 'beak', 'fang'].includes(value.value)) {
      this.error('intent.invalid_mouth', 'Use: mouth absent|neutral|beak|fang.', values[1] ?? value ?? this.current());
      return;
    }
    if (face.mouth) {
      this.error('intent.duplicate_declaration', 'mouth is declared more than once.', keyword);
      return;
    }
    this.raw.face = { ...face, mouth: value.value as 'absent' | 'neutral' | 'beak' | 'fang' };
    this.set('face.mouth', value.value, value.span);
  }
  private focal(values: readonly IntentProgramToken[]): void {
    const idToken = values[0];
    const hostToken = values[2];
    if (values.length !== 3 || !this.isWord(values[1], 'on')) {
      this.error('intent.invalid_focal', 'Use: focal <id> on <body-id>.', values[3] ?? values[1] ?? this.current());
      return;
    }
    const id = this.identifier(idToken, 'a focal ID', 'intent.missing_focal_id');
    const on = this.identifier(hostToken, 'a focal host body ID', 'intent.missing_focal_host');
    if (!id || !on) return;
    if (this.raw.focal) {
      this.error('intent.duplicate_declaration', 'focal is declared more than once.', idToken);
      return;
    }
    this.raw.focal = { id, on };
    this.set('focal', id, idToken!.span);
    this.set('focal.id', id, idToken!.span);
    this.set('focal.on', on, hostToken!.span);
  }
  private motion(values: readonly IntentProgramToken[]): void {
    const mode = values[1];
    if (values.length !== 2 || !this.isWord(values[0], 'idle') || mode?.kind !== 'word' || !['still', 'breathe', 'scan'].includes(mode.value)) {
      this.error('intent.invalid_motion', 'Use: motion idle still|breathe|scan.', values[2] ?? values[0] ?? this.current());
      return;
    }
    if (this.raw.motion) {
      this.error('intent.duplicate_declaration', 'motion is declared more than once.', mode);
      return;
    }
    this.raw.motion = { kind: 'idle', mode: mode.value as IntentProgramIdleMotion };
    this.set('motion', 'idle', values[0]!.span);
    this.set('motion.kind', 'idle', values[0]!.span);
    this.set('motion.mode', mode.value, mode.span);
  }
  private style(values: readonly IntentProgramToken[]): void {
    const palette = values[1];
    if (values.length !== 2 || !this.isWord(values[0], 'palette') || palette?.kind !== 'word' || !palettes.has(palette.value as IntentProgramPalette)) {
      this.error('intent.invalid_style', 'Use: style palette natural|ember|ocean|noir|metal|gold.', values[2] ?? values[0] ?? this.current());
      return;
    }
    if (this.raw.style.palette) {
      this.error('intent.duplicate_declaration', 'palette is declared more than once.', palette);
      return;
    }
    this.raw.style = { palette: palette.value as IntentProgramPalette };
    this.set('style', palette.value, palette.span);
    this.set('style.palette', palette.value, palette.span);
  }
}
