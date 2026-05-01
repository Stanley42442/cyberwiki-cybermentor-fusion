// src/lib/extract-document-text.ts
// Browser-side text extraction — fully self-hosted, no CDN calls.
//
// PDF  — pdfjs-dist (npm). Worker served from the same Vercel deployment
//         via Vite's ?url import, so no CDN and no CSP issues.
// DOCX — mammoth (npm). Bundled by Vite, no runtime script loading.

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';

// Serve the worker from the same origin — avoids unpkg/CDN CSP blocks
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_CHARS = 8000;

/**
 * Extract plain text from a PDF or DOCX File object.
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
  const maxPages = Math.min(totalPages, 20);
  const parts: string[] = [];

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = (content.items as Array<{ str: string }>)
      .map(item => item.str)
      .join(' ')
      .replace(/\s{3,}/g, '\n\n')
      .trim();
    if (text) parts.push(text);
    if (parts.join('\n\n').length >= MAX_CHARS) break;
  }

  const result = parts.join('\n\n').slice(0, MAX_CHARS);
  const note = totalPages > maxPages
    ? `\n\n[Extracted from first ${maxPages} of ${totalPages} pages]`
    : '';
  return (result + note).trim();
}

// ── DOCX ──────────────────────────────────────────────────────────────────────
async function extractDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CHARS);
}
