// src/components/TopicFlagButton.tsx
// Anonymous "I don't understand this topic" button.
// No user_id is stored — fully anonymous by design.
// Admins see aggregated flag counts in the dashboard.

import { useState } from 'react';
import { HelpCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  courseId: string;
  topicName: string;  // e.g. "CIA Triad" or "Public Key Cryptography"
  compact?: boolean;  // true = icon only, false = full button
}

export default function TopicFlagButton({ courseId, topicName, compact = false }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');

  const flag = async () => {
    if (state !== 'idle') return;
    setState('loading');
    try {
      await supabase.from('topic_flags').insert({
        course_id: courseId,
        topic_name: topicName,
        flagged_at: new Date().toISOString(),
      });
      setState('done');
    } catch {
      setState('idle'); // silently reset on error
    }
  };

  if (state === 'done') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-primary/60">
        <CheckCircle className="w-3.5 h-3.5" />
        {!compact && 'Flagged — thanks!'}
      </span>
    );
  }

  return (
    <button
      onClick={flag}
      disabled={state === 'loading'}
      title={`Flag "${topicName}" as unclear`}
      className={`inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 ${
        compact ? 'p-1' : 'px-2.5 py-1.5 rounded-lg hover:bg-primary/5 border border-transparent hover:border-primary/20'
      }`}
    >
      <HelpCircle className="w-3.5 h-3.5" />
      {!compact && "I don't understand this"}
    </button>
  );
}
