import { describe, it, expect, vi } from 'vitest';
import tool, {
  computeSavings,
  detectFormat,
  findCssProblems,
  outputFilename,
  resolveLanguageOption,
  resolvePresetOption,
  utf8Bytes,
  validateHtmlStructure,
} from './code-minify.tool';
import beautify from './code-beautify.tool';
import { ToolError } from '@/lib/types';

type Res = {
  output: string;
  render?: string;
  language?: string;
  filename?: string;
  notes?: string[];
  stats?: Record<string, string | number>;
};

const run = async (
  text: string,
  options: Record<string, string | number | boolean> = {},
): Promise<Res> => (await tool.run({ text, options })) as Res;

const catchError = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await Promise.resolve(tool.run({ text, options })).catch((e: unknown) => e)) as ToolError;

/* -------------------------------------------------------------------------- */
/*  Pure helpers — no minifier is loaded for any of these                     */
/* -------------------------------------------------------------------------- */

describe('code-minify — format detection', () => {
  it('detects JSON', () => {
    expect(detectFormat('{"a":1,"b":[2,3]}')).toBe('json');
    expect(detectFormat('  [1, 2, 3]  ')).toBe('json');
  });

  it('does not mistake JavaScript objects for JSON', () => {
    expect(detectFormat('const o = { a: 1 };')).toBe('javascript');
  });

  it('detects HTML', () => {
    expect(detectFormat('<!doctype html><html><body><p>hi</p></body></html>')).toBe('html');
    expect(detectFormat('<div class="a">hi</div>')).toBe('html');
  });

  it('detects CSS', () => {
    expect(detectFormat('a { color: red; margin: 0 }')).toBe('css');
    expect(detectFormat('.card {\n  padding: 4px;\n}')).toBe('css');
  });

  it('detects TypeScript', () => {
    expect(detectFormat('interface User { id: number }')).toBe('typescript');
    expect(detectFormat('type Name = string;')).toBe('typescript');
    expect(detectFormat('const greet = (name: string): string => name;')).toBe('typescript');
    expect(detectFormat('enum Color { Red, Blue }')).toBe('typescript');
  });

  it('detects JavaScript', () => {
    expect(detectFormat('const x = 1;')).toBe('javascript');
    expect(detectFormat('function add(a, b) { return a + b; }')).toBe('javascript');
    expect(detectFormat('export default { a: 1 };')).toBe('javascript');
  });

  it('returns javascript for empty input', () => {
    expect(detectFormat('')).toBe('javascript');
    expect(detectFormat('   \n ')).toBe('javascript');
  });
});

describe('code-minify — option validation', () => {
  it('keeps a known language', () => {
    expect(resolveLanguageOption('css')).toBe('css');
    expect(resolveLanguageOption('typescript')).toBe('typescript');
    expect(resolveLanguageOption('json')).toBe('json');
  });

  it('treats auto and unknown values as auto-detect', () => {
    expect(resolveLanguageOption('auto')).toBe('auto');
    expect(resolveLanguageOption('rust')).toBe('auto');
    expect(resolveLanguageOption(undefined)).toBe('auto');
  });

  it('only accepts the two presets', () => {
    expect(resolvePresetOption('aggressive')).toBe('aggressive');
    expect(resolvePresetOption('safe')).toBe('safe');
    expect(resolvePresetOption('nonsense')).toBe('safe');
    expect(resolvePresetOption(undefined)).toBe('safe');
  });
});

describe('code-minify — output filename', () => {
  it('uses one extension per format', () => {
    expect(outputFilename('javascript')).toBe('minified.js');
    expect(outputFilename('typescript')).toBe('minified.ts');
    expect(outputFilename('css')).toBe('minified.css');
    expect(outputFilename('html')).toBe('minified.html');
    expect(outputFilename('json')).toBe('minified.json');
  });
});

describe('code-minify — savings maths', () => {
  it('counts UTF-8 bytes, not characters', () => {
    expect(utf8Bytes('abc')).toBe(3);
    expect(utf8Bytes('é')).toBe(2);
    expect(utf8Bytes('漢')).toBe(3);
    expect(utf8Bytes('😀')).toBe(4);
    expect(utf8Bytes('')).toBe(0);
  });

  it('measures the difference between input and output', () => {
    const savings = computeSavings('a  b\n c', 'a b c');
    expect(savings.inputBytes).toBe(7);
    expect(savings.outputBytes).toBe(5);
    expect(savings.savedBytes).toBe(2);
    expect(savings.savedPercent).toBeCloseTo(28.571, 2);
  });

  it('never divides by zero', () => {
    const savings = computeSavings('', '');
    expect(savings.inputBytes).toBe(0);
    expect(savings.outputBytes).toBe(0);
    expect(savings.savedBytes).toBe(0);
    expect(savings.savedPercent).toBe(0);
  });

  it('counts emoji as four bytes', () => {
    const savings = computeSavings('😀', '😀');
    expect(savings.inputBytes).toBe(4);
    expect(savings.savedBytes).toBe(0);
  });
});

describe('code-minify — HTML structure check', () => {
  it('accepts balanced markup', () => {
    expect(() => validateHtmlStructure('<div><p>hi</p></div>')).not.toThrow();
    expect(() => validateHtmlStructure('<ul><li>a<li>b</ul>')).not.toThrow();
    expect(() => validateHtmlStructure('<br><img src="a.png">')).not.toThrow();
    expect(() => validateHtmlStructure('<input type="text" disabled>')).not.toThrow();
  });

  it('rejects a mismatched closing tag', () => {
    expect(() => validateHtmlStructure('<div><span></div>')).toThrow(ToolError);
  });

  it('rejects a stray closing tag', () => {
    expect(() => validateHtmlStructure('</div>')).toThrow(ToolError);
  });

  it('rejects an unclosed element', () => {
    expect(() => validateHtmlStructure('<div><span>text')).toThrow(/Unclosed/);
  });

  it('rejects an unclosed comment', () => {
    expect(() => validateHtmlStructure('<!-- oops')).toThrow(/comment/i);
  });

  it('rejects an unterminated tag', () => {
    expect(() => validateHtmlStructure('<div class="a"')).toThrow(/Unclosed/);
  });
});

describe('code-minify — CSS problem check', () => {
  it('accepts ordinary stylesheets', () => {
    expect(findCssProblems('a { color: red; margin: 0 1px }')).toEqual([]);
    expect(findCssProblems('@media (min-width: 40em) { .a { color: red } }')).toEqual([]);
    expect(findCssProblems('/* comment */ .a { content: "a & b"; }')).toEqual([]);
    expect(findCssProblems('.a { background: url(a&b.png); }')).toEqual([]);
  });

  it('spots nested selectors', () => {
    const problems = findCssProblems('.a { &:hover { color: red } }');
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toMatch(/nested/i);
  });

  it('spots a declaration with no value', () => {
    const problems = findCssProblems('a { color: ; }');
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toMatch(/no value/i);
  });

  it('spots an unclosed block', () => {
    const problems = findCssProblems('a { color: red;');
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toMatch(/unclosed/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  One happy path per format                                                 */
/* -------------------------------------------------------------------------- */

describe('code-minify — one happy path per format', () => {
  it('JavaScript', async () => {
    const res = await run('const greeting = "hello";\nconsole.log(greeting);', {
      language: 'javascript',
    });
    expect(res.output).toBe('const greeting="hello";console.log("hello");');
    expect(res.language).toBe('javascript');
    expect(res.filename).toBe('minified.js');
    expect(res.render).toBe('code');
  });

  it('TypeScript — types are stripped', async () => {
    const res = await run(
      'interface User { id: number; name: string }\nconst u: User = { id: 1, name: "Ada" };',
      {
        language: 'typescript',
      },
    );
    expect(res.output).toBe('const u={id:1,name:"Ada"};');
    expect(res.output).not.toContain('interface');
    expect(res.filename).toBe('minified.ts');
    // The output is plain JavaScript, but the stats name the source language.
    expect(res.language).toBe('javascript');
    expect(res.stats?.language).toBe('typescript');
  });

  it('TypeScript — enums and namespaces survive as JavaScript', async () => {
    const res = await run('enum Color { Red, Blue }\nconsole.log(Color.Red);', {
      language: 'typescript',
    });
    expect(res.output).toContain('Red');
    expect(res.output).not.toContain('enum');
    expect(() => new Function(res.output)).not.toThrow();
  });

  it('CSS', async () => {
    const res = await run('body {\n  margin: 0;\n  color: #ff0000;\n}', { language: 'css' });
    expect(res.output).toBe('body{margin:0;color:red}');
    expect(res.language).toBe('css');
    expect(res.filename).toBe('minified.css');
  });

  it('HTML', async () => {
    const res = await run(
      '<!doctype html>\n<html>\n  <head>\n    <title>Hi</title>\n  </head>\n  <body>\n    <!-- comment -->\n    <p class="a">Hello</p>\n  </body>\n</html>',
      {
        language: 'html',
      },
    );
    expect(res.output).toBe(
      '<!doctype html><html><head><title>Hi</title></head><body><p class="a">Hello</p></body></html>',
    );
    expect(res.language).toBe('html');
    expect(res.filename).toBe('minified.html');
  });

  it('JSON', async () => {
    const res = await run('{ "b": 2, "a": [1, 2, 3] }', { language: 'json' });
    expect(res.output).toBe('{"b":2,"a":[1,2,3]}');
    expect(JSON.parse(res.output)).toEqual({ b: 2, a: [1, 2, 3] });
    expect(res.language).toBe('json');
    expect(res.filename).toBe('minified.json');
  });

  it('every format reports the bytes it saved', async () => {
    const res = await run('{ "b": 2, "a": [1, 2, 3] }', { language: 'json' });
    expect(res.stats).toMatchObject({
      'input bytes': 26,
      'output bytes': 19,
      'bytes saved': 7,
    });
    expect(res.stats?.['percent saved']).toBe('26.9%');
  });
});

/* -------------------------------------------------------------------------- */
/*  Options                                                                   */
/* -------------------------------------------------------------------------- */

describe('code-minify — options', () => {
  const source =
    'function calculateTotal(items) {\n  let total = 0;\n  for (const item of items) {\n    total += item.price;\n  }\n  return total;\n}\ncalculateTotal(cart);';

  it('safe compression keeps names', async () => {
    const res = await run(source, { language: 'javascript', preset: 'safe' });
    expect(res.output).toContain('calculateTotal');
    expect(res.output).toContain('total');
  });

  it('aggressive compression renames them', async () => {
    const res = await run(source, { language: 'javascript', preset: 'aggressive' });
    expect(res.output).not.toContain('calculateTotal');
    expect(res.output.length).toBeLessThan(source.length);
    expect(res.notes?.join(' ')).toMatch(/Aggressive/);
  });

  it('aggressive CSS merges identical rules', async () => {
    const css = '.a { color: red; }\n.b { color: red; }';
    const safe = await run(css, { language: 'css', preset: 'safe' });
    const aggressive = await run(css, { language: 'css', preset: 'aggressive' });
    expect(safe.output).toBe('.a{color:red}.b{color:red}');
    expect(aggressive.output).toBe('.a,.b{color:red}');
  });

  it('aggressive HTML drops optional end tags', async () => {
    const html = '<html><head><title>t</title></head><body><p>hi</p></body></html>';
    const safe = await run(html, { language: 'html', preset: 'safe' });
    const aggressive = await run(html, { language: 'html', preset: 'aggressive' });
    expect(safe.output).toContain('<head>');
    expect(aggressive.output).not.toContain('<head>');
    expect(aggressive.output.length).toBeLessThan(safe.output.length);
  });

  it('auto-detect picks the format', async () => {
    const json = await run('{ "a": 1 }');
    expect(json.language).toBe('json');
    const css = await run('a { color: red; }');
    expect(css.language).toBe('css');
    const html = await run('<!doctype html><html><body><p>hi</p></body></html>');
    expect(html.language).toBe('html');
    const ts = await run('interface A { x: number }');
    expect(ts.language).toBe('javascript'); // TypeScript is compiled to JavaScript
  });

  it('auto-detect understands TypeScript', async () => {
    const res = await run('const greet = (name: string): string => `hi ${name}`;');
    expect(res.output).not.toContain('string');
    expect(() => new Function(res.output)).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/*  Errors and edges                                                          */
/* -------------------------------------------------------------------------- */

describe('code-minify — errors and edges', () => {
  it('reports a syntax error in JavaScript', async () => {
    const error = await catchError('const x = ;', { language: 'javascript' });
    expect(error).toBeInstanceOf(ToolError);
    expect(error.message).toMatch(/Unexpected token/i);
    expect(error.hint).toBeTruthy();
  });

  it('reports a syntax error in TypeScript', async () => {
    const error = await catchError('const x: = ;', { language: 'typescript' });
    expect(error).toBeInstanceOf(ToolError);
    expect(error.hint).toBeTruthy();
  });

  it('reports malformed CSS', async () => {
    const error = await catchError('a { color: red;', { language: 'css' });
    expect(error).toBeInstanceOf(ToolError);
    expect(error.message).toMatch(/unclosed/i);
  });

  it('reports CSS that uses nesting instead of dropping it silently', async () => {
    const error = await catchError('.a { &:hover { color: red } }', { language: 'css' });
    expect(error).toBeInstanceOf(ToolError);
    expect(error.message).toMatch(/nested/i);
  });

  it('reports malformed HTML', async () => {
    const error = await catchError('<div><span></div>', { language: 'html' });
    expect(error).toBeInstanceOf(ToolError);
    expect(error.message).toMatch(/closing tag/i);
  });

  it('reports malformed JSON', async () => {
    const error = await catchError('{"a": }', { language: 'json' });
    expect(error).toBeInstanceOf(ToolError);
    expect(error.hint).toBeTruthy();
  });

  it('points at the TypeScript option when TypeScript is pasted as JavaScript', async () => {
    const error = await catchError('interface A { x: number }', { language: 'javascript' });
    expect(error).toBeInstanceOf(ToolError);
    expect(error.message).toMatch(/TypeScript/);
    expect(error.hint).toMatch(/TypeScript/);
  });

  it('empty input returns an empty result, not an error', async () => {
    const res = await run('', { language: 'javascript' });
    expect(res.output).toBe('');
    expect(res.notes?.join(' ')).toMatch(/empty/i);
    expect(res.stats?.['input bytes']).toBe(0);
  });

  it('whitespace-only input returns an empty result', async () => {
    const res = await run('   \n\t  ', { language: 'auto' });
    expect(res.output).toBe('');
  });

  it('keeps Unicode content intact', async () => {
    const res = await run('const s = "héllo 😀 漢字 שלום";', { language: 'javascript' });
    expect(res.output).toContain('héllo 😀 漢字 שלום');
    expect(() => new Function(res.output)).not.toThrow();
  });

  it('keeps Unicode content intact in CSS and HTML', async () => {
    const css = await run('.a { content: "😀 漢字"; }', { language: 'css' });
    expect(css.output).toContain('😀 漢字');
    const html = await run('<p>😀 漢字 שלום</p>', { language: 'html' });
    expect(html.output).toContain('😀 漢字 שלום');
  });

  it('handles a large input', async () => {
    const parts: string[] = [];
    for (let i = 0; i < 2000; i++) {
      parts.push(`function helper${i}(value) { return value + ${i}; }`);
    }
    const source = parts.join('\n');
    const res = await run(source, { language: 'javascript' });
    expect(res.output.length).toBeLessThan(source.length);
    expect(res.stats?.['bytes saved']).toBeGreaterThan(0);
  });

  it('minifies HTML in a browser-like environment without a Node process', async () => {
    // `clean-css` (inside html-minifier-terser) reads `process.env` and
    // `process.nextTick`; the tool has to cope with a browser that has neither.
    const scope = globalThis as unknown as {
      process?: { platform?: string; env?: unknown; nextTick?: unknown };
    };
    const real = scope.process;
    scope.process = { platform: 'browser' };
    try {
      const res = await run(
        '<!doctype html>\n<html>\n  <body>\n    <p>Hi</p>\n  </body>\n</html>',
        {
          language: 'html',
        },
      );
      expect(res.output).toContain('<p>Hi</p>');
    } finally {
      scope.process = real;
    }
    // The stand-in is put back the way it was found.
    expect(scope.process).toBe(real);
  });
});

/* -------------------------------------------------------------------------- */
/*  Round trip — the minified output still parses                              */
/* -------------------------------------------------------------------------- */

describe('code-minify — round trip', () => {
  it('minified JavaScript can be parsed and beautified again', async () => {
    const source = 'const items = [1, 2, 3];\nconst total = items.reduce((a, b) => a + b, 0);\n';
    const minified = await run(source, { language: 'javascript' });
    const pretty = (await beautify.run({
      text: minified.output,
      options: { language: 'babel' },
    })) as Res;
    expect(pretty.output).toContain('const items = [1, 2, 3]');
    expect(pretty.output).toContain('reduce');
  });

  it('minified CSS can be parsed and beautified again', async () => {
    const source = '.card {\n  color: red;\n  padding: 4px;\n}\n';
    const minified = await run(source, { language: 'css' });
    const pretty = (await beautify.run({
      text: minified.output,
      options: { language: 'css' },
    })) as Res;
    expect(pretty.output).toContain('color: red;');
    expect(pretty.output).toContain('padding: 4px;');
  });

  it('minified HTML keeps every tag', async () => {
    const source = '<div class="a"><span>one</span><span>two</span></div>';
    const minified = await run(source, { language: 'html' });
    const tags = (html: string) => html.match(/<\/?[a-z]+/gi) ?? [];
    expect(tags(minified.output)).toEqual(tags(source));
  });

  it('minified JSON parses back to the same value', async () => {
    const value = { name: 'tesserae', tags: ['a', 'b'], nested: { n: 1 }, unicode: '😀' };
    const minified = await run(JSON.stringify(value, null, 2), { language: 'json' });
    expect(JSON.parse(minified.output)).toEqual(value);
  });
});

/* -------------------------------------------------------------------------- */
/*  Never hangs                                                               */
/* -------------------------------------------------------------------------- */

describe('code-minify — never hangs', () => {
  // Terser loops forever on a stray `type X` / `interface X` statement when
  // its TypeScript support is off, so every one of these has to come back.
  const NASTY = [
    'type A = number;',
    'interface A {}',
    'export type A = 1;',
    'export interface A {}',
    'import type A from "a";',
    'type',
    'interface',
    'type A =',
    'const x = ;',
    'function f( {',
    'let a b c;',
    'class {}',
    'const a = {b: };',
    '/* unterminated',
    'const s = "unterminated',
    'const x: = ;',
    'enum E { A, B }',
    'namespace N { export const x = 1; }',
    'const a = <div>hi</div>;',
  ];

  for (const text of NASTY) {
    it(`finishes on ${JSON.stringify(text)}`, async () => {
      for (const language of ['auto', 'javascript', 'typescript']) {
        const result = await Promise.resolve(tool.run({ text, options: { language } })).catch(
          (e: unknown) => e,
        );
        expect(result).toBeTruthy();
      }
    });
  }
});

/* -------------------------------------------------------------------------- */
/*  Lazy loading                                                              */
/* -------------------------------------------------------------------------- */

describe('code-minify — lazy loading', () => {
  it('announces that the minifier is loading', async () => {
    const onProgress = vi.fn();
    await tool.run({ text: 'const x = 1;', options: { language: 'javascript' }, onProgress });
    expect(onProgress).toHaveBeenCalledWith(0, 'Loading minifier…');
    expect(onProgress.mock.calls.map((call) => call[1])).toContain('Minifying…');
  });

  it('does not load anything for empty input', async () => {
    const onProgress = vi.fn();
    const res = (await tool.run({
      text: '',
      options: { language: 'javascript' },
      onProgress,
    })) as Res;
    expect(res.output).toBe('');
    expect(onProgress).not.toHaveBeenCalled();
  });
});
