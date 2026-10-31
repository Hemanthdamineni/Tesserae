/**
 * Editorial content for the dicom-inspector tool page.
 *
 * Kept out of `dicom-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Drop in a medical imaging file (a .dcm DICOM object) and the tool inspects its structure exactly as a DICOM reader would. It checks the 128-byte preamble, verifies the DICM prefix, reads the meta information group (0002) in its mandatory Explicit VR little-endian encoding, then walks the data set using the declared transfer syntax — Explicit VR little endian, implicit VR, or big endian. Every element is listed with its tag (group,element), value representation (VR), declared length and a readable value.',
    },
    {
      heading: 'The fields that matter in practice',
      body: 'The tool highlights the tags a radiologist or developer reaches for most: the patient name (0010,0010), patient ID, modality (0008,0060), the study and series UIDs, the transfer syntax UID (0002,0010), and the pixel data element (7FE0,0010) with its byte length. Scanning these values tells you which study a file belongs to, which modality produced it, and how the image pixels are encoded.',
    },
    {
      heading: 'Tags, VRs and transfer syntax',
      body: 'Every data element is addressed by a (group,element) tag and typed by a value representation such as PN (person name), LO (long string), UI (UID) or OB (other byte string). Which VR layout the file actually uses is decided by its transfer syntax: explicit VR stores the two-letter code in the file, implicit VR omits itaine and relies on the dictionary, and big endian flips the byte order. Misreading any of these makes every later element come out wrong, which is why the tool reports the transfer syntax up front.',
    },
    {
      heading: 'On-device and offline',
      body: 'Parsing runs entirely in this tab — the preamble, meta group and data set are read locally, and nothing is uploaded. You can inspect a .dcm with the network off.',
    },
  ],
  faq: [
    {
      q: 'What is the 128-byte preamble?',
      a: 'It is a leading region of the DICOM file that is normally all zero bytes and is ignored for reading the data. It exists so the file can also be used as a bitmap image for applications that expect an image header there. The tool verifies it as part of confirming the file layout.',
    },
    {
      q: 'What does the transfer syntax control?',
      a: 'The transfer syntax UID in the meta group (0002,0010) declares how the rest of the data set is encoded: whether value representations are explicit or implicit and whether the byte order is little or big endian. The tool reads this value and then walks the data set accordingly, so elements are decoded the way the file says it was written.',
    },
    {
      q: 'Can it see the actual image?',
      a: 'It reports the pixel data element (7FE0,0010) and its byte length rather than rendering the image. That tells you how large the pixel payload is and where it sits, which is what most structural debugging needs; rendering would require decoding the compressed pixel stream as well.',
    },
    {
      q: 'Is my medical file sent anywhere?',
      a: 'No. The preamble, meta group and data elements are parsed on-device with no upload, so a DICOM file can be inspected offline.',
    },
  ],
} as const;
