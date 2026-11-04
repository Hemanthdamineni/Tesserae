import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './xml-format.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as {
    output: string;
    warnings?: string[];
    stats?: Record<string, string | number>;
  };

describe('xml-format', async () => {
  it('pretty-prints with 2-space indent by default', async () => {
    expect((await run('<root><child>text</child><child/></root>')).output).toBe(
      ['<root>', '  <child>text</child>', '  <child/>', '</root>'].join('\n'),
    );
  });

  it('pretty-prints with 4-space indent', async () => {
    expect((await run('<a><b>x</b></a>', { indent: '4' })).output).toBe(
      ['<a>', '    <b>x</b>', '</a>'].join('\n'),
    );
  });

  it('pretty-prints with tab indent', async () => {
    expect((await run('<a><b>x</b></a>', { indent: 'tab' })).output).toBe(
      ['<a>', '\t<b>x</b>', '</a>'].join('\n'),
    );
  });

  it('keeps comments and CDATA intact when pretty-printing', async () => {
    expect(
      (await run('<a><!-- note --><![CDATA[x < y]]></a>', { operation: 'pretty', indent: '4' }))
        .output,
    ).toBe(['<a>', '    <!-- note -->', '    <![CDATA[x < y]]>', '</a>'].join('\n'));
  });

  it('minifies by stripping inter-tag whitespace', async () => {
    expect(
      (await run('<root>\n  <child>text</child>\n</root>', { operation: 'minify' })).output,
    ).toBe('<root><child>text</child></root>');
  });

  it('keeps processing instructions and CDATA when minifying', async () => {
    expect(
      (
        await run('<?xml version="1.0"?>\n<a>\n  <!-- c -->\n  <![CDATA[d]]>\n</a>', {
          operation: 'minify',
        })
      ).output,
    ).toBe('<?xml version="1.0"?><a><!-- c --><![CDATA[d]]></a>');
  });

  it('preserves a doctype declaration', async () => {
    expect((await run('<!DOCTYPE html>\n<html></html>', { operation: 'minify' })).output).toBe(
      '<!DOCTYPE html><html></html>',
    );
  });

  it('warns on an unbalanced closing tag but still emits output', async () => {
    const r = await run('<a><b></a>');
    expect(r.output).toBe(['<a>', '  <b>', '</a>'].join('\n'));
    expect(r.warnings).toEqual(['Unbalanced tag: unexpected </a>.']);
  });

  it('warns on an unclosed tag', async () => {
    expect((await run('<a><b>hi</b>')).warnings).toEqual(['Unclosed tag: <a>.']);
  });

  it('has no warnings for balanced markup', async () => {
    expect((await run('<a><b>x</b></a>')).warnings).toBeUndefined();
  });

  it('throws ToolError on a stray "<" inside a tag', async () => {
    await expect(run('<a<')).rejects.toThrow(ToolError);
  });

  it('throws ToolError on an unterminated comment', async () => {
    await expect(run('<a><!-- oops</a>')).rejects.toThrow(ToolError);
  });

  it('empty input returns empty output', async () => {
    expect((await run('   ')).output).toBe('');
  });

  it('reports character-count stats', async () => {
    const r = await run('<a>x</a>');
    expect(r.stats?.['output chars']).toBe(r.output.length);
    expect(r.stats?.['input chars']).toBe(8);
  });
});
