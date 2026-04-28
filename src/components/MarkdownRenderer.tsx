import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';

interface MarkdownRendererProps {
  content: string;
  onTimestampClick?: (seconds: number) => void;
}

mermaid.initialize({ startOnLoad: false, theme: 'dark' });

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onTimestampClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Process timestamps like [MM:SS] into clickable buttons
  const processedContent = content.replace(/\[(\d{1,2}:\d{2})\]/g, (match, time) => {
    return `<timestamp-btn data-time="${time}">${time}</timestamp-btn>`;
  });

  useEffect(() => {
    if (containerRef.current) {
      // Render mermaid diagrams
      const mermaidBlocks = containerRef.current.querySelectorAll('.language-mermaid');
      mermaidBlocks.forEach(async (block, i) => {
        const id = `mermaid-${i}-${Date.now()}`;
        try {
          const { svg } = await mermaid.render(id, block.textContent || '');
          const wrapper = document.createElement('div');
          wrapper.innerHTML = svg;
          block.parentElement?.replaceWith(wrapper);
        } catch { /* ignore */ }
      });

      // Attach timestamp click handlers
      const buttons = containerRef.current.querySelectorAll('timestamp-btn');
      buttons.forEach(btn => {
        const el = btn as HTMLElement;
        el.style.cssText = 'cursor:pointer;display:inline-flex;align-items:center;padding:2px 8px;border-radius:4px;font-size:12px;font-family:JetBrains Mono,monospace;background:hsl(145 80% 50% / 0.15);color:hsl(145 80% 50%);border:1px solid hsl(145 80% 50% / 0.3);margin:0 2px;';
        el.onclick = () => {
          const time = el.getAttribute('data-time');
          if (time && onTimestampClick) {
            const parts = time.split(':');
            const seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
            onTimestampClick(seconds);
          }
        };
      });
    }
  }, [content, onTimestampClick]);

  return (
    <div ref={containerRef} className="prose prose-invert max-w-none prose-headings:text-primary prose-a:text-primary prose-code:text-primary/80 prose-pre:bg-secondary">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            return (
              <code className={`${className || ''} font-mono-cyber text-sm`} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
