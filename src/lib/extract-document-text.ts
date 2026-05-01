// src/lib/extract-document-text.ts
// Browser-side text extraction for PDF and DOCX files.
//
// PDF  — uses pdfjs-dist (npm package, bundled by Vite).
//         Worker is pointed at the matching version on unpkg CDN to avoid
//         Vite worker-bundling complexity.
// DOCX — uses mammoth loaded from CDN (small, no bundling issues).

import * as pdfjsLib from 'pdfjs-dist';

// Point the PDF.js worker at the exact same version we installed via npm.
// This avoids the Vite worker-bundle problem while keeping the main lib local.
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const MAX_CHARS = 8000;

/**
 * Extract plain text from a PDF or DOCX File object.
 * Returns null if extraction fails — caller should fall back to user summary.
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

// ── PDF via pdfjs-dist (npm) ──────────────────────────────────────────────────
async function extractPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  const totalPages = pdf.numPages;
  const maxPages = Math.min(totalPages, 20);
  const pageTexts: string[] = [];

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = (textContent.items as Array<{ str: string }>)
      .map(item => item.str)
      .join(' ')
      .replace(/\s{3,}/g, '\n\n')
      .trim();

    if (pageText) pageTexts.push(pageText);
    if (pageTexts.join('\n\n').length >= MAX_CHARS) break;
  }

  const full = pageTexts.join('\n\n');
  const truncated = full.slice(0, MAX_CHARS);
  const suffix = totalPages > maxPages
    ? `\n\n[Note: extracted from first ${maxPages} of ${totalPages} pages]`
    : '';

  return (truncated + suffix).trim();
}

// ── DOCX via Mammoth (CDN) ────────────────────────────────────────────────────
async function extractDocx(file: File): Promise<string> {
  // @ts-expect-error — mammoth is loaded from CDN at runtime
  if (!window.mammoth) {
    await loadScript(
      'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'
    );
  }
  // @ts-expect-error
  const mammoth = window.mammoth;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return (result.value as string).replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CHARS);
}

// ── Utility ───────────────────────────────────────────────────────────────────
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}
