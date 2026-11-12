import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'codeowners-validator',
  name: 'CODEOWNERS Validator',
  category: 'developer',
  summary:
    'Validate a CODEOWNERS file on-device: patterns, owner syntax, comments and trailing rules.',
  description:
    'Paste a CODEOWNERS file and check it without uploading it. The tool parses each rule into a pattern and its owners, then validates the pattern and the owner syntax: each owner must be a GitHub user, a team, or an email, a comment line is ignored, and a rule with no owner is flagged, as is a pattern that is not valid in CODEOWNERS. Because the last matching rule takes precedence, the tool lists the rules in order and reports how many would actually apply to the same path, so you can see which owners would win.',
  keywords: [
    'codeowners',
    'code owners',
    'github',
    'repository',
    'owner',
    'pattern',
    'branch protection',
    'validate',
    'developer',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  acceptsText: true,
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'rules', label: 'Rules' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [
    {
      title: 'A basic CODEOWNERS file',
      input: '# Owners for the project\n* @octocat\n\n/docs/ @docs-team\n/src/ @core-devs @octocat',
    },
    {
      title: 'A pattern with no owner',
      input: '# trailing spaces are significant\n*       @octocat\n\n/assets/\n/lib/ @platform',
    },
    {
      title: 'A file using team owners',
      input: '* @acme/web\n/scripts/ @acme/ops\n/config/*.yml @acme/platform-eng',
    },
  ],
  related: ['gitignore', 'editorconfig', 'dockerfile-generator', 'conventional-commit'],
  status: 'stable',
};
