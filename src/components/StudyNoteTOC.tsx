import React, { useEffect, useState } from 'react';

interface StudyNoteTOCProps {
  content: string;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

const StudyNoteTOC: React.FC<StudyNoteTOCProps> = ({ content }) => {
  const [items, setItems] = useState<TocItem[]>([]);

  useEffect(() => {
    const headings = content.match(/^#{1,3}\s+.+$/gm) || [];
    setItems(
      headings.map((h, i) => {
        const level = h.match(/^#+/)?.[0].length || 2;
        const text = h.replace(/^#+\s+/, '');
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return { id, text, level };
      })
    );
  }, [content]);

  if (items.length === 0) return null;

  return (
    <div className="sticky top-20 hidden xl:block w-56">
      <div className="border border-border rounded-xl p-4">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 tracking-wider">Contents</h4>
        <nav className="space-y-1">
          {items.map((item, i) => (
            <a
              key={i}
              href={`#${item.id}`}
              className={`block text-sm text-muted-foreground hover:text-primary transition-colors ${
                item.level === 3 ? 'pl-4' : ''
              }`}
            >
              {item.text}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default StudyNoteTOC;
