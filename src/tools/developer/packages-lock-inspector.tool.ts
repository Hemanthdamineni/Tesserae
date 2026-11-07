import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './packages-lock-inspector.meta';

const MAX_CHARS = 16 * 1024 * 1024;

interface Pkg {
  path: string;
  name: string;
  version: string;
  hasResolved: boolean;
  hasIntegrity: boolean;
  dev: boolean;
}

interface Issue {
  index: number;
  path: string;
  message: string;
}

interface Model {
  lockfileVersion: number;
  rootName: string;
  rootVersion: string;
  packages: Pkg[];
  topDeps: string[];
  issues: Issue[];
}

function obj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pkgName(path: string): string {
  const idx = path.lastIndexOf('node_modules/');
  if (idx === -1) return path;
  return path.slice(idx + 'node_modules/'.length);
}

function fromPackagesMap(map: Record<string, unknown>, issues: Issue[]): Pkg[] {
  const out: Pkg[] = [];
  let i = 0;
  for (const key of Object.keys(map)) {
    if (key === '') continue;
    const e = obj(map[key]);
    i += 1;
    const path = key;
    const hasResolved = str(e.resolved) !== '';
    const hasIntegrity = str(e.integrity) !== '';
    const version = str(e.version);
    if (version === '') issues.push({ index: i, path, message: 'Package has no version.' });
    if (!hasResolved) issues.push({ index: i, path, message: 'Package has no resolved URL.' });
    if (!hasIntegrity) issues.push({ index: i, path, message: 'Package has no integrity hash.' });
    out.push({
      path,
      name: pkgName(path),
      version,
      hasResolved,
      hasIntegrity,
      dev: e.dev === true,
    });
  }
  return out;
}

function fromDependenciesTree(
  tree: Record<string, unknown>,
  prefix: string,
  out: Pkg[],
  issues: Issue[],
): void {
  for (const name of Object.keys(tree)) {
    const e = obj(tree[name]);
    const path = prefix === '' ? 'node_modules/' + name : prefix + '/node_modules/' + name;
    const version = str(e.version);
    const hasResolved = str(e.resolved) !== '';
    const hasIntegrity = str(e.integrity) !== '';
    const index = out.length + 1;
    if (version === '') issues.push({ index, path, message: 'Package has no version.' });
    if (!hasResolved) issues.push({ index, path, message: 'Package has no resolved URL.' });
    if (!hasIntegrity) issues.push({ index, path, message: 'Package has no integrity hash.' });
    out.push({ path, name, version, hasResolved, hasIntegrity, dev: e.dev === true });
    const nested = obj(e.dependencies);
    if (Object.keys(nested).length > 0) fromDependenciesTree(nested, path, out, issues);
  }
}

function parseLock(text: string): Model {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ToolError('That is not valid JSON.', 'Paste a package-lock.json file.');
  }
  const root = obj(data);
  const versionRaw = root.lockfileVersion;
  const lockfileVersion = typeof versionRaw === 'number' ? versionRaw : 0;
  if (lockfileVersion === 0) {
    throw new ToolError(
      'That JSON is not an npm package-lock file.',
      'Paste a package-lock.json file.',
    );
  }
  if (lockfileVersion !== 1 && lockfileVersion !== 2 && lockfileVersion !== 3) {
    // tolerated, reported as an issue below
  }

  const issues: Issue[] = [];
  const rootMeta = obj(obj(root.packages)['']);
  const rootName = str(root.name) !== '' ? str(root.name) : str(rootMeta.name);
  const rootVersion = str(root.version) !== '' ? str(root.version) : str(rootMeta.version);

  let packages: Pkg[];
  const map = obj(root.packages);
  const tree = obj(root.dependencies);
  if (Object.keys(map).length > 0) {
    packages = fromPackagesMap(map, issues);
  } else if (Object.keys(tree).length > 0) {
    packages = [];
    fromDependenciesTree(tree, '', packages, issues);
  } else {
    throw new ToolError('That lockfile has no packages.');
  }

  const topDeps: string[] = [];
  const depSource = Object.keys(obj(obj(rootMeta).dependencies)).length > 0 ? rootMeta : root;
  for (const name of Object.keys(obj(depSource.dependencies))) topDeps.push(name);

  if (lockfileVersion < 1 || lockfileVersion > 3) {
    issues.push({
      index: 0,
      path: '(lockfile)',
      message: 'Unexpected lockfile version ' + String(lockfileVersion) + '.',
    });
  }

  return { lockfileVersion, rootName, rootVersion, packages, topDeps, issues };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const installed = m.packages.length;
  const withResolved = m.packages.filter((p) => p.hasResolved).length;
  const withIntegrity = m.packages.filter((p) => p.hasIntegrity).length;
  const dev = m.packages.filter((p) => p.dev).length;
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['lockfileVersion', String(m.lockfileVersion)],
      ['Root name', m.rootName === '' ? '(none)' : m.rootName],
      ['Root version', m.rootVersion === '' ? '(none)' : m.rootVersion],
      ['Packages', String(installed)],
      ['With resolved URL', String(withResolved)],
      ['With integrity hash', String(withIntegrity)],
      ['Dev packages', String(dev)],
      ['Root dependencies', String(m.topDeps.length)],
      ['Issues', String(m.issues.length)],
    ],
  };
}

function tablePackages(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['#', 'Name', 'Version', 'Resolved', 'Integrity', 'Dev'],
    rows: m.packages.map((p, i) => [
      String(i + 1),
      p.name,
      p.version === '' ? '-' : p.version,
      p.hasResolved ? 'yes' : 'no',
      p.hasIntegrity ? 'yes' : 'no',
      p.dev ? 'yes' : 'no',
    ]),
  };
}

function tableIssues(m: Model): { headers: string[]; rows: string[][] } {
  if (m.issues.length === 0) return { headers: ['Result'], rows: [['No issues found']] };
  return {
    headers: ['#', 'Path', 'Problem'],
    rows: m.issues.map((g) => [String(g.index), g.path, g.message]),
  };
}

function asTable(table: { headers: string[]; rows: string[][] }): TextRunResult {
  return { output: JSON.stringify(table), render: 'table' };
}

function run(input: TextRunInput): TextRunResult {
  const options = input.options;
  const format = String(options.format ?? 'summary');
  const text = input.text ?? '';
  if (text.trim().length === 0)
    throw new ToolError('No lockfile was provided.', 'Paste a package-lock.json file.');
  if (text.length > MAX_CHARS) throw new ToolError('That lockfile is larger than 16 MB.');

  const m = parseLock(text);

  let table: { headers: string[]; rows: string[][] };
  if (format === 'packages') table = tablePackages(m);
  else if (format === 'issues') table = tableIssues(m);
  else table = tableSummary(m);
  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
