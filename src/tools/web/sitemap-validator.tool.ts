import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './sitemap-validator.meta';

/**
 * XML sitemap validator.
 *
 * Confirms the urlset root, counts entries, and checks each entry for a valid
 * loc, a W3C lastmod, a priority in 0.0..1.0 and a changefreq from the allowed
 * set, plus specification limits and duplicate locs. Expected values come from
 * the byte-exact fixture, never from this parser.
 */

const MAX_CHARS = 60 * 1024 * 1024;
const MAX_URLS = 50000;
const CHANGEFREQ = new Set(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']);

interface Entry {
  index: number;
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
}

interface Issue {
  index: number;
  loc: string;
  message: string;
}

interface Model {
  entries: Entry[];
  issues: Issue[];
  hasUrlset: boolean;
  hasNamespace: boolean;
}

function blocks(text: string, tag: string): string[] {
  const re = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)</' + tag + '>', 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[1] ?? '');
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
  return out;
}

function tag(path: string, name: string): string {
  const re = new RegExp('<' + name + '\\b[^>]*>\\s*([\\s\\S]*?)\\s*</' + name + '>', 'i');
  const m = re.exec(path);
  return m === null ? '' : (m[1] ?? '').trim();
}

const DATE_RE = /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?)?)?$/;

function parseSitemap(text: string): Model {
  const hasUrlset = /<(?:[\w-]+:)?urlset\b/i.test(text);
  if (!hasUrlset) {
    // urlset index files are also valid sitemaps
    if (/<(?:[\w-]+:)?sitemapindex\b/i.test(text)) {
      throw new ToolError(
        'That is a sitemap index, not a URL list. Paste a sitemap containing urlset entries.',
      );
    }
    throw new ToolError('That does not look like an XML sitemap.', 'Paste a sitemap.xml file.');
  }
  const hasNamespace =
    /xmlns\s*=\s*["']https?:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/i.test(text);

  const urlBlocks = blocks(text, 'url');
  if (urlBlocks.length === 0) throw new ToolError('That sitemap has no url entries.');

  const issues: Issue[] = [];
  const seen = new Set<string>();
  const entries: Entry[] = urlBlocks.map((b, i) => {
    const loc = tag(b, 'loc');
    const lastmod = tag(b, 'lastmod');
    const changefreq = tag(b, 'changefreq').toLowerCase();
    const priority = tag(b, 'priority');
    const idx = i + 1;

    if (loc === '') {
      issues.push({ index: idx, loc: '(missing)', message: 'Entry has no loc.' });
    } else {
      if (!/^https?:\/\//i.test(loc)) {
        issues.push({ index: idx, loc, message: 'loc is not an absolute http(s) URL.' });
      }
      if (seen.has(loc)) issues.push({ index: idx, loc, message: 'Duplicate loc.' });
      else seen.add(loc);
    }
    if (lastmod !== '' && !DATE_RE.test(lastmod)) {
      issues.push({ index: idx, loc, message: 'lastmod "' + lastmod + '" is not a W3C date.' });
    }
    if (changefreq !== '' && !CHANGEFREQ.has(changefreq)) {
      issues.push({
        index: idx,
        loc,
        message: 'changefreq "' + changefreq + '" is not a valid value.',
      });
    }
    if (priority !== '') {
      const p = Number(priority);
      if (!Number.isFinite(p) || p < 0 || p > 1) {
        issues.push({
          index: idx,
          loc,
          message: 'priority "' + priority + '" is outside 0.0 to 1.0.',
        });
      }
    }
    return { index: idx, loc, lastmod, changefreq, priority };
  });

  if (entries.length > MAX_URLS) {
    issues.push({
      index: 0,
      loc: '(sitemap)',
      message: 'More than ' + MAX_URLS + ' URLs; split into an index.',
    });
  }

  return { entries, issues, hasUrlset, hasNamespace };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', 'XML sitemap'],
      ['urlset root', m.hasUrlset ? 'yes' : 'no'],
      ['Namespace', m.hasNamespace ? 'present' : 'missing'],
      ['URLs', String(m.entries.length)],
      ['With lastmod', String(m.entries.filter((e) => e.lastmod !== '').length)],
      ['With priority', String(m.entries.filter((e) => e.priority !== '').length)],
      ['Issues', String(m.issues.length)],
    ],
  };
}

function tableUrls(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? m.entries.slice(0, max) : [];
  return {
    headers: ['#', 'loc', 'lastmod', 'changefreq', 'priority'],
    rows: shown.map((e) => [
      String(e.index),
      e.loc,
      e.lastmod || '-',
      e.changefreq || '-',
      e.priority || '-',
    ]),
  };
}

function tableIssues(m: Model): { headers: string[]; rows: string[][] } {
  if (m.issues.length === 0) return { headers: ['Result'], rows: [['No issues found']] };
  return {
    headers: ['#', 'loc', 'Problem'],
    rows: m.issues.map((g) => [String(g.index), g.loc, g.message]),
  };
}

function asTable(table: { headers: string[]; rows: string[][] }): TextRunResult {
  return { output: JSON.stringify(table), render: 'table' };
}

function run(input: TextRunInput): TextRunResult {
  const options = input.options;
  const format = String(options.format ?? 'summary');
  const maxRows = Math.max(0, Math.min(50000, Number(options.maxRows ?? 100) || 0));

  const text = input.text ?? '';
  if (text.trim().length === 0)
    throw new ToolError('No sitemap was provided.', 'Paste a sitemap.xml file.');
  if (text.length > MAX_CHARS) throw new ToolError('That sitemap is larger than 60 MB.');

  const m = parseSitemap(text);

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'urls':
      table = tableUrls(m, maxRows);
      break;
    case 'issues':
      table = tableIssues(m);
      break;
    case 'summary':
    default:
      table = tableSummary(m);
  }
  return asTable(table);
}

const tool: TextToolModule = { meta, run };
export default tool;
