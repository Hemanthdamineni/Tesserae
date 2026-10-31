/**
 * Editorial content for the class-inspector tool page.
 *
 * Kept out of `class-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it reads',
      body: 'Drop a compiled Java class file (.class) onto the inspector and it reads the JVM structure directly. It validates the CAFEBABE magic and the minor and major version numbers, then walks the constant pool reporting every entry with its tag and decoded value — UTF8 text, class and string references, and field, method and name-and-type descriptors. It decodes the class access flags into modifiers such as public, final, abstract and interface, and reports the this-class and super-class indices, the interface count, the field count and the method count.',
    },
    {
      heading: 'Why the constant pool matters',
      body: 'The constant pool is the table every other part of a class file indexes into, and it is where the meaningful text of a class lives: string literals, class names and the descriptors that describe fields and methods. Seeing the pool decoded — rather than as raw offsets — is what turns an opaque binary into something you can read, which is why the inspector defaults to the constant-pool view and decodes each entry inline.',
    },
    {
      heading: 'Reading the access flags',
      body: 'Access flags are the modifier bits stored on the class itself. The inspector decodes them into the keywords you already know — public, final, abstract, interface — so you can tell at a glance how a class is declared without reaching for javap. The same header fields also give the this-class and super-class indices into the pool, plus how many interfaces, fields and methods follow.',
    },
    {
      heading: 'On-device parsing',
      body: 'Everything is computed in this tab from the bytes you drop in. Nothing is uploaded, and the tool runs fully offline, so a proprietary or unpublished .class file is never sent anywhere. Files up to 64 MB are accepted.',
    },
  ],
  faq: [
    {
      q: 'Is my class file uploaded anywhere?',
      a: 'No. The inspector parses the .class file entirely on-device in your browser, works fully offline, and transmits nothing. Files up to 64 MB are accepted.',
    },
    {
      q: 'What is the CAFEBABE magic?',
      a: 'CAFEBABE is the four-byte 0xCAFEBABE magic that every valid Java class file begins with. The inspector validates it and reports whether it is present, then reads the version and the structure that follows.',
    },
    {
      q: 'What does the constant-pool view show?',
      a: 'Every constant-pool entry is listed with its numeric tag and decoded value — UTF8 text, class and string references, and field, method and name-and-type descriptors — so you can read what the bytecode references without chasing offsets.',
    },
    {
      q: 'What structural problems does it flag?',
      a: 'It flags a bad magic, an unsupported version, a constant-pool entry that overruns the end of the file, and a trailing partial structure after the pool, so a malformed or hand-edited class is easy to spot.',
    },
  ],
} as const;
