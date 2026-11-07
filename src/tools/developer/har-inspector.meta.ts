import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'har-inspector',
  name: 'HAR File Inspector',
  category: 'developer',
  summary: 'Inspect a HAR HTTP archive on-device: entries, methods, statuses, timings and sizes.',
  description:
    'Paste a HAR file exported from your browser DevTools Network panel and inspect it without uploading it. The tool reads the log version and creator, counts the entries, and reports the request methods, the status classes, the total page time, the transferred body sizes and the slowest request. It flags a malformed archive, a missing or unexpected version, an entry without a URL or status, and every failed request, so a capture can be reviewed or shared without the raw JSON getting in the way. The summary view gives the counts, the requests view lists every entry, and the issues view lists structural problems.',
  keywords: [
    'har',
    'http archive',
    'devtools',
    'network',
    'requests',
    'timings',
    'status',
    'performance',
    'inspector',
    'web',
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
        { value: 'requests', label: 'Requests' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a HAR file' }],
  related: [
    'http-request-builder',
    'access-log-analyzer',
    'http-header-analyzer',
    'network-error-logging',
  ],
  status: 'stable',
};
