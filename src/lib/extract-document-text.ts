// src/lib/extract-document-text.ts
// Browser-side text extraction — fully self-hosted, no CDN calls.
//
// Extracts the FULL document text with no character cap.
// The edge function handles chunking — the client's job is just to
// get every word out of the file and send it as the contribution content.
//
// PDF  — pdfjs-dist (npm). Worker served from same Vercel deployment.
// DOCX — mammoth (npm). Bundled by Vite.

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Safety cap — 500,000 chars (~100,000 words, ~200 pages of dense text).
// Virtually no student contribution will hit this. It only exists to prevent
// the browser tab from running out of memory on a truly enormous file.
const SAFETY_CAP = 500_000;

/**
 * Extract the full plain text from a PDF or DOCX File object.
 * Returns null on failure — caller falls back to the user-typed summary.
 */
export async function extractTextFromFile(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  try {
    if (ext === 'pdf') return await extractPdf(file);
    if (ext === 'docx' || ext === 'doc') return await extractDocx(file);
    return null;
  } catch (e) {
    console.warn('[extract-document-text] extraction failed:', e);
    return null;
  }
}

// ── PDF ───────────────────────────────────────────────────────────────────────
async function extractPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  const totalPages = pdf.numPages;
  const parts: string[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = (content.items as Array<{ str: string }>)
      .map(item => item.str)
      .join(' ')
      .replace(/\s{3,}/g, '\n\n')
      .trim();
    if (text) parts.push(text);

    // Stop only if we hit the safety cap
    if (parts.join('\n\n').length >= SAFETY_CAP) {
      parts.push(`\n[Safety cap reached — extracted ${i} of ${totalPages} pages]`);
      break;
    }
  }

  return parts.join('\n\n').trim();
}

// ── DOCX ──────────────────────────────────────────────────────────────────────
async function extractDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value.replace(/\n{3,}/g, '\n\n').trim();
  return text.length > SAFETY_CAP ? text.slice(0, SAFETY_CAP) + '\n[Safety cap reached]' : text;
}
