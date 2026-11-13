/**
 * Pure rule-evaluation model for the iptables ruleset auditor. Tokenizing a
 * ruleset line, parsing a rule into the `Rule` model, and producing the list of
 * `Finding`s live here, kept separate from the tool's file/option/table wiring.
 */

export const MAX_BYTES = 8 * 1024 * 1024;
export const MAX_RULES = 20000;
export const MAX_ROWS = 2000;
export const MAX_FINDINGS = 300;
export const MAX_LINE = 8192;
const CLIP = 100;

export const DEFAULT_SENSITIVE = [
  22, 23, 21, 25, 135, 139, 445, 1433, 1521, 2049, 2375, 3306, 3389, 5432, 5601, 5900, 6379, 9200,
  11211, 27017,
];

/** Well-known /etc/services names, so a service name can still be checked against the sensitive list. */
export const SERVICE_PORTS: Record<string, number> = {
  ftp: 21,
  ssh: 22,
  telnet: 23,
  smtp: 25,
  domain: 53,
  dns: 53,
  http: 80,
  pop3: 110,
  sunrpc: 111,
  ntp: 123,
  imap: 143,
  snmp: 161,
  ldap: 389,
  https: 443,
  smb: 445,
  ldaps: 636,
  imaps: 993,
  pop3s: 995,
  'ms-sql-s': 1433,
  nfs: 2049,
  mysql: 3306,
  'ms-wbt-server': 3389,
  postgresql: 5432,
  redis: 6379,
  elasticsearch: 9200,
  memcache: 11211,
  mongodb: 27017,
  docker: 2375,
};

/** Targets that end chain evaluation when they match unconditionally. */
export const TERMINAL_NAMES = new Set(['ACCEPT', 'DROP', 'REJECT', 'RETURN']);
/** Extension targets, which are not chain references. */
export const TARGETS = new Set([
  'ACCEPT',
  'DROP',
  'REJECT',
  'RETURN',
  'QUEUE',
  'NFQUEUE',
  'LOG',
  'ULOG',
  'MARK',
  'CONNMARK',
  'CONNSECMARK',
  'SECMARK',
  'TEE',
  'TPROXY',
  'MASQUERADE',
  'SNAT',
  'DNAT',
  'REDIRECT',
  'NETMAP',
  'SET',
  'CLUSTERIP',
  'NOTRACK',
  'CT',
  'CHECKSUM',
  'TCPMSS',
  'TOS',
  'TTL',
  'HL',
  'CLASSIFY',
  'DSCP',
  'ECN',
  'HMARK',
  'IDLETIMER',
  'LED',
  'RATEEST',
  'TRACE',
  'SYNPROXY',
  'AUDIT',
  'NFLOG',
  'OSF',
  'CHAOS',
]);
/** Match modules this auditor knows; anything else is a note, never a rejection. */
const MATCHES = new Set([
  'conntrack',
  'state',
  'multiport',
  'limit',
  'comment',
  'icmp',
  'icmp6',
  'tcp',
  'udp',
  'udplite',
  'sctp',
  'dccp',
  'addrtype',
  'mac',
  'iprange',
  'mark',
  'owner',
  'recent',
  'set',
  'time',
  'string',
  'hashlimit',
  'length',
  'physdev',
  'pkttype',
  'policy',
  'quota',
  'rpfilter',
  'socket',
  'statistic',
  'tos',
  'ttl',
  'hbh',
  'frag',
  'ah',
  'esp',
  'esp6',
  'ipv6header',
  'mh',
  'rt',
  'hl',
  'ecn',
  'dscp',
  'helper',
  'connbytes',
  'connlimit',
  'connlabel',
  'ct',
  'cgroup',
  'bpf',
]);
const PORT_PROTOCOLS = new Set(['tcp', 'udp', 'sctp', 'dccp', 'udplite']);
const NUMERIC_PROTOCOLS: Record<string, string> = {
  '6': 'tcp',
  '17': 'udp',
  '33': 'dccp',
  '132': 'sctp',
  '136': 'udplite',
};
const VALID_STATES = new Set([
  'NEW',
  'ESTABLISHED',
  'RELATED',
  'INVALID',
  'UNTRACKED',
  'SNAT',
  'DNAT',
]);
export const BUILT_IN: Record<string, string[]> = {
  filter: ['INPUT', 'FORWARD', 'OUTPUT'],
  nat: ['PREROUTING', 'INPUT', 'OUTPUT', 'POSTROUTING'],
  mangle: ['PREROUTING', 'INPUT', 'FORWARD', 'OUTPUT', 'POSTROUTING'],
  raw: ['PREROUTING', 'OUTPUT'],
  security: ['INPUT', 'FORWARD', 'OUTPUT'],
};
const NO_INTERFACE: Record<string, string> = {
  OUTPUT: "Can't use --in-interface with OUTPUT",
  POSTROUTING: "Can't use --in-interface with POSTROUTING",
};
const NO_OUT_INTERFACE: Record<string, string> = {
  INPUT: "Can't use --out-interface with INPUT",
  PREROUTING: "Can't use --out-interface with PREROUTING",
};
/** Options that consume the following token. */
const TAKES_ARGUMENT = new Set([
  '-s',
  '--source',
  '-d',
  '--destination',
  '-i',
  '--in-interface',
  '-o',
  '--out-interface',
  '-p',
  '--protocol',
  '-j',
  '--jump',
  '-g',
  '--goto',
  '-m',
  '--match',
  '--dport',
  '--sport',
  '--dports',
  '--sports',
  '--destination-ports',
  '--source-ports',
  '--ctstate',
  '--state',
  '--icmp-type',
  '--icmpv6-type',
  '--to-destination',
  '--to-source',
  '--to-ports',
  '--reject-with',
  '--log-prefix',
  '--log-level',
  '--log-tcp-sequence',
  '--log-tcp-options',
  '--log-ip-options',
  '--limit',
  '--limit-burst',
  '--comment',
  '--tcp-flags',
  '--mark',
  '--set-mark',
  '--set-xmark',
  '--physdev-in',
  '--physdev-out',
  '--uid-owner',
  '--gid-owner',
  '--mac-source',
  '--src-range',
  '--dst-range',
  '--name',
  '--set',
  '--string',
  '--hex-string',
  '--hashlimit-name',
  '--hashlimit-above',
  '--hashlimit-burst',
  '--hashlimit-mode',
  '--hashlimit-upto',
  '--hitcount',
  '--seconds',
  '--ttl-set',
  '--ttl-eq',
  '--ttl-lt',
  '--ttl-gt',
  '--ttl-dec',
  '--tos',
  '--dscp',
  '--dscp-class',
  '--set-mss',
  '--gateway',
  '--mode',
  '--tunnel-src',
  '--tunnel-dst',
  '--proto',
  '--helper',
  '--connbytes',
  '--connlimit-above',
  '--connlimit-mask',
  '--connlabel',
  '--cgroup',
  '--object',
  '--object-name',
  '--realms',
  '--ahspi',
  '--espspi',
  '--length',
  '--pkt-type',
  '--u32',
  '--quota',
  '--rateest1',
  '--rateest2',
  '--rateest-bps',
  '--rateest-pps',
  '--rateest-interval',
  '--radix',
  '-W',
  '--wait-interval',
  '--reap',
  '--set-counters',
  '--zone',
  '--dst-type',
  '--src-type',
  '--idletimer',
  '--led-trigger-id',
  '--led-delay',
  '--rateest-name',
  '--rateest-ewmalog',
  '--nflog-group',
  '--nflog-prefix',
  '--nflog-range',
  '--nflog-threshold',
  '--ulog-nlgroup',
  '--ulog-prefix',
  '--ulog-qthreshold',
  '--audit-type',
]);
/** Flags that stand alone; the parser accepts them without a value. */
const FLAG_OPTIONS = new Set([
  '--syn',
  '-n',
  '--numeric',
  '--random',
  '-w',
  '--wait',
  '-v',
  '--verbose',
  '-f',
  '--fragment',
  '--physdev-is-in',
  '--physdev-is-out',
  '--physdev-is-bridged',
  '--rttl',
  '--update',
  '--ecn-tcp-remove',
  '--line-numbers',
  '--fragment',
  '--checksum-fill',
  '--tcp-option',
  '--clamp-mss-to-pmtu',
]);

export interface PortSpec {
  text: string;
  kind: 'dport' | 'sport';
  first: number;
  last: number;
  service: string;
}

export interface Rule {
  number: number;
  line: number;
  table: string;
  chain: string;
  operation: string;
  raw: string;
  tokens: string[];
  matchText: string;
  targetText: string;
  target: string;
  proto: string;
  ports: PortSpec[];
  source: string;
  sourceNegated: boolean;
  destination: string;
  inInterface: string;
  outInterface: string;
  states: string[];
  modules: string[];
  unknownModules: string[];
  unconditional: boolean;
  comment: string;
  inserted: boolean;
  errors: string[];
  notes: string[];
}

export interface ChainInfo {
  name: string;
  table: string;
  policy: string;
  user: boolean;
  rules: Rule[];
}

export interface Finding {
  level: 'error' | 'warning' | 'note';
  problem: string;
  detail: string;
}

export interface ParseState {
  saveMode: boolean;
  currentTable: string;
  tables: Map<string, Map<string, ChainInfo>>;
  rules: Rule[];
  findings: Finding[];
  deletions: number;
}

export const clip = (value: string, max = CLIP): string => {
  const flat = value.replace(/\s+/gu, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
};

export const isNumber = (value: string): boolean => /^\d+$/u.test(value);

/** Splits a command line into words, honouring quotes and trailing comments. */
export function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote = '';
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index] ?? '';
    if (quote !== '') {
      if (character === '\\' && index + 1 < line.length) {
        current += line[index + 1] ?? '';
        index += 1;
        continue;
      }
      if (character === quote) {
        quote = '';
        continue;
      }
      current += character;
      continue;
    }
    if (character === '#' && current === '') break;
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '\\' && index + 1 < line.length) {
      current += line[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (/\s/u.test(character)) {
      if (current !== '') {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += character;
  }
  if (current !== '') tokens.push(current);
  return tokens;
}

/** Parses one port, port range or multiport element, quoting the same message iptables uses. */
function parsePortSpec(
  text: string,
  kind: 'dport' | 'sport',
): { spec: PortSpec | null; error: string } {
  const trimmed = text.trim();
  if (trimmed === '') return { spec: null, error: "invalid port/service `' specified" };
  const bad = { spec: null, error: 'invalid port/service `' + trimmed + "' specified" };
  const parts = trimmed.split(':');
  if (parts.length > 2) return bad;
  const first = parts[0] ?? '';
  const last = parts.length === 2 ? (parts[1] ?? '') : first;
  const name = /^[A-Za-z][A-Za-z0-9-]*$/u;
  if (first !== '' && !isNumber(first) && !name.test(first)) return bad;
  if (last !== '' && !isNumber(last) && !name.test(last)) return bad;
  const firstNumber = first === '' ? 0 : isNumber(first) ? Number.parseInt(first, 10) : null;
  const lastNumber = last === '' ? 65535 : isNumber(last) ? Number.parseInt(last, 10) : null;
  for (const value of [firstNumber, lastNumber]) {
    if (value !== null && (value < 0 || value > 65535)) return bad;
  }
  return {
    spec: {
      text: trimmed,
      kind,
      first: firstNumber ?? 0,
      last: lastNumber ?? 65535,
      service: firstNumber === null ? first.toLowerCase() : '',
    },
    error: '',
  };
}

export function parseRule(
  tokens: string[],
  chain: ChainInfo,
  line: number,
  operation: string,
): Rule {
  const errors: string[] = [];
  const ports: PortSpec[] = [];
  const modules: string[] = [];
  const unknownModules: string[] = [];
  const states: string[] = [];
  let proto = '';
  let source = '';
  let sourceNegated = false;
  let destination = '';
  let inInterface = '';
  let outInterface = '';
  let target = '';
  let jumped = false;
  let comment = '';
  let pendingNegation = false;
  const startIndex =
    operation === '-I' || operation === '--insert' ? (isNumber(tokens[2] ?? '') ? 3 : 2) : 2;
  let targetStart = tokens.length;

  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index] ?? '';
    if (token === '') continue;
    if (token === '!') {
      pendingNegation = true;
      continue;
    }
    let option = token;
    let negated = pendingNegation;
    pendingNegation = false;
    if (option.startsWith('!') && option.length > 1) {
      negated = true;
      option = option.slice(1);
    }
    if (!option.startsWith('-')) {
      errors.push('unknown option "' + option + '"');
      continue;
    }
    let value = '';
    if (TAKES_ARGUMENT.has(option)) {
      const next = tokens[index + 1];
      if (next === undefined) {
        errors.push('option "' + option + '" requires an argument');
        continue;
      }
      if (next === '!') {
        value = tokens[index + 2] ?? '';
        index += 2;
      } else {
        value = next;
        index += 1;
      }
    }
    switch (option) {
      case '-s':
      case '--source':
        source = value;
        sourceNegated = negated;
        break;
      case '-d':
      case '--destination':
        destination = value;
        break;
      case '-i':
      case '--in-interface':
        inInterface = value;
        break;
      case '-o':
      case '--out-interface':
        outInterface = value;
        break;
      case '-p':
      case '--protocol': {
        const lower = value.toLowerCase();
        proto = NUMERIC_PROTOCOLS[lower] ?? lower;
        break;
      }
      case '-m':
      case '--match':
        if (MATCHES.has(value)) modules.push(value);
        else unknownModules.push(value);
        break;
      case '-j':
      case '--jump':
      case '-g':
      case '--goto':
        if (jumped) errors.push('multiple --jump options not allowed');
        jumped = true;
        target = value;
        targetStart = Math.min(targetStart, index - 1);
        break;
      case '--dport':
      case '--sport':
      case '--dports':
      case '--sports':
      case '--destination-ports':
      case '--source-ports': {
        const sport = option === '--sport' || option === '--sports' || option === '--source-ports';
        if (!PORT_PROTOCOLS.has(proto)) {
          errors.push('unknown option "' + option + '"');
          break;
        }
        for (const element of value.split(',')) {
          const parsed = parsePortSpec(element, sport ? 'sport' : 'dport');
          if (parsed.error !== '') errors.push(parsed.error);
          else if (parsed.spec !== null) ports.push(parsed.spec);
        }
        break;
      }
      case '--ctstate':
      case '--state': {
        if (option === '--state') modules.push('state');
        for (const element of value.split(',')) {
          const upper = element.trim().toUpperCase();
          if (upper === '') continue;
          if (!VALID_STATES.has(upper)) errors.push('Bad ctstate "' + element.trim() + '"');
          else states.push(upper);
        }
        break;
      }
      case '--comment':
      case '--log-prefix':
        comment = value;
        break;
      case '--tcp-flags':
        index += 1;
        break;
      default:
        if (!TAKES_ARGUMENT.has(option) && !FLAG_OPTIONS.has(option))
          errors.push('unknown option "' + option + '"');
        break;
    }
  }

  if (inInterface !== '' && chain.name in NO_INTERFACE) errors.push(NO_INTERFACE[chain.name] ?? '');
  if (outInterface !== '' && chain.name in NO_OUT_INTERFACE)
    errors.push(NO_OUT_INTERFACE[chain.name] ?? '');

  const matchTokens = tokens.slice(startIndex, Math.min(targetStart, tokens.length));
  const targetTokens = targetStart < tokens.length ? tokens.slice(targetStart) : [];
  return {
    number: 0,
    line,
    table: chain.table,
    chain: chain.name,
    operation,
    raw: tokens.join(' '),
    tokens,
    matchText: matchTokens.join(' '),
    targetText: targetTokens.join(' '),
    target: target.toUpperCase(),
    proto: proto === '' ? 'all' : proto,
    ports,
    source,
    sourceNegated,
    destination,
    inInterface,
    outInterface,
    states,
    modules,
    unknownModules,
    unconditional: matchTokens.length === 0,
    comment,
    inserted: operation === '-I' || operation === '--insert',
    errors: errors.filter((error) => error !== ''),
    notes: [],
  };
}

/** True when the text is nftables syntax rather than iptables. */
export function looksLikeNft(text: string): boolean {
  return text.split('\n').some((line) => {
    const trimmed = line.trim();
    if (
      trimmed.startsWith('#') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith(':') ||
      trimmed.startsWith('-')
    )
      return false;
    return (
      /^table\s+(ip|ip6|inet|bridge|arp|netdev)\s/u.test(trimmed) ||
      /^chain\s+\S+/u.test(trimmed) ||
      /^(add|flush|delete)\s+(table|chain|rule|set|map)\s/u.test(trimmed)
    );
  });
}

export const isEstablishedAccept = (rule: Rule): boolean =>
  rule.target === 'ACCEPT' &&
  (rule.states.includes('ESTABLISHED') || rule.states.includes('RELATED'));

export function analyze(state: ParseState): Finding[] {
  const findings = state.findings;
  const push = (level: Finding['level'], problem: string, detail: string): void => {
    if (findings.length < MAX_FINDINGS) findings.push({ level, problem, detail });
  };
  const chains: ChainInfo[] = [];
  for (const tableChains of state.tables.values())
    for (const chain of tableChains.values()) chains.push(chain);
  const declared = new Set(chains.map((chain) => chain.name));
  const seen = new Map<string, Rule>();

  for (const chain of chains) {
    let dead = '';
    for (const rule of chain.rules) {
      for (const error of rule.errors) {
        push(
          'error',
          'A rule is not valid iptables grammar',
          'Line ' + rule.line + ': ' + error + ' — ' + clip(rule.raw, 80),
        );
      }
      if (rule.errors.length > 0) {
        // iptables refuses a ruleset containing an invalid rule, so it cannot shadow anything.
      } else if (dead !== '') {
        rule.notes.push('unreachable, rule ' + dead + ' matches everything');
        push(
          'warning',
          'A rule can never match',
          'Line ' +
            rule.line +
            ' sits after rule ' +
            dead +
            ' in ' +
            chain.name +
            ', which has no match conditions. iptables stops at the first match, so this rule is dead.',
        );
      } else if (rule.unconditional && TERMINAL_NAMES.has(rule.target)) {
        dead = String(rule.number);
      }
      if (rule.target !== '' && !TARGETS.has(rule.target) && !declared.has(rule.target)) {
        push(
          'error',
          'A rule jumps to a chain that does not exist',
          'Line ' +
            rule.line +
            ' targets ' +
            rule.target +
            ', which no table creates (iptables: No chain/target/match by that name).',
        );
      }
      if (rule.modules.includes('state')) {
        push(
          'warning',
          'A deprecated match module is used',
          'Line ' +
            rule.line +
            ' uses -m state; -m conntrack --ctstate is the current spelling and understands more states.',
        );
      }
      if (rule.unknownModules.length > 0) {
        push(
          'note',
          'A match module this auditor does not know',
          'Line ' +
            rule.line +
            ' loads ' +
            rule.unknownModules.join(', ') +
            '. It is kept as written; only your kernel can say whether the module exists.',
        );
      }
      if (rule.target === 'LOG' && !rule.modules.includes('limit')) {
        push(
          'warning',
          'A log rule has no rate limit',
          'Line ' +
            rule.line +
            ' logs every packet; without -m limit --limit N/min a port scan fills the journal.',
        );
      }
      if (rule.ports.some((port) => port.text === '0')) {
        push(
          'note',
          'A rule matches port 0',
          'Line ' +
            rule.line +
            ' matches port 0, which iptables accepts but no service listens on.',
        );
      }
      if (
        rule.target === 'ACCEPT' &&
        rule.proto === 'tcp' &&
        rule.ports.length > 0 &&
        !rule.tokens.includes('--syn')
      ) {
        rule.notes.push('no --syn');
        push(
          'note',
          'A TCP port is accepted without --syn',
          'Line ' +
            rule.line +
            ' accepts every TCP flag combination on port ' +
            rule.ports.map((port) => port.text).join('/') +
            '; adding --syn accepts connection attempts only.',
        );
      }
      const key = chain.name + ' ' + rule.raw;
      const previous = seen.get(key);
      if (previous !== undefined) {
        rule.notes.push('duplicate of rule ' + previous.number);
        push(
          'warning',
          'A duplicate rule',
          'Lines ' +
            previous.line +
            ' and ' +
            rule.line +
            ' are identical and always match together.',
        );
      } else {
        seen.set(key, rule);
      }
    }
    const droppers = chain.rules.filter(
      (rule) => rule.target === 'DROP' || rule.target === 'REJECT',
    );
    if (droppers.length > 0 && chain.policy === 'ACCEPT') {
      push(
        'warning',
        'A drop rule sits under an ACCEPT policy',
        chain.name +
          ' ends by accepting whatever its explicit DROP and REJECT rules miss. A policy of DROP is the fail-closed choice.',
      );
    }
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
    ) {
      push(
        'warning',
        'Nothing accepts established connections',
        chain.name +
          ' drops by default but has no -m conntrack --ctstate ESTABLISHED,RELATED rule, so replies to connections this host started can be dropped.',
      );
    }
  }

  const referenced = new Set<string>();
  for (const chain of chains)
    for (const rule of chain.rules)
      if (rule.target !== '' && !TARGETS.has(rule.target)) referenced.add(rule.target);
  for (const chain of chains) {
    if (chain.user && !referenced.has(chain.name)) {
      push(
        'note',
        'A user chain is never referenced',
        chain.name + ' is created but no rule jumps to it, so its rules never run.',
      );
    }
  }

  for (const chain of chains) {
    if (chain.policy !== '' && chain.policy !== 'ACCEPT' && chain.policy !== 'DROP') {
      push(
        'warning',
        'A policy name no kernel accepts',
        chain.name +
          ' in table ' +
          chain.table +
          ' has policy ' +
          chain.policy +
          '. The iptables-save parser accepts any word here; the kernel only knows ACCEPT and DROP.',
      );
    }
  }

  if (findings.some((finding) => finding.level === 'error')) {
    push(
      'note',
      'The ruleset would be refused before it does anything',
      'iptables-restore applies a table only after parsing all of it, so while an error is present the rules below describe intent rather than a running firewall.',
    );
  }
  if (state.saveMode && state.currentTable !== '') {
    push(
      'error',
      'A table is not closed',
      'Table ' +
        state.currentTable +
        ' has no COMMIT, so iptables-restore stops with "COMMIT expected" and applies nothing.',
    );
  }
  return findings;
}
