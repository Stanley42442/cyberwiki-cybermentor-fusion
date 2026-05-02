// src/components/MathRenderer.tsx
// Renders text that may contain LaTeX math expressions.
// Supports both display math ($$...$$) and inline math ($...$).
//
// Usage:
//   <MathRenderer text="The equation $E = mc^2$ is fundamental." />
//   <MathRenderer text="$$\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}$$" />
//
// For courses without math, the component is a zero-cost passthrough —
// it only activates KaTeX when it finds $ delimiters in the text.
//
// Students writing contributions should use standard LaTeX notation:
//   Inline:  $x^2 + y^2 = z^2$
//   Display: $$\frac{dy}{dx} = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}$$

import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  text: string;
  className?: string;
}

// Split text into math and non-math segments
type Segment =
  | { type: 'text'; content: string }
  | { type: 'display'; content: string }
  | { type: 'inline'; content: string };

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  // Process display math first ($$...$$), then inline ($...$)
  const displayPattern = /\$\$([\s\S]+?)\$\$/g;
  const inlinePattern = /\$([^$\n]+?)\$/g;

  let lastIndex = 0;
  const allMatches: { index: number; end: number; type: 'display' | 'inline'; content: string }[] = [];

  // Find all display math blocks
  let m: RegExpExecArray | null;
  displayPattern.lastIndex = 0;
  while ((m = displayPattern.exec(text)) !== null) {
    allMatches.push({ index: m.index, end: m.index + m[0].length, type: 'display', content: m[1] });
  }

  // Find all inline math blocks (not overlapping display blocks)
  inlinePattern.lastIndex = 0;
  while ((m = inlinePattern.exec(text)) !== null) {
    const overlaps = allMatches.some(d => m!.index >= d.index && m!.index < d.end);
    if (!overlaps) {
      allMatches.push({ index: m.index, end: m.index + m[0].length, type: 'inline', content: m[1] });
    }
  }

  // Sort by position
  allMatches.sort((a, b) => a.index - b.index);

  for (const match of allMatches) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: match.type, content: match.content });
    lastIndex = match.end;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: text }];
}

function renderKatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex.trim(), {
      displayMode,
      throwOnError: false,
      output: 'html',
      trust: false,
    });
  } catch {
    // If KaTeX fails, show the raw LaTeX wrapped in a code span
    return `<code class="text-primary bg-primary/10 px-1 rounded">${latex}</code>`;
  }
}

const MathRenderer = ({ text, className }: MathRendererProps) => {
  const hasMath = text.includes('$');

  const rendered = useMemo(() => {
    if (!hasMath) return null;
    const segments = parseSegments(text);
    return segments.map((seg, i) => {
      if (seg.type === 'text') {
        return <span key={i}>{seg.content}</span>;
      }
      return (
        <span
          key={i}
          className={seg.type === 'display' ? 'block my-3 overflow-x-auto' : 'inline'}
          dangerouslySetInnerHTML={{ __html: renderKatex(seg.content, seg.type === 'display') }}
        />
      );
    });
  }, [text, hasMath]);

  if (!hasMath) {
    return <span className={className}>{text}</span>;
  }

  return <span className={className}>{rendered}</span>;
};

// For rendering multi-line study note content with math support
// Splits on newlines and renders each line with math
export const MathBlock = ({ text, className }: MathRendererProps) => {
  if (!text.includes('$')) {
    return <span className={className} style={{ whiteSpace: 'pre-line' }}>{text}</span>;
  }

  const lines = text.split('\n');
  return (
    <span className={className}>
      {lines.map((line, i) => (
        <span key={i}>
          <MathRenderer text={line} />
          {i < lines.length - 1 && '\n'}
        </span>
      ))}
    </span>
  );
};

export default MathRenderer;
