import { describe, it, expect, vi } from 'vitest';
import tool from './code-beautify.tool';
import { ToolError } from '@/lib/types';

type Res = {
  output: string;
  render?: string;
  language?: string;
  filename?: string;
  stats?: Record<string, string | number>;
};

const run = async (
  text: string,
  options: Record<string, string | number | boolean> = {},
): Promise<Res> => (await tool.run({ text, options })) as Res;

/* -------------------------------------------------------------------------- */
/*  Every language formats a small known input exactly                        */
/* -------------------------------------------------------------------------- */

describe('code-beautify — one happy path per language', () => {
  it('JavaScript / JSX (babel)', async () => {
    const res = await run('const x={a:1,b:2}', { language: 'babel' });
    expect(res.output).toBe('const x = { a: 1, b: 2 };\n');
    expect(res.language).toBe('javascript');
  });

  it('TypeScript', async () => {
    const res = await run('interface U{id:number;name:string}\nconst u:U={id:1,name:"Ada"}', {
      language: 'typescript',
    });
    expect(res.output).toBe(
      'interface U {\n  id: number;\n  name: string;\n}\nconst u: U = { id: 1, name: "Ada" };\n',
    );
    expect(res.language).toBe('typescript');
  });

  it('CSS', async () => {
    const res = await run('a{color:red;margin:0 1px}', { language: 'css' });
    expect(res.output).toBe('a {\n  color: red;\n  margin: 0 1px;\n}\n');
    expect(res.language).toBe('css');
  });

  it('SCSS', async () => {
    const res = await run('$c:red;\na{color:$c;.b{margin:0}}', { language: 'scss' });
    expect(res.output).toBe('$c: red;\na {\n  color: $c;\n  .b {\n    margin: 0;\n  }\n}\n');
    expect(res.language).toBe('scss');
  });

  it('Less', async () => {
    const res = await run('@c:red;\na{color:@c;.b{margin:0}}', { language: 'less' });
    expect(res.output).toBe('@c: red;\na {\n  color: @c;\n  .b {\n    margin: 0;\n  }\n}\n');
    expect(res.language).toBe('less');
  });

  it('JSON', async () => {
    const res = await run('{"b":2,"a":[1,2,3]}', { language: 'json' });
    expect(res.output).toBe('{ "b": 2, "a": [1, 2, 3] }\n');
    expect(res.language).toBe('json');
  });

  it('HTML', async () => {
    const res = await run('<div><p>hi</p></div>', { language: 'html' });
    expect(res.output).toBe('<div><p>hi</p></div>\n');
    expect(res.language).toBe('html');
  });

  it('Vue single-file component', async () => {
    const input =
      '<template><div :class="cls">{{ msg }}</div></template>\n' +
      '<script>\nexport default { data(){return {msg:"hi"}} }\n</script>';
    const res = await run(input, { language: 'vue' });
    expect(res.output).toBe(
      '<template>\n  <div :class="cls">{{ msg }}</div>\n</template>\n' +
        '<script>\nexport default {\n  data() {\n    return { msg: "hi" };\n  },\n};\n</script>\n',
    );
    expect(res.language).toBe('vue');
  });

  it('Markdown', async () => {
    const res = await run('# Title\n\nSome    spaced    text', { language: 'markdown' });
    expect(res.output).toBe('# Title\n\nSome spaced text\n');
    expect(res.language).toBe('markdown');
  });

  it('YAML', async () => {
    const res = await run('name: tesserae\nitems:\n - one\n - two', { language: 'yaml' });
    expect(res.output).toBe('name: tesserae\nitems:\n  - one\n  - two\n');
    expect(res.language).toBe('yaml');
  });
});

/* -------------------------------------------------------------------------- */
/*  Options                                                                   */
/* -------------------------------------------------------------------------- */

describe('code-beautify — options', () => {
  const longArray = 'const nums=[1,2,3,4,5,6,7,8,9,10];';

  it('printWidth 80 keeps the array on one line', async () => {
    const res = await run(longArray, { language: 'babel', printWidth: 80 });
    expect(res.output).toBe('const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];\n');
  });

  it('printWidth 20 wraps the array', async () => {
    const res = await run(longArray, { language: 'babel', printWidth: 20 });
    expect(res.output).toBe('const nums = [\n  1, 2, 3, 4, 5, 6,\n  7, 8, 9, 10,\n];\n');
  });

  it('printWidth below the minimum is clamped instead of crashing', async () => {
    const res = await run(longArray, { language: 'babel', printWidth: 5 });
    expect(res.output).toBe('const nums = [\n  1, 2, 3, 4, 5, 6,\n  7, 8, 9, 10,\n];\n');
  });

  it('a non-numeric printWidth falls back to the default', async () => {
    const res = await run(longArray, { language: 'babel', printWidth: 'wide' });
    expect(res.output).toBe('const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];\n');
  });

  it('tabWidth changes the indent', async () => {
    const res = await run('a{color:red}', { language: 'css', tabWidth: 4 });
    expect(res.output).toBe('a {\n    color: red;\n}\n');
  });

  it('semi: false omits statement semicolons', async () => {
    const res = await run('const x=1; const y=2;', { language: 'babel', semi: false });
    expect(res.output).toBe('const x = 1\nconst y = 2\n');
  });

  it('semi: true keeps statement semicolons', async () => {
    const res = await run('const x=1', { language: 'babel', semi: true });
    expect(res.output).toBe('const x = 1;\n');
  });

  it('singleQuote: true prefers single quotes', async () => {
    const res = await run('const s="hi";', { language: 'babel', singleQuote: true });
    expect(res.output).toBe("const s = 'hi';\n");
  });

  it('singleQuote: false keeps double quotes', async () => {
    const res = await run("const s='hi';", { language: 'babel', singleQuote: false });
    expect(res.output).toBe('const s = "hi";\n');
  });

  it('trailingComma: all adds a trailing comma after the last argument', async () => {
    const res = await run('call(first,second,third);', {
      language: 'babel',
      printWidth: 24,
      trailingComma: 'all',
    });
    expect(res.output).toBe('call(\n  first,\n  second,\n  third,\n);\n');
  });

  it('trailingComma: es5 omits it after the last function argument', async () => {
    const res = await run('call(first,second,third);', {
      language: 'babel',
      printWidth: 24,
      trailingComma: 'es5',
    });
    expect(res.output).toBe('call(\n  first,\n  second,\n  third\n);\n');
  });

  it('trailingComma: none never adds one', async () => {
    const res = await run('call(first,second,third);', {
      language: 'babel',
      printWidth: 24,
      trailingComma: 'none',
    });
    expect(res.output).toBe('call(\n  first,\n  second,\n  third\n);\n');
  });

  it('accepts formatting options omitted entirely (defaults apply)', async () => {
    const res = await run('const x={a:1}');
    expect(res.output).toBe('const x = { a: 1 };\n');
  });
});

/* -------------------------------------------------------------------------- */
/*  Auto-detect                                                               */
/* -------------------------------------------------------------------------- */

describe('code-beautify — auto-detect', () => {
  it('detects JSON', async () => {
    const res = await run('{"a":1}', { language: 'auto' });
    expect(res.language).toBe('json');
    expect(res.output).toBe('{ "a": 1 }\n');
  });

  it('detects JavaScript', async () => {
    const res = await run('const x=1', { language: 'auto' });
    expect(res.language).toBe('javascript');
    expect(res.output).toBe('const x = 1;\n');
  });

  it('detects TypeScript from type annotations', async () => {
    const res = await run('interface A{x:number}', { language: 'auto' });
    expect(res.language).toBe('typescript');
    expect(res.output).toBe('interface A {\n  x: number;\n}\n');
  });

  it('detects CSS', async () => {
    const res = await run('a{color:red}', { language: 'auto' });
    expect(res.language).toBe('css');
  });

  it('detects SCSS from a variable', async () => {
    const res = await run('$c: red;\na{color:$c}', { language: 'auto' });
    expect(res.language).toBe('scss');
  });

  it('detects Less from a variable', async () => {
    const res = await run('@c: red;\na{color:@c}', { language: 'auto' });
    expect(res.language).toBe('less');
  });

  it('detects HTML', async () => {
    const res = await run('<!doctype html><html><body><p>hi</p></body></html>');
    expect(res.language).toBe('html');
  });

  it('detects Vue single-file components', async () => {
    const res = await run(
      '<template><div>{{ msg }}</div></template>\n<script>export default { msg: "hi" }</script>',
    );
    expect(res.language).toBe('vue');
  });

  it('detects Markdown from a heading', async () => {
    const res = await run('# Hi\n\n- one\n- two');
    expect(res.language).toBe('markdown');
  });

  it('detects YAML from key/value lines', async () => {
    const res = await run('name: bench\nage: 3');
    expect(res.language).toBe('yaml');
  });

  it('falls back to auto-detect when the language value is unknown', async () => {
    const res = await run('{"a":1}', { language: 'not-a-language' });
    expect(res.language).toBe('json');
  });

  it('throws a ToolError when it cannot tell what the input is', async () => {
    await expect(run('~~~ nowhere ~~~')).rejects.toBeInstanceOf(ToolError);
  });
});

/* -------------------------------------------------------------------------- */
/*  Errors and empty input                                                    */
/* -------------------------------------------------------------------------- */

describe('code-beautify — errors and edges', () => {
  it('reports Prettier’s message and a hint for malformed JavaScript', async () => {
    const error = await run('const x = ;', { language: 'babel' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ToolError);
    const toolError = error as ToolError;
    expect(toolError.message).toMatch(/Unexpected token/);
    expect(toolError.message).not.toContain('\n');
    expect(toolError.hint).toBeTruthy();
  });

  it('reports malformed TypeScript', async () => {
    await expect(run('function f(: number) {}', { language: 'typescript' })).rejects.toThrow(
      /Parameter declaration expected/,
    );
  });

  it('reports malformed JSON', async () => {
    await expect(run('{"a": }', { language: 'json' })).rejects.toThrow(/Unexpected token/);
  });

  it('reports an unclosed CSS block', async () => {
    await expect(run('a { color: red;', { language: 'css' })).rejects.toThrow(/Unclosed block/);
  });

  it('reports malformed YAML', async () => {
    await expect(run('a: [1, 2', { language: 'yaml' })).rejects.toThrow(/Flow sequence/);
  });

  it('reports mismatched HTML tags', async () => {
    await expect(run('<div><span></div>', { language: 'html' })).rejects.toThrow(
      /Unexpected closing tag/,
    );
  });

  it('empty input returns empty output with no error', async () => {
    const res = await run('', { language: 'babel' });
    expect(res.output).toBe('');
  });

  it('whitespace-only input returns empty output', async () => {
    const res = await run('  \n\t  ', { language: 'auto' });
    expect(res.output).toBe('');
  });

  it('preserves Unicode content', async () => {
    const res = await run('const s="héllo 😀 — ok";', { language: 'babel' });
    expect(res.output).toBe('const s = "héllo 😀 — ok";\n');
  });

  it('reports render, filename and stats', async () => {
    const res = await run('const x=1', { language: 'babel' });
    expect(res.render).toBe('code');
    expect(res.filename).toBe('formatted.js');
    expect(res.stats).toMatchObject({ language: 'javascript', lines: 1 });
    expect(res.stats?.characters).toBe(res.output.length);
  });
});

/* -------------------------------------------------------------------------- */
/*  Lazy loading                                                              */
/* -------------------------------------------------------------------------- */

describe('code-beautify — lazy loading', () => {
  it('announces that the formatter is loading before formatting', async () => {
    const onProgress = vi.fn();
    await tool.run({ text: 'const x=1', options: { language: 'babel' }, onProgress });
    expect(onProgress).toHaveBeenCalledWith(0, 'Loading formatter…');
    expect(onProgress.mock.calls.map((call) => call[1])).toContain('Formatting…');
  });

  it('does not attempt to load anything for empty input', async () => {
    const onProgress = vi.fn();
    const res = (await tool.run({ text: '', options: { language: 'babel' }, onProgress })) as Res;
    expect(res.output).toBe('');
    expect(onProgress).not.toHaveBeenCalled();
  });
});
