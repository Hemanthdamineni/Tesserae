import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './iptables-ruleset-auditor.meta';
import {
  analyze,
  BUILT_IN,
  clip,
  DEFAULT_SENSITIVE,
  isEstablishedAccept,
  isNumber,
  looksLikeNft,
  MAX_BYTES,
  MAX_FINDINGS,
  MAX_LINE,
  MAX_ROWS,
  MAX_RULES,
  parseRule,
  SERVICE_PORTS,
  TARGETS,
  tokenize,
  type ChainInfo,
  type ParseState,
} from './iptables-ruleset-auditor.core';

/* ==========================================================================
 * iptables ruleset auditor. The parsing model and the rule-evaluation pass
 * (tokenize, parseRule, analyze) live in iptables-ruleset-auditor.core; this
 * file reads input, walks lines into the parse state, then renders the
 * requested table (summary / chains / rules / ports / findings).
 * ========================================================================== */

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const top = Math.max(3, Math.min(50, Number(options.top ?? 15) || 15));
  const sensitiveRaw = String(options.sensitive ?? '');
  const sensitive = new Set(
    (sensitiveRaw.trim() === '' ? DEFAULT_SENSITIVE.map(String) : sensitiveRaw.split(/[,\s]+/u))
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value) && value > 0 && value < 65536),
  );

  const source = (input.files ?? [])[0];
  let text: string;
  let sourceLabel: string;
  if (source !== undefined) {
    if (source.size === 0) throw new ToolError('That file is empty.');
    if (source.size > MAX_BYTES)
      throw new ToolError(
        'That file is larger than 8 MB.',
        'A ruleset is normally a few kilobytes.',
      );
    text = new TextDecoder('utf-8', { fatal: false }).decode(
      new Uint8Array(await source.arrayBuffer()),
    );
    sourceLabel = source.name === '' ? 'uploaded file' : source.name;
  } else {
    text = String(input.text ?? '');
    if (text.trim() === '')
      throw new ToolError(
        'No ruleset was provided.',
        'Paste the output of iptables-save or a list of iptables -A commands.',
      );
    sourceLabel = 'pasted text';
  }
  if (text.length > MAX_BYTES) throw new ToolError('That is more than 8 MB of input.');
  if (looksLikeNft(text)) {
    throw new ToolError(
      'This looks like an nftables ruleset, not iptables.',
      'nft syntax (table ip filter, chain input { ... }) is a different grammar; paste the output of iptables-save instead.',
    );
  }

  const lines = text.split('\n');
  const saveMode = lines.some((line) => line.trim().startsWith('*'));
  const state: ParseState = {
    saveMode,
    currentTable: saveMode ? '' : 'filter',
    tables: new Map(),
    rules: [],
    findings: [],
    deletions: 0,
  };
  if (!saveMode) {
    const chains = new Map<string, ChainInfo>();
    for (const name of BUILT_IN['filter'] ?? []) {
      chains.set(name, { name, table: 'filter', policy: 'ACCEPT', user: false, rules: [] });
    }
    state.tables.set('filter', chains);
  }

  let comments = 0;
  let truncated = 0;
  let ruleCapHit = false;

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const rawLine = lines[index] ?? '';
    if (rawLine.length > MAX_LINE) truncated += 1;
    const trimmed = rawLine.slice(0, MAX_LINE).replace(/\r$/u, '').trim();
    if (trimmed === '') continue;
    if (trimmed.startsWith('#')) {
      comments += 1;
      continue;
    }
    if (trimmed.startsWith('*')) {
      if (!saveMode) continue;
      if (state.currentTable !== '') {
        state.findings.push({
          level: 'error',
          problem: 'A table starts before the previous one is closed',
          detail:
            'Line ' +
            lineNumber +
            ' opens table ' +
            trimmed.slice(1) +
            ' while table ' +
            state.currentTable +
            ' is still open without COMMIT.',
        });
      }
      state.currentTable = trimmed.slice(1).trim();
      if (!state.tables.has(state.currentTable)) state.tables.set(state.currentTable, new Map());
      continue;
    }
    if (trimmed === 'COMMIT') {
      if (!saveMode) continue;
      if (state.currentTable === '') {
        state.findings.push({
          level: 'error',
          problem: 'COMMIT outside a table',
          detail: 'Line ' + lineNumber + ' commits nothing because no table is open.',
        });
      } else {
        state.currentTable = '';
      }
      continue;
    }
    if (trimmed.startsWith(':')) {
      if (!saveMode) {
        state.findings.push({
          level: 'error',
          problem: 'A line is neither a rule nor a table directive',
          detail:
            'Line ' +
            lineNumber +
            ' looks like an iptables-save chain declaration ("' +
            clip(trimmed, 40) +
            '") but the file has no *table header, so it cannot be applied.',
        });
        continue;
      }
      const parts = trimmed.slice(1).split(/\s+/u);
      const name = parts[0] ?? '';
      const policy = (parts[1] ?? '').toUpperCase();
      if (state.currentTable === '') {
        state.findings.push({
          level: 'error',
          problem: 'A chain is declared before the first table',
          detail:
            'Line ' +
            lineNumber +
            ' declares ' +
            name +
            ' with no table open. iptables-restore fails here.',
        });
        continue;
      }
      const tableChains = state.tables.get(state.currentTable);
      if (tableChains === undefined) continue;
      const user = policy === '-' || policy === '';
      const builtin = (BUILT_IN[state.currentTable] ?? []).includes(name);
      const existing = tableChains.get(name);
      if (existing !== undefined) {
        existing.policy = user ? '' : policy;
        continue;
      }
      tableChains.set(name, {
        name,
        table: state.currentTable,
        policy: user ? '' : policy,
        user: user || !builtin,
        rules: [],
      });
      continue;
    }

    const tokens = tokenize(trimmed);
    if (tokens.length === 0) continue;
    const operation = tokens[0] ?? '';
    const table = state.currentTable;
    const tableChains = state.tables.get(table);

    if (
      operation === '-A' ||
      operation === '--append' ||
      operation === '-I' ||
      operation === '--insert'
    ) {
      if (table === '' || tableChains === undefined) {
        state.findings.push({
          level: 'error',
          problem: 'A rule appears before the first table',
          detail:
            'Line ' +
            lineNumber +
            ' is a rule with no table open. iptables-restore reports "line ' +
            lineNumber +
            ' failed".',
        });
        continue;
      }
      const chainName = tokens[1] ?? '';
      let chain = tableChains.get(chainName);
      if (chain === undefined) {
        const builtin = (BUILT_IN[table] ?? []).includes(chainName);
        const builtinAnywhere = Object.values(BUILT_IN).some((names) => names.includes(chainName));
        if (!builtin && !builtinAnywhere) {
          state.findings.push({
            level: 'error',
            problem: 'A rule is added to a chain that no table declares',
            detail:
              'Line ' +
              lineNumber +
              ' adds to ' +
              chainName +
              ' in table ' +
              table +
              ', but nothing creates that chain (iptables: No chain/target/match by that name).',
          });
        }
        chain = {
          name: chainName,
          table,
          policy: builtin ? 'ACCEPT' : '',
          user: !builtin,
          rules: [],
        };
        tableChains.set(chainName, chain);
      }
      if (state.rules.length >= MAX_RULES) {
        ruleCapHit = true;
        continue;
      }
      const rule = parseRule(tokens, chain, lineNumber, operation);
      rule.number = state.rules.length + 1;
      state.rules.push(rule);
      if (rule.inserted) {
        const candidate = tokens[2] ?? '';
        const position = isNumber(candidate) ? Number.parseInt(candidate, 10) : 1;
        chain.rules.splice(Math.max(0, position - 1), 0, rule);
        rule.notes.push('inserted at position ' + position);
      } else {
        chain.rules.push(rule);
      }
      continue;
    }

    if (!saveMode) {
      if (operation === '-P' || operation === '--policy') {
        const name = tokens[1] ?? '';
        const policy = (tokens[2] ?? '').toUpperCase();
        const chains = state.tables.get('filter');
        const chain = chains?.get(name) ?? {
          name,
          table: 'filter',
          policy,
          user: false,
          rules: [],
        };
        chain.policy = policy;
        chains?.set(name, chain);
        continue;
      }
      if (operation === '-N' || operation === '--new-chain') {
        const name = tokens[1] ?? '';
        const chains = state.tables.get('filter');
        if (name !== '' && chains !== undefined && !chains.has(name)) {
          chains.set(name, { name, table: 'filter', policy: '', user: true, rules: [] });
        }
        continue;
      }
      if (operation === '-F' || operation === '--flush') {
        const name = tokens[1];
        const chain = name === undefined ? undefined : state.tables.get('filter')?.get(name);
        if (chain !== undefined) chain.rules = [];
        continue;
      }
      if (
        operation === '-X' ||
        operation === '--delete-chain' ||
        operation === '-Z' ||
        operation === '--zero' ||
        operation === '-E' ||
        operation === '--rename-chain'
      ) {
        continue;
      }
    }

    if (
      operation === '-D' ||
      operation === '--delete' ||
      operation === '-C' ||
      operation === '--check' ||
      operation === '-R' ||
      operation === '--replace'
    ) {
      state.deletions += 1;
      state.findings.push({
        level: 'note',
        problem: 'The file changes rules it does not show',
        detail:
          'Line ' +
          lineNumber +
          ' uses ' +
          operation +
          '. A static reading cannot follow it, so the effective ruleset may differ from what is listed.',
      });
      continue;
    }

    state.findings.push({
      level: 'error',
      problem: 'A line is neither a rule nor a table directive',
      detail:
        'Line ' +
        lineNumber +
        ' starts with "' +
        clip(operation, 30) +
        '", which iptables-save never writes and iptables-restore rejects.',
    });
  }

  if (state.rules.length === 0 && state.tables.size === (saveMode ? 0 : 1)) {
    throw new ToolError(
      'No iptables rules were found.',
      'Paste the output of iptables-save (starting with *filter) or a list of iptables -A commands.',
    );
  }

  const findings = analyze(state);
  const chains: ChainInfo[] = [];
  for (const tableChains of state.tables.values())
    for (const chain of tableChains.values()) chains.push(chain);
  chains.sort((a, b) =>
    a.table === b.table ? a.name.localeCompare(b.name) : a.table.localeCompare(b.table),
  );

  const acceptRules = state.rules.filter((rule) => rule.target === 'ACCEPT');
  const dropRules = state.rules.filter(
    (rule) => rule.target === 'DROP' || rule.target === 'REJECT',
  );
  const jumpRules = state.rules.filter((rule) => rule.target !== '' && !TARGETS.has(rule.target));

  /** Earliest unconditional DROP or REJECT per chain, so shadow checks stay linear. */
  const shadow: Record<string, number> = {};
  for (const rule of state.rules) {
    if (
      rule.unconditional &&
      (rule.target === 'DROP' || rule.target === 'REJECT') &&
      shadow[rule.chain] === undefined
    ) {
      shadow[rule.chain] = rule.number;
    }
  }

  interface Exposure {
    port: string;
    first: number;
    proto: string;
    source: string;
    chain: string;
    rule: number;
    dead: number;
    sensitive: boolean;
    unrestricted: boolean;
  }
  const list: Exposure[] = [];
  const exposed = new Set<string>();
  const sensitiveOpen = new Set<string>();
  for (const rule of acceptRules) {
    const unrestricted = rule.source === '' && rule.inInterface === '';
    for (const port of rule.ports) {
      if (port.kind !== 'dport') continue;
      exposed.add(rule.proto + '/' + port.text);
      const resolved = port.service === '' ? undefined : SERVICE_PORTS[port.service];
      let isSensitive = false;
      if (port.service === '') {
        for (let value = port.first; value <= port.last && value - port.first < 4096; value += 1) {
          if (sensitive.has(value)) isSensitive = true;
        }
      } else if (resolved !== undefined) {
        isSensitive = sensitive.has(resolved);
      }
      const dead =
        shadow[rule.chain] !== undefined && (shadow[rule.chain] ?? 0) < rule.number
          ? (shadow[rule.chain] ?? 0)
          : 0;
      if (isSensitive && unrestricted && dead === 0)
        sensitiveOpen.add(port.service !== '' ? port.service : port.text);
      list.push({
        port: port.text,
        first: port.first,
        proto: rule.proto,
        source:
          rule.source === ''
            ? rule.inInterface === ''
              ? 'any'
              : 'if ' + rule.inInterface
            : rule.source + (rule.sourceNegated ? ' (not)' : ''),
        chain: rule.chain,
        rule: rule.number,
        dead,
        sensitive: isSensitive,
        unrestricted,
      });
    }
  }
  list.sort(
    (a, b) =>
      (a.sensitive === b.sensitive ? 0 : a.sensitive ? -1 : 1) ||
      a.first - b.first ||
      a.proto.localeCompare(b.proto),
  );

  const errors = findings.filter((finding) => finding.level === 'error').length;
  const warnings = findings.filter((finding) => finding.level === 'warning').length;
  const notes = findings.filter((finding) => finding.level === 'note').length;
  const resultNotes: string[] = [];
  const resultWarnings: string[] = [];
  if (ruleCapHit) resultNotes.push('Only the first ' + MAX_RULES + ' rules were analyzed.');
  if (findings.length >= MAX_FINDINGS)
    resultNotes.push('Only the first ' + MAX_FINDINGS + ' findings are shown.');
  if (comments > 0) resultNotes.push(comments + ' comment line(s) were skipped.');
  if (truncated > 0)
    resultNotes.push(
      truncated + ' line(s) were longer than ' + MAX_LINE + ' characters and were cut.',
    );
  if (errors > 0)
    resultWarnings.push(errors + ' problem(s) would make iptables refuse this ruleset.');
  if (sensitiveOpen.size > 0)
    resultWarnings.push(sensitiveOpen.size + ' sensitive port(s) are accepted from anywhere.');

  const stats: Record<string, string | number> = {
    bytes: text.length,
    lines: lines.length,
    tables: state.tables.size,
    chains: chains.length,
    rules: state.rules.length,
    exposedPorts: exposed.size,
    sensitiveOpen: sensitiveOpen.size,
    findings: findings.length,
    errors,
    warnings,
    notes,
  };

  if (format === 'chains') {
    const rows = chains.slice(0, MAX_ROWS).map((chain) => {
      const accepts = chain.rules.filter((rule) => rule.target === 'ACCEPT').length;
      const drops = chain.rules.filter(
        (rule) => rule.target === 'DROP' || rule.target === 'REJECT',
      ).length;
      const jumps = chain.rules.filter(
        (rule) => rule.target !== '' && !TARGETS.has(rule.target),
      ).length;
      const marks: string[] = [];
      if (chain.user) marks.push('user chain');
      if (chain.rules.length === 0) marks.push('no rules');
      if (chain.policy === 'ACCEPT' && drops > 0) marks.push('fail-open policy');
      const effectiveDrop =
        chain.policy === 'DROP' ||
        chain.rules.some(
          (rule) => rule.unconditional && (rule.target === 'DROP' || rule.target === 'REJECT'),
        );
      if (
        effectiveDrop &&
        chain.rules.length > 0 &&
        (chain.name === 'INPUT' || chain.name === 'FORWARD') &&
        !chain.rules.some(isEstablishedAccept)
      )
        marks.push('drops replies');
      if (chain.rules.some((rule) => rule.notes.some((note) => note.startsWith('unreachable'))))
        marks.push('has dead rules');
      return [
        chain.name,
        chain.table,
        chain.policy === '' ? 'return' : chain.policy,
        String(chain.rules.length),
        'A:' + accepts + ' D:' + drops + ' J:' + jumps,
        marks.length === 0 ? '-' : marks.join(', '),
      ];
    });
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['Chain', 'Table', 'Policy', 'Rules', 'Verdicts', 'Notes'],
          rows: rows.length === 0 ? [['-', '-', '-', '0', '-', '(no chains)']] : rows,
        }),
        render: 'table',
      },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  if (format === 'rules') {
    const rows = state.rules
      .slice(0, MAX_ROWS)
      .map((rule) => [
        String(rule.number),
        String(rule.line),
        rule.chain,
        clip(rule.matchText === '' ? '(no match conditions)' : rule.matchText, 44),
        clip(rule.targetText === '' ? '(counts only)' : rule.targetText, 24),
        rule.errors.length > 0
          ? 'invalid'
          : rule.notes.length === 0
            ? '-'
            : clip(rule.notes.join(', '), 40),
      ]);
    if (state.rules.length > rows.length)
      resultNotes.push('Only the first ' + MAX_ROWS + ' rules are listed.');
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['#', 'Line', 'Chain', 'Match', 'Target', 'Notes'],
          rows: rows.length === 0 ? [['-', '-', '-', '(no rules)', '-', '-']] : rows,
        }),
        render: 'table',
      },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  if (format === 'ports') {
    const rows = list
      .slice(0, top)
      .map((entry, index) => [
        String(index + 1),
        entry.port,
        entry.proto,
        clip(entry.source, 22),
        entry.chain,
        '#' + entry.rule,
        entry.dead !== 0
          ? 'shadowed by #' + entry.dead
          : entry.sensitive
            ? entry.unrestricted
              ? 'sensitive, open to the world'
              : 'sensitive, but restricted'
            : '-',
      ]);
    if (list.length > rows.length)
      resultNotes.push(
        'Showing ' +
          rows.length +
          ' of ' +
          list.length +
          ' accepted ports; raise the Ports listed option to see more.',
      );
    if (list.length === 0)
      resultNotes.push(
        'No ACCEPT rule matches a destination port, so nothing is opened by this ruleset.',
      );
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['#', 'Port', 'Proto', 'Source', 'Chain', 'Rule', 'Note'],
          rows: rows.length === 0 ? [['-', '-', '-', '-', '-', '-', '(no ports accepted)']] : rows,
        }),
        render: 'table',
      },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  if (format === 'findings') {
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['Level', 'Problem', 'Detail'],
          rows:
            findings.length === 0
              ? [
                  [
                    'ok',
                    'Nothing to flag',
                    'Every rule parses, every jump resolves, and no chain drops traffic it cannot return.',
                  ],
                ]
              : findings.map((finding) => [finding.level, finding.problem, finding.detail]),
        }),
        render: 'table',
      },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  const closed = chains.filter(
    (chain) => !chain.user && chain.policy !== '' && chain.policy !== 'ACCEPT',
  );
  const openPolicies = chains.filter((chain) => !chain.user && chain.policy === 'ACCEPT').length;
  const summaryRows: string[][] = [
    ['Source', sourceLabel],
    ['Size', text.length + ' bytes in ' + lines.length + ' lines'],
    ['Format', saveMode ? 'iptables-save' : 'iptables command list (table filter assumed)'],
    ['Tables', state.tables.size === 0 ? 'none' : [...state.tables.keys()].join(', ')],
    [
      'Chains',
      String(chains.length) + ' (' + chains.filter((chain) => chain.user).length + ' user)',
    ],
    [
      'Rules',
      String(state.rules.length) +
        (state.deletions > 0 ? ' (' + state.deletions + ' delete/check line(s) not replayed)' : ''),
    ],
    [
      'Policies',
      (closed.length === 0
        ? 'no chain is fail-closed'
        : closed.map((chain) => chain.name + '=' + chain.policy).join(', ')) +
        (openPolicies === 0 ? '' : ' (' + openPolicies + ' chain(s) accept by default)'),
    ],
    [
      'Verdicts',
      acceptRules.length +
        ' accept, ' +
        dropRules.length +
        ' drop/reject, ' +
        jumpRules.length +
        ' jump',
    ],
    [
      'Exposed ports',
      exposed.size === 0
        ? 'none accepted'
        : String(exposed.size) +
          ': ' +
          clip(
            [...exposed]
              .sort((a, b) => {
                const [protoA = '', portA = ''] = a.split('/');
                const [protoB = '', portB = ''] = b.split('/');
                return protoA === protoB
                  ? (Number.parseInt(portA, 10) || 0) - (Number.parseInt(portB, 10) || 0)
                  : protoA.localeCompare(protoB);
              })
              .join(', '),
            70,
          ),
    ],
    [
      'Sensitive ports open',
      sensitiveOpen.size === 0
        ? 'none from any source'
        : [...sensitiveOpen].sort((a, b) => Number(a) - Number(b)).join(', '),
    ],
    ['Established-connection rule', state.rules.some(isEstablishedAccept) ? 'present' : 'missing'],
    [
      'Interface-limited rules',
      String(
        state.rules.filter((rule) => rule.inInterface !== '' || rule.outInterface !== '').length,
      ),
    ],
    ['Source-limited rules', String(state.rules.filter((rule) => rule.source !== '').length)],
    ['Inserted rules', String(state.rules.filter((rule) => rule.inserted).length)],
    ['Findings', errors + ' error, ' + warnings + ' warning, ' + notes + ' note'],
  ];
  return {
    outputs: [],
    report: {
      output: JSON.stringify({ headers: ['Item', 'Value'], rows: summaryRows }),
      render: 'table',
    },
    notes: resultNotes,
    warnings: resultWarnings,
    stats,
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
