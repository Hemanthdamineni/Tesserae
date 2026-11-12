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
  examples: [
    {
      title: 'A small HAR archive',
      input:
        '{\n  "log": {\n    "version": "1.2",\n    "creator": { "name": "browser", "version": "130.0" },\n    "pages": [{ "id": "p1", "title": "Example", "startedDateTime": "2026-11-08T12:00:00Z", "pageTimings": { "onContentLoad": 320, "onLoad": 700 } }],\n    "entries": [\n      {\n        "startedDateTime": "2026-11-08T12:00:01Z",\n        "time": 140,\n        "request": { "method": "GET", "url": "https://example.com/", "httpVersion": "HTTP/2", "headers": [], "queryString": [], "cookies": [], "headersSize": 120, "bodySize": 0 },\n        "response": { "status": 200, "statusText": "OK", "httpVersion": "HTTP/2", "headers": [], "cookies": [], "content": { "size": 1024, "mimeType": "text/html" }, "redirectURL": "", "headersSize": 200, "bodySize": 1024 },\n        "cache": {},\n        "timings": { "blocked": 5, "dns": 10, "connect": 25, "send": 1, "wait": 60, "receive": 39 },\n        "serverIPAddress": "93.184.216.34"\n      }\n    ]\n  }\n}',
    },
    {
      title: 'A failed request in the archive',
      input:
        '{\n  "log": {\n    "version": "1.2",\n    "creator": { "name": "browser", "version": "130.0" },\n    "pages": [],\n    "entries": [\n      {\n        "startedDateTime": "2026-11-08T12:00:01Z",\n        "time": 400,\n        "request": { "method": "GET", "url": "https://example.com/missing", "httpVersion": "HTTP/1.1", "headers": [], "queryString": [], "cookies": [], "headersSize": 90, "bodySize": 0 },\n        "response": { "status": 404, "statusText": "Not Found", "httpVersion": "HTTP/1.1", "headers": [], "cookies": [], "content": { "size": 40, "mimeType": "text/html" }, "redirectURL": "", "headersSize": 100, "bodySize": 40 },\n        "cache": {},\n        "timings": { "blocked": 5, "dns": 10, "connect": 25, "send": 1, "wait": 300, "receive": 59 },\n        "serverIPAddress": "93.184.216.34"\n      }\n    ]\n  }\n}',
    },
    {
      title: 'A HAR with a missing version',
      input:
        '{\n  "log": {\n    "creator": { "name": "browser", "version": "130.0" },\n    "pages": [],\n    "entries": []\n  }\n}',
    },
  ],
  related: ['http-request-builder', 'access-log-analyzer', 'http-header-analyzer'],
  status: 'stable',
};
