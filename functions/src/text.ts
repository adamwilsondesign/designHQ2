import mammoth from 'mammoth';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { HttpsError } from 'firebase-functions/v2/https';
import { bucket } from './admin.js';

// Plain text from an uploaded transcript or document (PDF, DOCX or TXT).
export async function extractText(buffer: Buffer, fileName: string): Promise<string> {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'txt' || ext === 'md' || ext === 'vtt' || ext === 'srt') return buffer.toString('utf8');
  if (ext === 'docx') return (await mammoth.extractRawText({ buffer })).value;
  if (ext === 'pdf') return (await pdfParse(buffer)).text;
  throw new HttpsError('invalid-argument', `Unsupported file type ".${ext}". Use PDF, DOCX or TXT.`);
}

export async function downloadFile(path: string): Promise<Buffer> {
  const [buf] = await bucket().file(path).download();
  return buf;
}

export async function extractTextFromStorage(path: string): Promise<string> {
  return extractText(await downloadFile(path), path);
}
