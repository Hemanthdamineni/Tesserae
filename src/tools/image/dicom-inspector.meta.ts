import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'dicom-inspector',
  name: 'DICOM Inspector',
  category: 'image',
  summary:
    'Parse a medical DICOM .dcm on-device: the preamble, DICM prefix, every tag and VR, and key patient and imaging fields.',
  description:
    'Drop in a medical imaging file (a .dcm DICOM object) and inspect its structure exactly as a DICOM reader would. The tool checks the 128-byte preamble, verifies the DICM prefix, reads the meta information group (0002) in its mandatory Explicit VR little-endian encoding, and then walks the data set using the declared transfer syntax (Explicit VR little endian, implicit VR, or big endian). Every element is listed with its tag (group,element), value representation (VR), declared length and a readable value, and the tool highlights the important ones: the patient name (0010,0010), patient ID, modality (0008,0060), study and series UIDs, the transfer syntax UID (0002,0010), and the pixel data element (7FE0,0010) with its byte length. It flags the classic structural problems: a non-zero preamble, a missing or wrong DICM prefix, an unknown transfer syntax, a truncated element, a value that overruns the file, and a group length that does not match. Everything runs on-device.',
  keywords: [
    'dicom',
    'dcm',
    'medical imaging',
    'radiology',
    'preamble',
    'dicm',
    'pixel data',
    'patient',
    'modality',
    'transfer syntax',
    'value representation',
    'vr',
    'tag',
    'parser',
    'decoder',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.dcm,.dicom,application/dicom,application/octet-stream',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'elements',
      choices: [
        { value: 'elements', label: 'Element table' },
        { value: 'summary', label: 'Summary' },
        { value: 'meta', label: 'Meta group' },
      ],
    },
  ],
  examples: [
    { title: 'Inspect a DICOM file', options: {} },
    { title: 'Read the patient fields of a DICOM' },
    { title: 'List every data element and tag' },
  ],
  related: [
    'image-metadata',
    'tiff-inspector',
    'jpeg-inspector',
    'png-chunk-inspector',
    'bmp-inspector',
  ],
  status: 'stable',
};
