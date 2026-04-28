import React, { useState, useRef, useCallback, useEffect } from 'react';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { Play, Pause, List } from 'lucide-react';

interface SyncPlayerProps {
  content: string;
  syncMetadata?: {
    videoUrl: string;
    timestamps: { time: number; sectionId: string }[];
  };
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^?&]+)/);
  return match?.[1] || null;
}

const SyncPlayer: React.FC<SyncPlayerProps> = ({ content, syncMetadata }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);

  const videoId = syncMetadata?.videoUrl ? getYouTubeId(syncMetadata.videoUrl) : null;

  const seekTo = useCallback((seconds: number) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }),
        '*'
      );
      setIsPlaying(true);
    }
  }, []);

  const togglePlay = () => {
    if (iframeRef.current?.contentWindow) {
      const func = isPlaying ? 'pauseVideo' : 'playVideo';
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args: [] }),
        '*'
      );
      setIsPlaying(!isPlaying);
    }
  };

  if (!videoId) {
    return (
      <div className="max-w-4xl mx-auto">
        <MarkdownRenderer content={content} />
      </div>
    );
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-200px)]">
      {/* Left: Study Note */}
      <div ref={noteRef} className="flex-1 overflow-y-auto pr-4 border-r border-border">
        <MarkdownRenderer content={content} onTimestampClick={seekTo} />
      </div>

      {/* Right: Video + Controls */}
      <div className="w-[400px] flex flex-col gap-3">
        <div className="aspect-video bg-secondary rounded-lg overflow-hidden">
          <iframe
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}`}
            className="w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>

        <div className="flex items-center gap-2">
          <button onClick={togglePlay} className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setShowTimestamps(!showTimestamps)}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <List className="h-4 w-4" />
          </button>
        </div>

        {showTimestamps && syncMetadata?.timestamps && (
          <div className="border border-border rounded-lg overflow-y-auto max-h-60">
            <div className="p-2 border-b border-border text-xs font-semibold text-muted-foreground uppercase">Timestamps</div>
            {syncMetadata.timestamps.map((ts, i) => (
              <button
                key={i}
                onClick={() => seekTo(ts.time)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 transition-colors flex items-center gap-2"
              >
                <span className="font-mono-cyber text-primary text-xs">{formatTime(ts.time)}</span>
                <span className="text-muted-foreground">{ts.sectionId}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncPlayer;
