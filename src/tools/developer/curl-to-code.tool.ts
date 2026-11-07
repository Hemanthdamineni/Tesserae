import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './curl-to-code.meta';

/* ==========================================================================
 * Parse a curl command into a small request model, then render that model as
 * equivalent code. Pure: only crypto-free string work plus TextEncoder/btoa.
 * ========================================================================== */

interface Header {
  name: string;
  value: string;
}

interface FormField {
  name: string;
  /** A literal value, present when the field is not a file upload. */
  value?: string;
  /** The local path from `@path`, present for file uploads. */
  file?: string;
  filename?: string;
  contentType?: string;
}

type Body =
  | { kind: 'none' }
  | { kind: 'text'; content: string }
  | { kind: 'multipart'; fields: FormField[] }
  | { kind: 'binary'; file: string };

interface Request {
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

function basename(path: string): string {
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

function parseCommand(text: string): { request: Request; warnings: string[] } {
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

function jsStr(value: string): string {
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

function cLikeStr(value: string): string {
  return `"${value.replace(/[\\"\n\r\t]/g, (ch) => BACKSLASH_ESCAPES[ch] ?? ch)}"`;
}

function pyStr(value: string): string {
  return `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')}'`;
}

function rubyStr(value: string): string {
  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/#\{/g, '\\#{')}"`;
}

function phpStr(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function goStr(value: string): string {
  if (!value.includes('`') && !value.includes('\r')) return `\`${value}\``;
  return cLikeStr(value);
}

function psStr(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Render milliseconds as a compact decimal-seconds string (e.g. 30000 -> "30"). */
function secondsText(ms: number): string {
  return (ms / 1000).toFixed(3).replace(/\.?0+$/, '');
}

/** Preferred `reqwest::Method` constant for well-known verbs, else parsed. */
function rustMethod(method: string): string {
  const known = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  return known.includes(method)
    ? `reqwest::Method::${method}`
    : `reqwest::Method::from_bytes(b"${method}")?`;
}

/* --------------------------- shared derivations -------------------------- */

function getHeader(request: Request, name: string): string | undefined {
  const target = name.toLowerCase();
  return request.headers.find((h) => h.name.toLowerCase() === target)?.value;
}

function textBody(request: Request): string {
  return request.body.kind === 'text' ? request.body.content : '';
}

const MULTIPART_BOUNDARY = '----TesseraeBoundary7d31a4f2c9e0';

/** Build a multipart body string; file parts carry a placeholder payload. */
function buildMultipart(boundary: string, fields: FormField[]): string {
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

function multipartFields(request: Request): FormField[] {
  return request.body.kind === 'multipart' ? request.body.fields : [];
}

/* ------------------------------ generators ------------------------------- */

function genFetch(request: Request): string {
  const lines: string[] = ['async function main() {'];
  const args: string[] = [`    method: ${jsStr(request.method)},`];

  if (request.headers.length) {
    lines.push('  const headers = {');
    for (const header of request.headers) {
      lines.push(`    ${jsStr(header.name)}: ${jsStr(header.value)},`);
    }
    lines.push('  };');
    args.push('    headers,');
  }

  const fields = multipartFields(request);
  if (fields.length) {
    lines.push('  const form = new FormData();');
    for (const field of fields) {
      if (field.file === undefined) {
        lines.push(`  form.append(${jsStr(field.name)}, ${jsStr(field.value ?? '')});`);
      } else {
        lines.push(`  // TODO: provide a File/Blob for ${jsStr(field.file)}`);
        lines.push(
          `  form.append(${jsStr(field.name)}, new Blob([]), ${jsStr(field.filename ?? basename(field.file))});`,
        );
      }
    }
    args.push('    body: form,');
  } else if (request.body.kind === 'text') {
    args.push(`    body: ${jsStr(request.body.content)},`);
  } else if (request.body.kind === 'binary') {
    lines.push(`  // TODO: build the body from ${jsStr(request.body.file)}`);
    args.push('    body: new Blob([]),');
  }

  if (!request.followRedirects) args.push('    redirect: "manual",');

  lines.push(`  const res = await fetch(${jsStr(request.url)}, {`);
  for (const arg of args) lines.push(arg);
  lines.push('  });');
  lines.push('  if (!res.ok) throw new Error(`HTTP ${res.status}`);');
  lines.push('  console.log(await res.text());');
  lines.push('}');
  lines.push('');
  lines.push('main().catch(console.error);');
  return lines.join('\n');
}

function genAxios(request: Request): string {
  const inner: string[] = [];
  const args: string[] = [
    `  method: ${jsStr(request.method.toLowerCase())},`,
    `  url: ${jsStr(request.url)},`,
  ];

  const fields = multipartFields(request);
  if (fields.length) {
    inner.push('const form = new FormData();');
    for (const field of fields) {
      if (field.file === undefined) {
        inner.push(`form.append(${jsStr(field.name)}, ${jsStr(field.value ?? '')});`);
      } else {
        inner.push(`// TODO: provide a File/Blob/stream for ${jsStr(field.file)}`);
        inner.push(
          `form.append(${jsStr(field.name)}, new Blob([]), ${jsStr(field.filename ?? basename(field.file))});`,
        );
      }
    }
    inner.push('');
    args.push('  data: form,');
  } else if (request.body.kind === 'text') {
    args.push(`  data: ${jsStr(request.body.content)},`);
  } else if (request.body.kind === 'binary') {
    inner.push(`// TODO: build the body from ${jsStr(request.body.file)}`);
    args.push('  data: Buffer.alloc(0),');
  }

  if (request.headers.length) {
    inner.push('const headers = {');
    for (const header of request.headers) {
      inner.push(`  ${jsStr(header.name)}: ${jsStr(header.value)},`);
    }
    inner.push('};');
    inner.push('');
    args.push('  headers,');
  }

  if (!request.followRedirects) args.push('  maxRedirects: 0,');

  inner.push('const response = await axios({');
  for (const arg of args) inner.push(arg);
  inner.push('});');
  inner.push('console.log(response.data);');

  const lines: string[] = ['const axios = require("axios");', '', '(async () => {'];
  for (const line of inner) lines.push(line ? `  ${line}` : '');
  lines.push('})();');
  return lines.join('\n');
}

function genNode(request: Request): string {
  const mod = request.url.startsWith('https') ? 'https' : 'http';
  const lines: string[] = [`const ${mod} = require("${mod}");`];
  const fields = multipartFields(request);

  if (fields.length) {
    lines.push('const FormData = require("form-data");');
    lines.push('const fs = require("fs");');
  } else if (request.body.kind === 'binary') {
    lines.push('const fs = require("fs");');
  }

  lines.push('');
  lines.push('const options = {');
  lines.push(`  method: ${jsStr(request.method)},`);
  if (request.headers.length && !fields.length) {
    lines.push('  headers: {');
    for (const header of request.headers) {
      lines.push(`    ${jsStr(header.name)}: ${jsStr(header.value)},`);
    }
    lines.push('  },');
  }
  if (!request.followRedirects) {
    lines.push('  // curl does not follow redirects unless you pass -L.');
  }
  lines.push('};');
  lines.push('');

  if (fields.length) {
    lines.push('const form = new FormData();');
    for (const field of fields) {
      if (field.file === undefined) {
        lines.push(`form.append(${jsStr(field.name)}, ${jsStr(field.value ?? '')});`);
      } else {
        const name = field.filename ?? basename(field.file);
        lines.push(
          `form.append(${jsStr(field.name)}, fs.createReadStream(${jsStr(field.file)}), ${jsStr(name)});`,
        );
      }
    }
    lines.push('options.headers = {');
    lines.push('  ...form.getHeaders(),');
    for (const header of request.headers) {
      lines.push(`  ${jsStr(header.name)}: ${jsStr(header.value)},`);
    }
    lines.push('};');
  } else if (request.body.kind === 'text') {
    lines.push(`const body = ${jsStr(request.body.content)};`);
  } else if (request.body.kind === 'binary') {
    lines.push(`const body = fs.readFileSync(${jsStr(request.body.file)});`);
  }

  lines.push('');
  lines.push(`const req = ${mod}.request(${jsStr(request.url)}, options, (res) => {`);
  lines.push('  let data = "";');
  lines.push('  res.on("data", (chunk) => (data += chunk));');
  lines.push('  res.on("end", () => console.log(data));');
  lines.push('});');
  lines.push('');
  lines.push('req.on("error", console.error);');
  if (fields.length) lines.push('form.pipe(req);');
  else {
    if (request.body.kind === 'text' || request.body.kind === 'binary')
      lines.push('req.write(body);');
    lines.push('req.end();');
  }
  return lines.join('\n');
}

function genPython(request: Request): string {
  const lines: string[] = ['import requests', ''];
  const args: string[] = [pyStr(request.method), pyStr(request.url)];
  const fields = multipartFields(request);

  if (request.headers.length) {
    lines.push('headers = {');
    for (const header of request.headers)
      lines.push(`    ${pyStr(header.name)}: ${pyStr(header.value)},`);
    lines.push('}');
    lines.push('');
    args.push('headers=headers');
  }

  if (fields.length) {
    const files = fields.filter((f) => f.file !== undefined);
    const data = fields.filter((f) => f.file === undefined);
    if (data.length) {
      lines.push('data = {');
      for (const field of data)
        lines.push(`    ${pyStr(field.name)}: ${pyStr(field.value ?? '')},`);
      lines.push('}');
      lines.push('');
      args.push('data=data');
    }
    lines.push('files = {');
    for (const field of files) {
      lines.push(`    ${pyStr(field.name)}: open(${pyStr(field.file ?? '')}, "rb"),`);
    }
    lines.push('}');
    lines.push('');
    if (files.length) args.push('files=files');
  } else if (request.body.kind === 'text') {
    lines.push(`data = ${pyStr(request.body.content)}`);
    lines.push('');
    args.push('data=data');
  } else if (request.body.kind === 'binary') {
    args.push(`data=open(${pyStr(request.body.file)}, "rb")`);
  }

  if (!request.followRedirects) args.push('allow_redirects=False');
  if (request.insecure) args.push('verify=False');
  if (request.proxy) {
    args.push(`proxies={"http": ${pyStr(request.proxy)}, "https": ${pyStr(request.proxy)}}`);
  }
  if (request.timeoutMs !== undefined) {
    args.push(`timeout=${secondsText(request.timeoutMs)}`);
  }

  lines.push(`response = requests.request(${args.join(', ')})`);
  lines.push('print(response.text)');
  return lines.join('\n');
}

function genGo(request: Request): string {
  const imports = new Set(['fmt', 'io', 'net/http']);
  const fields = multipartFields(request);

  if (fields.length) {
    imports.add('bytes');
    imports.add('mime/multipart');
    if (fields.some((f) => f.file !== undefined)) imports.add('os');
  } else if (request.body.kind === 'text') {
    imports.add('strings');
  } else if (request.body.kind === 'binary') {
    imports.add('os');
  }
  if (request.insecure) imports.add('crypto/tls');
  if (request.proxy) imports.add('net/url');
  if (request.timeoutMs !== undefined) imports.add('time');

  const lines: string[] = ['package main', '', 'import ('];
  for (const imp of [...imports].sort()) lines.push(`\t"${imp}"`);
  lines.push(')', '');
  lines.push('func main() {');

  if (fields.length) {
    lines.push('\tvar body bytes.Buffer');
    lines.push('\twriter := multipart.NewWriter(&body)');
    for (const field of fields) {
      if (field.file === undefined) {
        lines.push(
          `\tif err := writer.WriteField(${goStr(field.name)}, ${goStr(field.value ?? '')}); err != nil {`,
        );
        lines.push('\t\tpanic(err)');
        lines.push('\t}');
      } else {
        const name = field.filename ?? basename(field.file);
        lines.push(`\tfile, err := os.Open(${goStr(field.file)})`);
        lines.push('\tif err != nil {');
        lines.push('\t\tpanic(err)');
        lines.push('\t}');
        lines.push('\tdefer file.Close()');
        lines.push(`\tpart, err := writer.CreateFormFile(${goStr(field.name)}, ${goStr(name)})`);
        lines.push('\tif err != nil {');
        lines.push('\t\tpanic(err)');
        lines.push('\t}');
        lines.push('\tif _, err := io.Copy(part, file); err != nil {');
        lines.push('\t\tpanic(err)');
        lines.push('\t}');
      }
    }
    lines.push('\tif err := writer.Close(); err != nil {');
    lines.push('\t\tpanic(err)');
    lines.push('\t}');
  }

  const bodyExpr =
    fields.length || request.body.kind === 'none'
      ? 'nil'
      : request.body.kind === 'text'
        ? 'strings.NewReader(body)'
        : 'file';

  if (request.body.kind === 'text' && !fields.length) {
    lines.push(`\tbody := ${goStr(request.body.content)}`);
  }
  if (request.body.kind === 'binary') {
    lines.push(`\tfile, err := os.Open(${goStr(request.body.file)})`);
    lines.push('\tif err != nil {');
    lines.push('\t\tpanic(err)');
    lines.push('\t}');
    lines.push('\tdefer file.Close()');
  }

  const reader = fields.length ? '&body' : bodyExpr;
  lines.push(
    `\treq, err := http.NewRequest(${goStr(request.method)}, ${goStr(request.url)}, ${reader})`,
  );
  lines.push('\tif err != nil {');
  lines.push('\t\tpanic(err)');
  lines.push('\t}');
  for (const header of request.headers) {
    lines.push(`\treq.Header.Set(${goStr(header.name)}, ${goStr(header.value)})`);
  }
  if (fields.length) lines.push('\treq.Header.Set("Content-Type", writer.FormDataContentType())');

  const clientBodies: string[] = [];
  if (request.timeoutMs !== undefined)
    clientBodies.push(`\t\tTimeout: ${secondsText(request.timeoutMs)} * time.Second,`);
  const transport: string[] = [];
  if (request.insecure)
    transport.push('\t\t\tTLSClientConfig: &tls.Config{InsecureSkipVerify: true},');
  if (request.proxy) {
    transport.push('\t\t\tProxy: http.ProxyURL(proxyURL),');
  }
  if (transport.length) {
    clientBodies.push('\t\tTransport: &http.Transport{');
    if (request.proxy) {
      lines.push('');
      lines.push(`\tproxyURL, err := url.Parse(${goStr(request.proxy)})`);
      lines.push('\tif err != nil {');
      lines.push('\t\tpanic(err)');
      lines.push('\t}');
    }
    for (const line of transport) clientBodies.push(line);
    clientBodies.push('\t\t},');
  }

  lines.push('');
  if (clientBodies.length) {
    lines.push('\tclient := &http.Client{');
    for (const line of clientBodies) lines.push(line);
    lines.push('\t}');
  } else {
    lines.push('\tclient := http.DefaultClient');
  }
  lines.push('');
  lines.push('\tresp, err := client.Do(req)');
  lines.push('\tif err != nil {');
  lines.push('\t\tpanic(err)');
  lines.push('\t}');
  lines.push('\tdefer resp.Body.Close()');
  lines.push('');
  lines.push('\trespBody, err := io.ReadAll(resp.Body)');
  lines.push('\tif err != nil {');
  lines.push('\t\tpanic(err)');
  lines.push('\t}');
  lines.push('');
  lines.push('\tfmt.Println(string(respBody))');
  lines.push('}');
  return lines.join('\n');
}

function genPhp(request: Request): string {
  const lines: string[] = ['<?php', '$ch = curl_init();'];
  lines.push(`curl_setopt($ch, CURLOPT_URL, ${phpStr(request.url)});`);
  lines.push('curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);');
  lines.push(`curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${phpStr(request.method)});`);

  const fields = multipartFields(request);
  if (request.headers.length) {
    lines.push('curl_setopt($ch, CURLOPT_HTTPHEADER, [');
    for (const header of request.headers) {
      lines.push(`    ${phpStr(`${header.name}: ${header.value}`)},`);
    }
    lines.push(']);');
  }

  if (fields.length) {
    lines.push('curl_setopt($ch, CURLOPT_POSTFIELDS, [');
    for (const field of fields) {
      if (field.file === undefined) {
        lines.push(`    ${phpStr(field.name)} => ${phpStr(field.value ?? '')},`);
      } else {
        const name = field.filename ?? basename(field.file);
        lines.push(
          `    ${phpStr(field.name)} => new CURLFile(${phpStr(field.file)}, '', ${phpStr(name)}),`,
        );
      }
    }
    lines.push(']);');
  } else if (request.body.kind === 'text') {
    lines.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, ${phpStr(request.body.content)});`);
  } else if (request.body.kind === 'binary') {
    lines.push(
      `curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents(${phpStr(request.body.file)}));`,
    );
  }

  if (request.followRedirects) lines.push('curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);');
  if (request.insecure) {
    lines.push('curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);');
    lines.push('curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);');
  }
  if (request.proxy) lines.push(`curl_setopt($ch, CURLOPT_PROXY, ${phpStr(request.proxy)});`);
  if (request.timeoutMs !== undefined) {
    lines.push(`curl_setopt($ch, CURLOPT_TIMEOUT, ${Math.round(request.timeoutMs / 1000)});`);
  }

  lines.push('$response = curl_exec($ch);');
  lines.push('curl_close($ch);');
  lines.push('echo $response;');
  return lines.join('\n');
}

const RUBY_METHODS: Record<string, string> = {
  GET: 'Get',
  POST: 'Post',
  PUT: 'Put',
  PATCH: 'Patch',
  DELETE: 'Delete',
  HEAD: 'Head',
  OPTIONS: 'Options',
};

function genRuby(request: Request): string {
  const lines: string[] = ['require "net/http"', 'require "uri"'];
  if (request.insecure) lines.push('require "openssl"');
  lines.push('');
  lines.push(`uri = URI.parse(${rubyStr(request.url)})`);

  const proxy = request.proxy
    ? (() => {
        try {
          const parsed = new URL(request.proxy);
          return `, ${rubyStr(parsed.hostname)}, ${parsed.port || (parsed.protocol === 'https:' ? 443 : 80)}`;
        } catch {
          return '';
        }
      })()
    : '';
  lines.push(`http = Net::HTTP.new(uri.host, uri.port${proxy})`);
  lines.push('http.use_ssl = (uri.scheme == "https")');
  if (request.insecure) lines.push('http.verify_mode = OpenSSL::SSL::VERIFY_NONE');
  if (request.timeoutMs !== undefined) {
    lines.push(`http.read_timeout = ${Math.round(request.timeoutMs / 1000)}`);
  }
  lines.push('');

  const methodClass = RUBY_METHODS[request.method];
  if (methodClass) {
    lines.push(`request = Net::HTTP::${methodClass}.new(uri)`);
  } else {
    lines.push(
      `request = Net::HTTPGenericRequest.new(${rubyStr(request.method)}, true, true, uri)`,
    );
  }

  for (const header of request.headers) {
    lines.push(`request[${rubyStr(header.name)}] = ${rubyStr(header.value)}`);
  }

  const fields = multipartFields(request);
  if (fields.length) {
    lines.push('request.set_form([');
    for (const field of fields) {
      if (field.file === undefined) {
        lines.push(`  [${rubyStr(field.name)}, ${rubyStr(field.value ?? '')}],`);
      } else {
        lines.push(`  [${rubyStr(field.name)}, File.open(${rubyStr(field.file)})],`);
      }
    }
    lines.push("], 'multipart/form-data')");
  } else if (request.body.kind === 'text') {
    lines.push(`request.body = ${rubyStr(request.body.content)}`);
  } else if (request.body.kind === 'binary') {
    lines.push(`request.body = File.read(${rubyStr(request.body.file)})`);
  }

  lines.push('');
  lines.push('response = http.request(request)');
  lines.push('puts response.body');
  return lines.join('\n');
}

function genJava(request: Request): string {
  const lines: string[] = [
    'import java.net.URI;',
    'import java.net.http.HttpClient;',
    'import java.net.http.HttpRequest;',
    'import java.net.http.HttpResponse;',
    '',
    'public class Main {',
    '    public static void main(String[] args) throws Exception {',
    '        HttpClient client = HttpClient.newHttpClient();',
  ];

  const fields = multipartFields(request);
  const isText = request.body.kind === 'text';
  const boundary = MULTIPART_BOUNDARY;
  let bodyExpr = 'HttpRequest.BodyPublishers.noBody()';

  if (fields.length) {
    const multipart = buildMultipart(boundary, fields);
    lines.push(`        String multipart = ${cLikeStr(multipart)};`);
    bodyExpr = 'HttpRequest.BodyPublishers.ofString(multipart)';
  } else if (isText) {
    bodyExpr = `HttpRequest.BodyPublishers.ofString(${cLikeStr(textBody(request))})`;
  } else if (request.body.kind === 'binary') {
    lines.push('        // TODO: replace with the real file bytes');
    bodyExpr = `HttpRequest.BodyPublishers.ofByteArray(java.nio.file.Files.readAllBytes(java.nio.file.Path.of(${cLikeStr(request.body.file)})))`;
  }

  lines.push('        HttpRequest request = HttpRequest.newBuilder()');
  lines.push(`            .uri(URI.create(${cLikeStr(request.url)}))`);
  for (const header of request.headers) {
    if (fields.length && header.name.toLowerCase() === 'content-type') continue;
    lines.push(`            .header(${cLikeStr(header.name)}, ${cLikeStr(header.value)})`);
  }
  if (fields.length) {
    lines.push(`            .header("Content-Type", "multipart/form-data; boundary=${boundary}")`);
  }
  lines.push(`            .method(${cLikeStr(request.method)}, ${bodyExpr})`);
  lines.push('            .build();');
  lines.push('');
  lines.push(
    '        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());',
  );
  lines.push('        System.out.println(response.body());');
  lines.push('    }');
  lines.push('}');
  return lines.join('\n');
}

function genCsharp(request: Request): string {
  const lines: string[] = ['using System;', 'using System.Net.Http;'];
  if (request.body.kind === 'text') lines.push('using System.Text;');
  const fields = multipartFields(request);
  if (fields.some((f) => f.file !== undefined) || request.body.kind === 'binary') {
    lines.push('using System.IO;');
  }
  lines.push(
    'using System.Threading.Tasks;',
    '',
    'class Program',
    '{',
    '    static async Task Main()',
    '    {',
  );
  lines.push('        using var client = new HttpClient();');
  lines.push(
    `        var request = new HttpRequestMessage(new HttpMethod(${cLikeStr(request.method)}), ${cLikeStr(request.url)});`,
  );

  const contentType = getHeader(request, 'content-type');
  const otherHeaders = request.headers.filter((h) => h.name.toLowerCase() !== 'content-type');
  for (const header of otherHeaders) {
    lines.push(
      `        request.Headers.TryAddWithoutValidation(${cLikeStr(header.name)}, ${cLikeStr(header.value)});`,
    );
  }

  if (fields.length) {
    lines.push('        var content = new MultipartFormDataContent();');
    for (const field of fields) {
      if (field.file === undefined) {
        lines.push(
          `        content.Add(new StringContent(${cLikeStr(field.value ?? '')}), ${cLikeStr(field.name)});`,
        );
      } else {
        const name = field.filename ?? basename(field.file);
        lines.push(
          `        content.Add(new ByteArrayContent(File.ReadAllBytes(${cLikeStr(field.file)})), ${cLikeStr(field.name)}, ${cLikeStr(name)});`,
        );
      }
    }
    lines.push('        request.Content = content;');
  } else if (request.body.kind === 'text') {
    const mediaType = contentType ?? 'text/plain';
    lines.push(
      `        request.Content = new StringContent(${cLikeStr(request.body.content)}, Encoding.UTF8, ${cLikeStr(mediaType)});`,
    );
  } else if (request.body.kind === 'binary') {
    lines.push(
      `        request.Content = new ByteArrayContent(File.ReadAllBytes(${cLikeStr(request.body.file)}));`,
    );
  }

  lines.push('');
  lines.push('        var response = await client.SendAsync(request);');
  lines.push('        Console.WriteLine(await response.Content.ReadAsStringAsync());');
  lines.push('    }');
  lines.push('}');
  return lines.join('\n');
}

function genRust(request: Request): string {
  const lines: string[] = [
    '#[tokio::main]',
    'async fn main() -> Result<(), Box<dyn std::error::Error>> {',
  ];
  const clientBodies: string[] = [];
  if (request.insecure) clientBodies.push('        .danger_accept_invalid_certs(true)');
  if (request.proxy) {
    lines.push(`    let proxy = reqwest::Proxy::all(${cLikeStr(request.proxy)})?;`);
    clientBodies.push('        .proxy(proxy)');
  }
  if (request.timeoutMs !== undefined) {
    lines.push('    use std::time::Duration;');
    clientBodies.push(`        .timeout(Duration::from_millis(${request.timeoutMs}))`);
  }

  if (clientBodies.length) {
    lines.push('    let client = reqwest::Client::builder()');
    for (const body of clientBodies) lines.push(body);
    lines.push('        .build()?;');
  } else {
    lines.push('    let client = reqwest::Client::new();');
  }

  lines.push('    let res = client');
  lines.push(`        .request(${rustMethod(request.method)}, ${cLikeStr(request.url)})`);
  for (const header of request.headers) {
    lines.push(`        .header(${cLikeStr(header.name)}, ${cLikeStr(header.value)})`);
  }

  const fields = multipartFields(request);
  if (fields.length) {
    lines.push('        .multipart(');
    lines.push('            reqwest::multipart::Form::new()');
    for (const field of fields) {
      if (field.file === undefined) {
        lines.push(
          `                .text(${cLikeStr(field.name)}, ${cLikeStr(field.value ?? '')})`,
        );
      } else {
        lines.push(`                .file(${cLikeStr(field.name)}, ${cLikeStr(field.file)})`);
      }
    }
    lines.push('        )');
  } else if (request.body.kind === 'text') {
    lines.push(`        .body(${cLikeStr(request.body.content)})`);
  } else if (request.body.kind === 'binary') {
    lines.push('        // TODO: stream the file body, e.g. tokio::fs::read');
  }

  lines.push('        .send()');
  lines.push('        .await?;');
  lines.push('    println!("{}", res.text().await?);');
  lines.push('    Ok(())');
  lines.push('}');
  return lines.join('\n');
}

function genPowerShell(request: Request): string {
  const lines: string[] = [];
  if (request.headers.length) {
    lines.push('$headers = @{');
    for (const header of request.headers) {
      lines.push(`    ${psStr(header.name)} = ${psStr(header.value)}`);
    }
    lines.push('}');
    lines.push('');
  }

  const fields = multipartFields(request);
  const args: string[] = [`-Uri ${psStr(request.url)}`, `-Method ${psStr(request.method)}`];
  if (request.headers.length) args.push('-Headers $headers');

  if (fields.length) {
    lines.push('$form = @{');
    for (const field of fields) {
      if (field.file === undefined)
        lines.push(`    ${psStr(field.name)} = ${psStr(field.value ?? '')}`);
      else lines.push(`    ${psStr(field.name)} = Get-Item ${psStr(field.file)} -ErrorAction Stop`);
    }
    lines.push('}');
    lines.push('');
    args.push('-Form $form');
  } else if (request.body.kind === 'text') {
    args.push(`-Body ${psStr(request.body.content)}`);
  } else if (request.body.kind === 'binary') {
    args.push(`-InFile ${psStr(request.body.file)}`);
  }

  if (!request.followRedirects) args.push('-MaximumRedirection 0');
  if (request.insecure) args.push('-SkipCertificateCheck');
  if (request.proxy) args.push(`-Proxy ${psStr(request.proxy)}`);
  if (request.timeoutMs !== undefined)
    args.push(`-TimeoutSec ${Math.round(request.timeoutMs / 1000)}`);

  lines.push(`$response = Invoke-RestMethod ${args.join(' `\n    ')}`);
  lines.push('$response');
  return lines.join('\n');
}

function genHttp(request: Request): string {
  let host = '';
  let path = '/';
  try {
    const parsed = new URL(request.url);
    host = parsed.host;
    path = `${parsed.pathname || '/'}${parsed.search}`;
  } catch {
    host = '';
  }

  const fields = multipartFields(request);
  const lines: string[] = [`${request.method} ${path} HTTP/1.1`];
  if (host && !getHeader(request, 'host')) lines.push(`Host: ${host}`);
  for (const header of request.headers) {
    if (header.name.toLowerCase() === 'host') continue;
    lines.push(`${header.name}: ${header.value}`);
  }
  if (fields.length && !getHeader(request, 'content-type')) {
    lines.push(`Content-Type: multipart/form-data; boundary=${MULTIPART_BOUNDARY}`);
  }

  let body = '';
  if (fields.length) body = buildMultipart(MULTIPART_BOUNDARY, fields);
  else if (request.body.kind === 'text') body = textBody(request);
  else if (request.body.kind === 'binary') body = `<contents of ${request.body.file}>`;

  lines.push('');
  lines.push(body);
  return lines.join('\n');
}

const GENERATORS: Record<string, (request: Request) => string> = {
  fetch: genFetch,
  axios: genAxios,
  node: genNode,
  python: genPython,
  go: genGo,
  php: genPhp,
  ruby: genRuby,
  java: genJava,
  csharp: genCsharp,
  rust: genRust,
  powershell: genPowerShell,
  http: genHttp,
};

const LANGUAGES: Record<string, string> = {
  fetch: 'javascript',
  axios: 'javascript',
  node: 'javascript',
  python: 'python',
  go: 'go',
  php: 'php',
  ruby: 'ruby',
  java: 'java',
  csharp: 'csharp',
  rust: 'rust',
  powershell: 'powershell',
  http: 'http',
};

/* --------------------------------- run ----------------------------------- */

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const target = String(options.target);

  if (!input.text.trim()) return { output: '' };
  if (input.text.length > 200_000) {
    throw new ToolError(
      'That command is too long to convert.',
      'Paste a single curl command under 200,000 characters.',
    );
  }

  const generator = GENERATORS[target];
  if (!generator) {
    throw new ToolError('Unknown output format.', 'Pick one of the listed formats.');
  }

  const { request, warnings } = parseCommand(input.text);
  const output = generator(request);

  const stats: Record<string, string | number> = {
    method: request.method,
    format: target,
    headers: request.headers.length,
    body: request.body.kind,
  };
  if (request.body.kind === 'multipart') {
    stats.fields = request.body.fields.length;
  }
  if (request.body.kind === 'text') {
    stats['body size'] = `${request.body.content.length} B`;
  }
  if (!request.followRedirects) stats.redirects = 'manual';

  return {
    output,
    render: 'code',
    language: LANGUAGES[target] ?? 'text',
    filename: `request.${target === 'http' ? 'http' : 'txt'}`,
    warnings: warnings.length ? warnings : undefined,
    stats,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
