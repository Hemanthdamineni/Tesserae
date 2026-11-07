import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './nginx-config-auditor.meta';

/**
 * hệ thống config auditor.
 *
 * Counts server blocks and listens, then flags common hardening and correctness
 * problems in an nginx configuration: version disclosure, TLS without
 * protocols or ciphers, missing HTTPS redirect, server blocks without a
 * server_name, the deprecated ssl directive, and unbalanced braces. Expected
 * values come from the byte-exact fixture, never from this parser.
 */

const MAX_CHARS = 2 * 1024 * 1024;

interface Issue {
  severity: string;
  line: number;
  message: string;
}

interface Model {
  serverBlocks: number;
  listens: string[];
  sslServers: number;
  plainServers: number;
  serverTokensOff: boolean;
  issues: Issue[];
  directives: string[];
  bracesBalanced: boolean;
}

function stripComments(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const clean = line.replace(/#.*$/, '');
      return clean;
    })
    .join('\n');
}

function parseConfig(text: string): Model {
  const clean = stripComments(text);
  if (!/[{};]/.test(clean) || !/[a-z_]\s/m.test(clean)) {
    throw new ToolError(
      'That does not look like an hệ thống configuration.',
      'Paste an nginx config.',
    );
  }

  const bracesBalanced = (clean.match(/\{/g) ?? []).length === (clean.match(/\}/g) ?? []).length;
  const serverBlocks = (clean.match(/\bserver\s*\{/g) ?? []).length;
  const listens: string[] = [];
  const listenRe = /\blisten\s+([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = listenRe.exec(clean)) !== null) listens.push((m[1] ?? '').trim());

  const serverTokensOff = /\bserver_tokens\s+off\s*;/.test(clean);
  const hasSslProtocols = /\bssl_protocols\b/.test(clean);
  const hasSslCiphers = /\bssl_ciphers\s+[^;]+;/.test(clean);
  const deprecatedSslOn = /\bssl\s+on\s*;/.test(clean);
  const hasHttpsRedirect =
    /\breturn\s+30[178]\s+https:\/\//.test(clean) || /\brewrite\s+[^;]*https:\/\//.test(clean);
  const serverNames = (clean.match(/\bserver_name\s+[^;]+;/g) ?? []).length;

  let lineOf = 1;
  const lines = clean.split('\n');
  const issues: Issue[] = [];

  if (!bracesBalanced) {
    issues.push({
      severity: 'high',
      line: 0,
      message: 'Braces are unbalanced; the config will not parse.',
    });
  }
  if (serverBlocks === 0) {
    issues.push({ severity: 'info', line: 0, message: 'No server blocks found in this file.' });
  }
  if (!serverTokensOff) {
    issues.push({
      severity: 'medium',
      line: 0,
      message: 'server_tokens is not off; the nginx version is disclosed.',
    });
  }
  for (let i = 0; i < lines.length; i += 1) {
    lineOf = i + 1;
    const line = lines[i] ?? '';
    if (/\blisten\s+\S*ssl\b/.test(line) && !hasSslProtocols) {
      issues.push({ severity: 'high', line: lineOf, message: 'TLS server without ssl_protocols.' });
    }
    if (/\blisten\s+\S*ssl\b/.test(line) && !hasSslCiphers) {
      issues.push({
        severity: 'medium',
        line: lineOf,
        message: 'TLS server without an explicit ssl_ciphers list.',
      });
    }
    if (/\bssl\s+on\s*;/.test(line)) {
      issues.push({ severity: 'medium', line: lineOf, message: 'Deprecated "ssl on;" directive.' });
    }
  }
  if (deprecatedSslOn && !hasSslProtocols) {
    issues.push({
      severity: 'high',
      line: 0,
      message: 'TLS enabled but ssl_protocols is not set.',
    });
  }
  const sslServers = listens.filter((l) => /ssl/.test(l)).length;
  const plainServers = listens.length - sslServers;
  if (sslServers > 0 && plainServers > 0 && !hasHttpsRedirect) {
    issues.push({
      severity: 'medium',
      line: 0,
      message: 'HTTP and HTTPS servers both present but no HTTP to HTTPS redirect was found.',
    });
  }
  if (serverBlocks > 0 && serverNames < serverBlocks) {
    issues.push({
      severity: 'low',
      line: 0,
      message: serverBlocks - serverNames + ' server block(s) have no server_name.',
    });
  }

  const directives: string[] = [];
  const directiveRe = /^\s*([a-z_][a-z0-9_]*)\b/gm;
  while ((m = directiveRe.exec(clean)) !== null) {
    const name = m[1] ?? '';
    if (name !== '' && !directives.includes(name)) directives.push(name);
  }

  return {
    serverBlocks,
    listens,
    sslServers,
    plainServers,
    serverTokensOff,
    issues,
    directives,
    bracesBalanced,
  };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const high = m.issues.filter((i) => i.severity === 'high').length;
  const medium = m.issues.filter((i) => i.severity === 'medium').length;
  const low = m.issues.filter((i) => i.severity === 'low').length;
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Server blocks', String(m.serverBlocks)],
      ['Listen directives', String(m.listens.length)],
      ['TLS servers', String(m.sslServers)],
      ['Plain HTTP servers', String(m.plainServers)],
      ['server_tokens off', m.serverTokensOff ? 'yes' : 'no'],
      ['Braces balanced', m.bracesBalanced ? 'yes' : 'no'],
      ['High issues', String(high)],
      ['Medium issues', String(medium)],
      ['Low issues', String(low)],
    ],
  };
}

function tableIssues(m: Model): { headers: string[]; rows: string[][] } {
  if (m.issues.length === 0) return { headers: ['Result'], rows: [['No issues found']] };
  return {
    headers: ['Severity', 'Line', 'Problem'],
    rows: m.issues.map((i) => [i.severity, i.line === 0 ? '-' : String(i.line), i.message]),
  };
}

function tableDirectives(m: Model): { headers: string[]; rows: string[][] } {
  return { headers: ['Directive'], rows: m.directives.map((d) => [d]) };
}

function asTable(table: { headers: string[]; rows: string[][] }): TextRunResult {
  return { output: JSON.stringify(table), render: 'table' };
}

function run(input: TextRunInput): TextRunResult {
  const options = input.options;
  const format = String(options.format ?? 'summary');

  const text = input.text ?? '';
  if (text.trim().length === 0)
    throw new ToolError('No nginx configuration was provided.', 'Paste a config file.');
  if (text.length > MAX_CHARS) throw new ToolError('That configuration is larger than 2 MB.');

  const m = parseConfig(text);

  let table: { headers: string[]; rows: string[][] };
  if (format === 'issues') table = tableIssues(m);
  else if (format === 'directives') table = tableDirectives(m);
  else table = tableSummary(m);
  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
