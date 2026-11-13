import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './curl-to-code.meta';
import { parseCommand } from './curl-to-code.core';
import { GENERATORS, LANGUAGES } from './curl-to-code.generators';

/* ==========================================================================
 * curl-to-code: parse a curl command into a small request model, then render
 * that model as equivalent code. Pure: only crypto-free string work plus
 * TextEncoder/btoa. The parsing/model lives in curl-to-code.core and the
 * per-language generators live in curl-to-code.generators; this file only
 * wires options, guards and result assembly.
 * ========================================================================== */

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
