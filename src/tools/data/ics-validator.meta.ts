import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'ics-validator',
  name: 'iCalendar (ICS) Validator',
  category: 'data',
  summary:
    'Validate an iCalendar (.ics) file on-device: components, date-times, required properties and structural issues.',
  description:
    'Paste or drop an iCalendar (.ics) file from any calendar app and check it without uploading it. The validator parses the RFC 5545 content lines (ignoring line-folding), counts the VCALENDAR, VEVENT, VTODO and VALARM components, and reports structural problems: a missing VCALENDAR or VERSION, a BEGIN without a matching END, an empty or duplicated UID, a required property missing on a component (DTSTAMP and SUMMARY on events), and a DTSTART or DTEND value that is not a valid date-time. The summary view shows the component and property counts, the components view lists each one with its kind and key properties, and the issues view explains every problem so a broken calendar export can be fixed before it is imported.',
  keywords: [
    'ics',
    'icalendar',
    'calendar',
    'event',
    'vevent',
    'vtodo',
    'valarm',
    'validate',
    'rfc5545',
    'date',
    'inspector',
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
        { value: 'components', label: 'Component list' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [
    {
      title: 'A single VEVENT',
      input:
        'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Example//EN\nBEGIN:VEVENT\nUID:event-001@example.com\nDTSTAMP:20261101T120000Z\nDTSTART:20261201T090000Z\nDTEND:20261201T100000Z\nSUMMARY:Planning call\nEND:VEVENT\nEND:VCALENDAR',
    },
    {
      title: 'A VEVENT with no DTSTART',
      input:
        'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Example//EN\nBEGIN:VEVENT\nUID:event-002@example.com\nDTSTAMP:20261101T120000Z\nSUMMARY:Missing start\nEND:VEVENT\nEND:VCALENDAR',
    },
    {
      title: 'An unbalanced VCALENDAR',
      input:
        'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Example//EN\nBEGIN:VEVENT\nUID:event-003@example.com\nDTSTAMP:20261101T120000Z\nDTSTART:20261201T090000Z\nSUMMARY:Unclosed block\nEND:VCALENDAR',
    },
  ],
  related: ['csv-to-ics', 'recurrence-dates', 'rrule-builder', 'json-schema-check'],
  status: 'stable',
};
