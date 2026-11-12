import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'pgpass-inspector',
  name: 'Pgpass Inspector',
  category: 'data',
  summary: 'Inspect a .pgpass file on-device: host, port, database, username and password fields.',
  description:
    'Paste a .pgpass PostgreSQL password file and inspect it without uploading it. The tool reads each line as the five colon-separated fields hostname, port, database, username and password, and reports the matching host, port and database for every entry. It flags a line that does not have exactly five fields, an empty field, and a malformed line, so a broken or incomplete pgpass entry can be found before psql silently skips it. The password value is never printed, only that an entry exists. The summary view gives the counts, the entries view lists every line, and the issues view lists structural problems.',
  keywords: [
    'pgpass',
    'postgres',
    'password',
    'database',
    'hostname',
    'port',
    'username',
    'psql',
    'inspector',
    'config',
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
        { value: 'entries', label: 'Entries' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [
    {
      title: 'A wildcard host and two real hosts',
      input:
        '*:*:*:postgres:supersecret\nlocalhost:5432:appdb:appuser:apppass\ndb.example.com:5432:*:replicator:rep-pass',
    },
    {
      title: 'A line with the wrong number of fields',
      input: 'localhost:5432:appdb:appuser\nlocalhost:5432:appdb:appuser:apppass:extra',
    },
    {
      title: 'A commented file with one entry',
      input: '# personal development db\nlocalhost:5432:devdb:dev:dev-pass',
    },
  ],
  related: ['dotenv', 'netrc-inspector', 'ssh-key-fingerprint', 'properties-convert'],
  status: 'stable',
};
