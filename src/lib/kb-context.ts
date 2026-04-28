// src/lib/kb-context.ts
// Loads the right knowledge base from Supabase for the active tutor session.
// Falls back to the hardcoded tutor-data.ts content if no Supabase KB exists yet.
// Both tutors (TutorPage + CourseTutorPage) use this hook.

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { KB as FALLBACK_KB, RW_KB as FALLBACK_RW_KB } from '@/lib/tutor-data';

export interface KBResult {
  content: string;       // The knowledge base text to inject into the system prompt
  source: 'supabase' | 'fallback' | 'none';
  loading: boolean;
  wordCount: number;
}

// ── Load a single KB from Supabase by type + entityId ─────────
async function fetchKB(type: string, entityId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('knowledge_bases')
    .select('content')
    .eq('type', type)
    .eq('entity_id', entityId)
    .eq('is_ready', true)
    .maybeSingle();
  if (error || !data?.content) return null;
  return data.content;
}

// ── Career tutor KB ────────────────────────────────────────────
// Loads: career_path KB + career_topic KB + optionally ai_literacy_topic KB
// entity IDs follow the pattern "careerId::topicSlug"
export function useCareerKB(
  careerId: string | undefined,
  topicId: string | undefined,    // slug of the active topic in the sidebar
  isAILiteracyTopic: boolean = false,
): KBResult {
  const [content, setContent] = useState('');
  const [source, setSource] = useState<KBResult['source']>('none');
  const [loading, setLoading] = useState(false);
  const prevKey = useRef('');

  useEffect(() => {
    if (!careerId) { setContent(''); setSource('none'); return; }

    const key = `${careerId}::${topicId ?? 'none'}::${isAILiteracyTopic}`;
    if (key === prevKey.current) return;
    prevKey.current = key;

    setLoading(true);
    (async () => {
      const parts: string[] = [];

      // 1. Career path KB (the foundation)
      const careerKB = await fetchKB('career_path', careerId);
      if (careerKB) parts.push(`=== CAREER PATH KNOWLEDGE BASE ===\n${careerKB}`);

      // 2. Topic-specific KB (if a topic is selected)
      if (topicId) {
        const entityId = isAILiteracyTopic
          ? `${careerId}::${topicId}`   // ai_literacy_topic
          : `${careerId}::${topicId}`;  // career_topic

        const type = isAILiteracyTopic ? 'ai_literacy_topic' : 'career_topic';
        const topicKB = await fetchKB(type, entityId);
        if (topicKB) {
          parts.push(`\n=== TOPIC KNOWLEDGE BASE ===\n${topicKB}`);
        }

        // Also load AI literacy overview if this is an AI literacy topic
        if (isAILiteracyTopic) {
          const aiOverview = await fetchKB('ai_literacy', `${careerId}::ai-literacy`);
          if (aiOverview) parts.push(`\n=== AI LITERACY CAREER OVERVIEW ===\n${aiOverview}`);
        }
      }

      if (parts.length > 0) {
        setContent(parts.join('\n\n'));
        setSource('supabase');
      } else {
        // Fall back to hardcoded KB from tutor-data.ts
        setContent(`${FALLBACK_KB}\n\n${FALLBACK_RW_KB}`);
        setSource('fallback');
      }
      setLoading(false);
    })();
  }, [careerId, topicId, isAILiteracyTopic]);

  return {
    content,
    source,
    loading,
    wordCount: content ? content.split(/\s+/).length : 0,
  };
}

// ── Course tutor KB ────────────────────────────────────────────
// Loads the course topic KB from Supabase.
// Falls back to injecting the relevant section of the study note.
export function useCourseTopicKB(
  courseId: string | undefined,
  topicSlug: string | undefined,
): KBResult {
  const [content, setContent] = useState('');
  const [source, setSource] = useState<KBResult['source']>('none');
  const [loading, setLoading] = useState(false);
  const prevKey = useRef('');

  useEffect(() => {
    if (!courseId || !topicSlug) { setContent(''); setSource('none'); return; }

    const key = `${courseId}::${topicSlug}`;
    if (key === prevKey.current) return;
    prevKey.current = key;

    setLoading(true);
    (async () => {
      // Try dedicated topic KB first
      const topicKB = await fetchKB('course_topic', key);
      if (topicKB) {
        setContent(`=== TOPIC KNOWLEDGE BASE ===\n${topicKB}`);
        setSource('supabase');
        setLoading(false);
        return;
      }

      // Fall back to the study note (full note — topic extraction is future optimisation)
      const { data } = await supabase
        .from('study_notes').select('content')
        .eq('course_id', courseId).maybeSingle();
      if (data?.content) {
        setContent(`=== COURSE STUDY NOTE ===\n${data.content.slice(0, 8000)}`);
        setSource('supabase');
      } else {
        setContent('');
        setSource('none');
      }
      setLoading(false);
    })();
  }, [courseId, topicSlug]);

  return { content, source, loading, wordCount: content ? content.split(/\s+/).length : 0 };
}

// ── Format KB for system prompt injection ─────────────────────
// Wraps the KB content in a clear block so the AI knows what it is
export function formatKBForPrompt(kb: KBResult, label = 'KNOWLEDGE BASE'): string {
  if (!kb.content || kb.loading) return '';
  return `\n\n${label} (${kb.wordCount.toLocaleString()} words — treat as authoritative reference):\n${kb.content}`;
}
