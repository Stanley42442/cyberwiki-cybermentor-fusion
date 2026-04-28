// src/components/SafeMarkdown.tsx
// Replaces the custom renderMD() + dangerouslySetInnerHTML pattern in both tutors.
// react-markdown renders to React elements — no raw HTML, no XSS risk.
// Already installed: react-markdown, remark-gfm.

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

// Custom renderers — match the existing visual style of the tutors
const components: Components = {
  h1: ({ children }) => <h1 className="text-xl font-bold text-foreground mt-5 mb-3">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-bold text-primary mt-5 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-bold text-foreground mt-4 mb-2">{children}</h3>,
  p:  ({ children }) => <p className="my-2 leading-7 text-sm">{children}</p>,
  strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
  em: ({ children }) => <em className="text-foreground/80 italic">{children}</em>,
  ul: ({ children }) => <ul className="my-2 space-y-1 list-disc pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 space-y-1 list-decimal pl-5">{children}</ol>,
  li: ({ children }) => <li className="text-foreground/80 text-sm leading-relaxed">{children}</li>,
  code: ({ children, className }) => {
    // Fenced code block (has a language className)
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return (
        <pre className="bg-black/40 border border-border rounded-lg p-4 my-3 overflow-x-auto">
          <code className="font-mono text-sm text-primary/90 leading-relaxed">{children}</code>
        </pre>
      );
    }
    // Inline code
    return (
      <code className="bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5 font-mono text-xs text-primary/90">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <>{children}</>, // let code handle the pre styling
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/40 pl-4 my-3 text-muted-foreground italic text-sm">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-border my-4" />,
  a: ({ href, children }) => (
    // Open external links safely — no rel="opener", no js: href
    <a
      href={href?.startsWith('http') ? href : undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline hover:text-primary/80 transition-colors"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse border border-border">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border px-3 py-2 bg-secondary font-semibold text-foreground text-left">{children}</th>,
  td: ({ children }) => <td className="border border-border px-3 py-2 text-foreground/80">{children}</td>,
};

interface Props {
  content: string;
  className?: string;
}

export default function SafeMarkdown({ content, className = '' }: Props) {
  // Hide session summary blocks from the UI entirely
  if (content.startsWith('[SESSION SUMMARY')) return null;

  return (
    <div className={`prose-sm max-w-none ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
