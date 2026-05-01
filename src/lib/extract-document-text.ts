// src/lib/extract-document-text.ts
// Browser-side text extraction for PDF and DOCX files.
// Uses pdfjs-dist for PDFs and mammoth for DOCX/DOC.
// The extracted text is sent as the contribution content so the AI
// actually validates the document body, not just the user's summary.

const MAX_CHARS = 8000; // Keep well under the AI token limit

/**
 * Reads a File object and returns the plain-text content (trimmed to MAX_CHARS).
 * Returns null if extraction fails — the caller should fall back to the user summary.
 */
export async function extractTextFromFile(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  try {
    if (ext === 'pdf') {
      return await extractPdf(file);
    }
    if (ext === 'docx' || ext === 'doc') {
      return await extractDocx(file);
    }
    return null;
  } catch (e) {
    console.warn('[extract-document-text] extraction failed:', e);
    return null;
  }
}

// ── PDF extraction via PDF.js (loaded from CDN to avoid Vite worker bundling) ──
async function extractPdf(file: File): Promise<string> {
  // @ts-expect-error — loaded from CDN at runtime
  if (!window.pdfjsLib) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    // @ts-expect-error
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  // @ts-expect-error
  const pdfjsLib = window.pdfjsLib;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const maxPages = Math.min(totalPages, 20); // cap at 20 pages to avoid timeouts

  const pageTexts: string[] = [];
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: { str: string }) => item.str)
      .join(' ')
      .replace(/\s{3,}/g, '\n\n');
    if (pageText.trim()) pageTexts.push(pageText.trim());
    // Stop early if we have enough text
    if (pageTexts.join('\n\n').length > MAX_CHARS) break;
  }

  const full = pageTexts.join('\n\n');
  const suffix = totalPages > maxPages ? `\n\n[Note: ${totalPages - maxPages} additional pages not shown]` : '';
  return (full.slice(0, MAX_CHARS) + suffix).trim();
}

// ── DOCX extraction via Mammoth (loaded from CDN) ────────────────────────────
async function extractDocx(file: File): Promise<string> {
  // @ts-expect-error
  if (!window.mammoth) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
  }
  // @ts-expect-error
  const mammoth = window.mammoth;

  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = (result.value as string)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.slice(0, MAX_CHARS);
}

// ── Script loader ─────────────────────────────────────────────────────────────
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}
