// Pure magic-byte sniffer: never trust a client-declared Content-Type/File.type
// alone — check the actual leading bytes so an HTML/script upload disguised
// with a spoofed "image/png" type can't slip through as an image.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, i) => bytes[i] === byte);
}

export function sniffImageType(bytes: Uint8Array): 'png' | 'jpg' | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return 'png';
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'jpg';
  return null;
}
