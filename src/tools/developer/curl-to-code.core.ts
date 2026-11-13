/**
 * Shared parse/rule-evaluation model for the curl-to-code tool. Turning a curl
 * command into the small `Request` model plus every string-escaping helper the
 * language generators rely on. Pure: only crypto-free string work plus
 * TextEncoder/btoa. Kept separate so both the tool orchestrator and the
 * per-language generators can import it without pulling in the run() wiring.
 */

import { ToolError } from '@/lib/types';

export interface Header {
  name: string;
  value: string;
}

export interface FormField {
  name: string;
  /** A literal value, present when the field is not a file upload. */
  value?: string;
  /** The local path from `@path`, present for file uploads. */
  file?: string;
  filename?: string;
  contentType?: string;
}

export type Body =
  | { kind: 'none' }
  | { kind: 'text'; content: string }
  | { kind: 'multipart'; fields: FormField[] }
  | { kind: 'binary'; file: string };

export interface Request {
  method: string;
  url: string;
  headers: Header[];
  body: Body;
  followRedirects: boolean;
  insecure: boolean;
  proxy?: string;
  timeoutMs?: number;
}

/* ------------------------------- tokenizer ------------------------------- */

/** Join shell-style line continuations (bash `\`, cmd `^`, PowerShell `` ` ``). */
function stripContinuations(text: string): string {
  return text
    .replace(/\\\r?\n/g, ' ')
    .replace(/\^\r?\n/g, ' ')
    .replace(/`\r?\n/g, ' ');
}

/** Split a command into tokens honouring single/double quotes and escapes. */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let started = false;
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;

    if (quote === "'") {
      if (ch === "'") quote = null;
      else current += ch;
      continue;
    }

    if (quote === '"') {
      if (ch === '"') {
        quote = null;
      } else if (ch === '\\') {
        const next = text[i + 1];
        if (next === '\n') i += 1;
        else if (next !== undefined && '"\\$`'.includes(next)) {
          current += next;
          i += 1;
        } else current += '\\';
      } else current += ch;
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      started = true;
      continue;
    }

    if (ch === '\\') {
      const next = text[i + 1];
      if (next === '\n') i += 1;
      else if (next !== undefined) {
        current += next;
        started = true;
        i += 1;
      } else current += '\\';
      continue;
    }

    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      if (started) {
        tokens.push(current);
        current = '';
        started = false;
      }
      continue;
    }

    current += ch;
    started = true;
  }

  if (started) tokens.push(current);
  return tokens;
}

/* --------------------------------- flags --------------------------------- */

/** Short curl options that consume the following token (or an attached value). */
const VALUE_SHORT = new Set([
  'X',
  'H',
  'd',
  'F',
  'u',
  'b',
  'c',
  'A',
  'e',
  'T',
  'o',
  'C',
  'm',
  'x',
  'U',
  'E',
  'K',
  'r',
  'z',
  'w',
  'D',
  'y',
  'Y',
  'Q',
]);

/** Long curl options that consume the next token. */
const VALUE_LONG = new Set([
  'request',
  'header',
  'data',
  'data-raw',
  'data-ascii',
  'data-binary',
  'data-urlencode',
  'json',
  'form',
  'form-string',
  'user',
  'cookie',
  'cookie-jar',
  'user-agent',
  'referer',
  'url',
  'upload-file',
  'output',
  'output-dir',
  'continue-at',
  'max-time',
  'connect-timeout',
  'proxy',
  'proxy-user',
  'resolve',
  'connect-to',
  'cacert',
  'capath',
  'cert',
  'key',
  'pass',
  'cert-type',
  'key-type',
  'ciphers',
  'pinnedpubkey',
  'range',
  'time-cond',
  'write-out',
  'dump-header',
  'config',
  'retry',
  'retry-delay',
  'retry-max-time',
  'limit-rate',
  'interface',
  'dns-servers',
  'local-port',
  'max-filesize',
  'max-redirs',
  'expect100-timeout',
  'happy-eyeballs-timeout-ms',
  'socks5',
  'socks5-hostname',
  'socks4',
  'socks4a',
  'proxy-header',
  'oauth2-bearer',
  'aws-sigv4',
  'noproxy',
  'proto',
  'proto-default',
  'proto-redir',
  'speed-limit',
  'speed-time',
  'trace',
  'trace-ascii',
  'stderr',
  'telnet-option',
  'crlfile',
  'engine',
  'egd-file',
  'random-file',
  'netrc-file',
  'unix-socket',
  'request-target',
  'hostpubmd5',
  'tls-max',
  'tlsauthtype',
  'tlspassword',
  'tlsuser',
]);

/** Unsupported-but-meaningful flags → a one-line note for the user. */
const UNSUPPORTED_NOTES: Record<string, string> = {
  resolve: 'DNS overrides (--resolve) are not represented in the generated code.',
  'connect-to': 'Connection remapping (--connect-to) is not represented.',
  cacert: 'A custom CA bundle (--cacert) is not represented.',
  capath: 'A custom CA path (--capath) is not represented.',
  cert: 'Client certificates (--cert) are not represented.',
  key: 'Client private keys (--key) are not represented.',
  'cert-type': 'Client certificate options are not represented.',
  'key-type': 'Client key options are not represented.',
  ciphers: 'Custom cipher selection is not represented.',
  pinnedpubkey: 'Certificate pinning (--pinnedpubkey) is not represented.',
  'aws-sigv4': 'AWS Signature V4 signing (--aws-sigv4) is not represented.',
  'proxy-user': 'Proxy authentication (--proxy-user) is not represented.',
};

interface ParseState {
  method?: string;
  url?: string;
  extraUrls: string[];
  get: boolean;
  head: boolean;
  headers: Header[];
  data: string[];
  json: string[];
  form: FormField[];
  user?: string;
  cookie?: string;
  userAgent?: string;
  referer?: string;
  bearer?: string;
  followRedirects: boolean;
  insecure: boolean;
  compressed: boolean;
  timeoutMs?: number;
  proxy?: string;
  uploadFile?: string;
  warnings: Set<string>;
}

function parseHeader(raw: string): Header | null {
  const idx = raw.indexOf(':');
  if (idx === -1) {
    const name = raw.replace(/;\s*$/, '').trim();
    return name ? { name, value: '' } : null;
  }
  const name = raw.slice(0, idx).trim();
  if (!name) return null;
  return { name, value: raw.slice(idx + 1).trim() };
}

function parseForm(raw: string, asString: boolean): FormField {
  const eq = raw.indexOf('=');
  const name = eq === -1 ? raw : raw.slice(0, eq);
  const rest = eq === -1 ? '' : raw.slice(eq + 1);

  if (!asString && rest.startsWith('@')) {
    const pieces = rest.slice(1).split(';');
    const file = pieces[0] ?? '';
    let filename: string | undefined;
    let contentType: string | undefined;
    for (const piece of pieces.slice(1)) {
      const [k, ...v] = piece.split('=');
      const key = (k ?? '').trim().toLowerCase();
      const value = v.join('=').trim();
      if (key === 'filename') filename = value;
      else if (key === 'type') contentType = value;
    }
    return { name, file, filename, contentType };
  }

  if (!asString && rest.startsWith('<')) return { name, file: rest.slice(1) };
  return { name, value: rest };
}

function encodeDataUrlEncoded(raw: string): string {
  const eq = raw.indexOf('=');
  if (eq === -1) return encodeURIComponent(raw);
  return `${raw.slice(0, eq)}=${encodeURIComponent(raw.slice(eq + 1))}`;
}

function parseSeconds(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const seconds = Number.parseFloat(value);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds * 1000) : undefined;
}

function handleLong(s: ParseState, name: string, value: string | undefined): void {
  const v = value ?? '';
  switch (name) {
    case 'request':
      s.method = v.toUpperCase();
      break;
    case 'header': {
      const header = parseHeader(v);
      if (header) s.headers.push(header);
      break;
    }
    case 'data':
    case 'data-raw':
    case 'data-ascii':
    case 'data-binary':
      if (v.startsWith('@')) {
        s.warnings.add(
          `Body from a file (${v}) cannot be read in the browser — paste its contents.`,
        );
      } else s.data.push(v);
      break;
    case 'data-urlencode':
      if (v.startsWith('@')) {
        s.warnings.add(
          `Body from a file (${v}) cannot be read in the browser — paste its contents.`,
        );
      } else s.data.push(encodeDataUrlEncoded(v));
      break;
    case 'json':
      if (v.startsWith('@')) {
        s.warnings.add(
          `JSON body from a file (${v}) cannot be read in the browser — paste its contents.`,
        );
      } else s.json.push(v);
      break;
    case 'form':
      s.form.push(parseForm(v, false));
      break;
    case 'form-string':
      s.form.push(parseForm(v, true));
      break;
    case 'get':
      s.get = true;
      break;
    case 'head':
      s.head = true;
      break;
    case 'user':
      s.user = v;
      break;
    case 'cookie':
      s.cookie = s.cookie ? `${s.cookie}; ${v}` : v;
      break;
    case 'user-agent':
      s.userAgent = v;
      break;
    case 'referer':
      s.referer = v;
      break;
    case 'url':
      s.url = v;
      break;
    case 'location':
      s.followRedirects = true;
      break;
    case 'insecure':
      s.insecure = true;
      break;
    case 'compressed':
      s.compressed = true;
      break;
    case 'max-time':
    case 'connect-timeout': {
      const ms = parseSeconds(v);
      if (ms !== undefined) s.timeoutMs = Math.min(ms, s.timeoutMs ?? Number.MAX_SAFE_INTEGER);
      break;
    }
    case 'proxy':
      s.proxy = v;
      break;
    case 'upload-file':
      s.uploadFile = v;
      break;
    case 'oauth2-bearer':
      s.bearer = v;
      break;
    default: {
      const note = UNSUPPORTED_NOTES[name];
      if (note) s.warnings.add(note);
      break;
    }
  }
}

const SHORT_TO_LONG: Record<string, string> = {
  X: 'request',
  H: 'header',
  d: 'data',
  F: 'form',
  u: 'user',
  b: 'cookie',
  c: 'cookie-jar',
  A: 'user-agent',
  e: 'referer',
  T: 'upload-file',
  o: 'output',
  m: 'max-time',
  x: 'proxy',
  G: 'get',
  I: 'head',
  L: 'location',
  k: 'insecure',
  U: 'proxy-user',
  E: 'cert',
  K: 'config',
  r: 'range',
  z: 'time-cond',
  w: 'write-out',
  D: 'dump-header',
  y: 'speed-limit',
  Y: 'speed-time',
};

/* ------------------------------- finalize -------------------------------- */

function toBase64Utf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function basename(path: string): string {
  const clean = path.replace(/\\/g, '/');
  const idx = clean.lastIndexOf('/');
  return idx === -1 ? clean : clean.slice(idx + 1);
}

function appendQuery(url: string, query: string): string {
  if (!query) return url;
  const hashIdx = url.indexOf('#');
  const base = hashIdx === -1 ? url : url.slice(0, hashIdx);
  const hash = hashIdx === -1 ? '' : url.slice(hashIdx);
  return `${base}${base.includes('?') ? '&' : '?'}${query}${hash}`;
}

function finalize(s: ParseState): Request {
  const headers = [...s.headers];
  const has = (name: string) => headers.some((h) => h.name.toLowerCase() === name.toLowerCase());

  const parts = [...s.json, ...s.data];
  let body: Body;
  let contentType: string | undefined;

  if (s.form.length) {
    body = { kind: 'multipart', fields: s.form };
    if (s.form.some((field) => field.file !== undefined)) {
      s.warnings.add(
        'File uploads reference local paths the browser cannot read — supply the real File/Blob or stream (see the TODO/placeholder).',
      );
    }
  } else if (parts.length) {
    const content = parts.join('&');
    contentType = s.json.length ? 'application/json' : 'application/x-www-form-urlencoded';
    body = { kind: 'text', content };
    if (!has('content-type')) headers.push({ name: 'Content-Type', value: contentType });
    if (s.json.length && !has('accept'))
      headers.push({ name: 'Accept', value: 'application/json' });
  } else if (s.uploadFile) {
    body = { kind: 'binary', file: s.uploadFile };
    if (!has('content-type'))
      headers.push({ name: 'Content-Type', value: 'application/octet-stream' });
  } else {
    body = { kind: 'none' };
  }

  let url = s.url ?? '';
  if (s.get && parts.length) {
    url = appendQuery(url, parts.join('&'));
    body = { kind: 'none' };
  }

  if (s.userAgent && !has('user-agent')) headers.push({ name: 'User-Agent', value: s.userAgent });
  if (s.referer && !has('referer')) headers.push({ name: 'Referer', value: s.referer });
  if (s.cookie && !has('cookie')) headers.push({ name: 'Cookie', value: s.cookie });
  if (s.bearer && !has('authorization')) {
    headers.push({ name: 'Authorization', value: `Bearer ${s.bearer}` });
  }
  if (s.user !== undefined && !has('authorization')) {
    const sep = s.user.indexOf(':');
    const user = sep === -1 ? s.user : s.user.slice(0, sep);
    const pass = sep === -1 ? '' : s.user.slice(sep + 1);
    if (sep === -1) s.warnings.add('The -u option had no ":" — the password is treated as empty.');
    headers.push({ name: 'Authorization', value: `Basic ${toBase64Utf8(`${user}:${pass}`)}` });
  }
  if (s.compressed && !has('accept-encoding')) {
    headers.push({ name: 'Accept-Encoding', value: 'gzip, deflate, br' });
  }

  let method = s.method;
  if (!method && s.head) method = 'HEAD';
  if (!method) {
    if (s.get) method = 'GET';
    else if (s.uploadFile && !parts.length && !s.form.length) method = 'PUT';
    else if (parts.length || s.form.length) method = 'POST';
    else method = 'GET';
  }

  if (headers.some((h) => /^(authorization|cookie|x-api-key|api-key)$/i.test(h.name))) {
    s.warnings.add('This request carries credentials — avoid committing the generated code.');
  }

  return {
    method,
    url,
    headers,
    body,
    followRedirects: s.followRedirects,
    insecure: s.insecure,
    proxy: s.proxy,
    timeoutMs: s.timeoutMs,
  };
}

export function parseCommand(text: string): { request: Request; warnings: string[] } {
  const tokens = tokenize(stripContinuations(text));
  const curlIndex = tokens.findIndex((t) => /(^|[\\/])curl(\.exe)?$/i.test(t));
  if (curlIndex === -1) {
    throw new ToolError(
      'This does not look like a curl command.',
      'Start with “curl”, e.g. curl https://example.com',
    );
  }

  const s: ParseState = {
    extraUrls: [],
    get: false,
    head: false,
    headers: [],
    data: [],
    json: [],
    form: [],
    followRedirects: false,
    insecure: false,
    compressed: false,
    warnings: new Set(),
  };

  for (let i = curlIndex + 1; i < tokens.length; i += 1) {
    const token = tokens[i]!;

    if (token === '--') {
      for (let j = i + 1; j < tokens.length; j += 1) considerUrl(s, tokens[j]!);
      break;
    }

    if (token.startsWith('--') && token.length > 2) {
      let name = token.slice(2);
      let value: string | undefined;
      const eq = name.indexOf('=');
      if (eq !== -1) {
        value = name.slice(eq + 1);
        name = name.slice(0, eq);
      } else if (VALUE_LONG.has(name)) {
        value = tokens[(i += 1)];
        if (value === undefined) s.warnings.add(`--${name} expects a value that was not supplied.`);
      }
      handleLong(s, name, value);
      continue;
    }

    if (token.startsWith('-') && token.length > 1) {
      let rest = token.slice(1);
      while (rest.length) {
        const ch = rest[0]!;
        rest = rest.slice(1);
        if (VALUE_SHORT.has(ch)) {
          let value: string | undefined = rest;
          rest = '';
          if (!value) {
            value = tokens[(i += 1)];
            if (value === undefined)
              s.warnings.add(`-${ch} expects a value that was not supplied.`);
          }
          handleLong(s, SHORT_TO_LONG[ch] ?? ch, value);
        } else {
          handleLong(s, SHORT_TO_LONG[ch] ?? ch, undefined);
        }
      }
      continue;
    }

    considerUrl(s, token);
  }

  if (!s.url) {
    throw new ToolError(
      'No URL found in the command.',
      'Add a URL, for example: curl https://example.com',
    );
  }
  if (s.extraUrls.length) {
    s.warnings.add('Only the first URL was converted; later URLs were ignored.');
  }

  return { request: finalize(s), warnings: [...s.warnings] };
}

function considerUrl(s: ParseState, candidate: string): void {
  if (!s.url) s.url = candidate;
  else s.extraUrls.push(candidate);
}

/* ------------------------------ escaping --------------------------------- */

export function jsStr(value: string): string {
  if (
    value.includes('\n') &&
    !value.includes('`') &&
    !value.includes('${') &&
    !value.includes('\\')
  ) {
    return `\`${value}\``;
  }
  return JSON.stringify(value);
}

const BACKSLASH_ESCAPES: Record<string, string> = {
  '\\': '\\\\',
  '"': '\\"',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
};

export function cLikeStr(value: string): string {
  return `"${value.replace(/[\\"\n\r\t]/g, (ch) => BACKSLASH_ESCAPES[ch] ?? ch)}"`;
}

export function pyStr(value: string): string {
  return `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')}'`;
}

export function rubyStr(value: string): string {
  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/#\{/g, '\\#{')}"`;
}

export function phpStr(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function goStr(value: string): string {
  if (!value.includes('`') && !value.includes('\r')) return `\`${value}\``;
  return cLikeStr(value);
}

export function psStr(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Render milliseconds as a compact decimal-seconds string (e.g. 30000 -> "30"). */
export function secondsText(ms: number): string {
  return (ms / 1000).toFixed(3).replace(/\.?0+$/, '');
}

/** Preferred `reqwest::Method` constant for well-known verbs, else parsed. */
export function rustMethod(method: string): string {
  const known = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  return known.includes(method)
    ? `reqwest::Method::${method}`
    : `reqwest::Method::from_bytes(b"${method}")?`;
}

/* --------------------------- shared derivations -------------------------- */

export function getHeader(request: Request, name: string): string | undefined {
  const target = name.toLowerCase();
  return request.headers.find((h) => h.name.toLowerCase() === target)?.value;
}

export function textBody(request: Request): string {
  return request.body.kind === 'text' ? request.body.content : '';
}

export const MULTIPART_BOUNDARY = '----TesseraeBoundary7d31a4f2c9e0';

/** Build a multipart body string; file parts carry a placeholder payload. */
export function buildMultipart(boundary: string, fields: FormField[]): string {
  const lines: string[] = [];
  for (const field of fields) {
    lines.push(`--${boundary}`);
    if (field.file !== undefined) {
      const filename = field.filename ?? basename(field.file);
      lines.push(`Content-Disposition: form-data; name="${field.name}"; filename="${filename}"`);
      lines.push(`Content-Type: ${field.contentType ?? 'application/octet-stream'}`);
      lines.push('');
      lines.push(`<contents of ${field.file}>`);
    } else {
      lines.push(`Content-Disposition: form-data; name="${field.name}"`);
      lines.push('');
      lines.push(field.value ?? '');
    }
  }
  lines.push(`--${boundary}--`);
  return `${lines.join('\r\n')}\r\n`;
}

export function multipartFields(request: Request): FormField[] {
  return request.body.kind === 'multipart' ? request.body.fields : [];
}
