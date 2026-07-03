import { inflate } from 'pako';

export interface PdfExtractResult {
  text: string;
  pageCount: number;
  isPasswordProtected: boolean;
}

export class PdfPasswordError extends Error {
  constructor() {
    super('PDF is password-protected. Please provide the password to decrypt.');
    this.name = 'PdfPasswordError';
  }
}

export class PdfCompressionError extends Error {
  constructor(filter: string) {
    super(`PDF stream uses unsupported compression filter: ${filter}. Only /FlateDecode is supported.`);
    this.name = 'PdfCompressionError';
  }
}

export async function extractTextFromPdf(
  data: ArrayBuffer,
  _password?: string
): Promise<PdfExtractResult> {
  const bytes = new Uint8Array(data);
  const raw = uint8ArrayToString(bytes);

  // Detect password protection
  if (raw.includes('/Encrypt')) {
    throw new PdfPasswordError();
  }

  const pageCount = countPages(raw);
  const textParts: string[] = [];

  // Extract all stream contents
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(raw)) !== null) {
    const streamStart = match.index;
    const filter = getStreamFilter(raw, streamStart);

    if (!filter) {
      // No compression — try to read as text
      const content = match[1];
      const text = extractTextFromStream(content);
      if (text) textParts.push(text);
      continue;
    }

    if (filter !== '/FlateDecode' && filter !== 'FlateDecode') {
      // Skip non-text streams (images, fonts) that have other filters
      if (filter.includes('DCT') || filter.includes('JBIG') || filter.includes('CCITTFax')) {
        continue;
      }
      throw new PdfCompressionError(filter);
    }

    try {
      const streamBytes = stringToUint8Array(match[1]);
      const rawResult = inflate(streamBytes);
      const decompressed = new TextDecoder('latin1').decode(rawResult);
      const text = extractTextFromStream(decompressed);
      if (text) textParts.push(text);
    } catch {
      // Skip streams that can't be decompressed (e.g., binary image data marked as FlateDecode)
      continue;
    }
  }

  return {
    text: textParts.join('\n'),
    pageCount,
    isPasswordProtected: false,
  };
}

function countPages(raw: string): number {
  const match = raw.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function getStreamFilter(raw: string, streamStart: number): string | null {
  const lookback = raw.slice(Math.max(0, streamStart - 500), streamStart);
  const filterMatch = lookback.match(/\/Filter\s*([/\w]+)/);
  return filterMatch ? filterMatch[1] : null;
}

function extractTextFromStream(content: string): string {
  const parts: string[] = [];

  // PDF text operators: BT...ET blocks contain text
  const btRegex = /BT([\s\S]*?)ET/g;
  let match: RegExpExecArray | null;

  while ((match = btRegex.exec(content)) !== null) {
    const block = match[1];
    // Tj and TJ operators contain actual text
    // (text) Tj
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tj: RegExpExecArray | null;
    while ((tj = tjRegex.exec(block)) !== null) {
      const decoded = decodePdfString(tj[1]);
      if (decoded.trim()) parts.push(decoded);
    }
    // [(text) ...] TJ
    const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
    let tja: RegExpExecArray | null;
    while ((tja = tjArrayRegex.exec(block)) !== null) {
      const inner = tja[1];
      const subParts: string[] = [];
      const subRegex = /\(([^)]*)\)/g;
      let sub: RegExpExecArray | null;
      while ((sub = subRegex.exec(inner)) !== null) {
        const decoded = decodePdfString(sub[1]);
        if (decoded) subParts.push(decoded);
      }
      if (subParts.length) parts.push(subParts.join(''));
    }
  }

  // Handle Td/TD operators for line breaks (approximate)
  return parts.join(' ');
}

function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

function uint8ArrayToString(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return str;
}

function stringToUint8Array(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}
