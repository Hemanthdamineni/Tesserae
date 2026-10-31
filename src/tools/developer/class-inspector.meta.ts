import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'class-inspector',
  name: 'Java Class Inspector',
  category: 'developer',
  summary:
    'Inspect a Java class file: magic, version, constant pool, access flags, fields, and methods.',
  description:
    'Drop in a compiled Java class file (.class) and inspect its JVM structure. The tool validates the CAFEBABE magic and reads the minor and major version numbers, then walks the constant pool reporting every entry with its tag and decoded value (UTF8 text, class and string references, and field, method, and name-and-type descriptors). It decodes the class access flags into modifiers such as public, final, abstract, and interface, and reports the this-class and super-class indices, the interface count, the field count, and the method count. It flags a bad magic, an unsupported version, a constant-pool entry that overruns the file, and a truncated tail. Everything runs on-device.',
  keywords: [
    'java',
    'jvm',
    'class',
    'bytecode',
    'constant pool',
    'method',
    'field',
    'magic',
    'cafebabe',
    'access flags',
    'inspect',
    'structure',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.class,application/x-java-applet,application/java-vm,application/octet-stream',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'constant-pool',
      choices: [
        { value: 'constant-pool', label: 'Constant pool' },
        { value: 'summary', label: 'Summary' },
        { value: 'findings', label: 'Findings' },
      ],
    },
  ],
  examples: [{ title: 'Inspect a Java class file', options: {} }],
  related: ['file-signature', 'wasm-inspector', 'elf-binary-inspector', 'pcap-inspector'],
  status: 'stable',
};
