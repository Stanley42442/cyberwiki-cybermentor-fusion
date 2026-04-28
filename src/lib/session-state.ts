// src/lib/session-state.ts
// Pinned session state — facts that MUST survive context summarisation.
// While summaries handle narrative continuity, this handles hard facts:
// confirmed understanding, mistakes + corrections, scores, active topic.
//
// Stored in Supabase per user+session_key. Small (< 1KB). Injected
// verbatim into every system prompt as a structured block — never summarised.
//
// The AI is instructed to treat this as ground truth even if it conflicts
// with anything in the message history.

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const PROXY = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-proxy`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Update session state every N assistant messages
const UPDATE_EVERY_N = 4;

export interface SessionState {
  activeTopic: string;
  confirmedConcepts: string[];       // concepts student demonstrably understood
  mistakes: string[];                // "Confused X with Y — corrected: ..."
  scores: { label: string; score: string }[];  // quiz/exam results
  confusionPoints: string[];         // things the student is currently struggling with
  lastUpdated: string;
}

function emptyState(topic: string): SessionState {
  return {
    activeTopic: topic,
    confirmedConcepts: [],
    mistakes: [],
    scores: [],
    confusionPoints: [],
    lastUpdated: new Date().toISOString(),
  };
}

// Format state as a compact block for injection into system prompts
export function formatSessionState(state: SessionState | null): string {
  if (!state) return '';
  const lines: string[] = [
    `\n\nPINNED SESSION STATE (treat as ground truth — never contradict this):`,
    `Active topic: ${state.activeTopic}`,
  ];
  if (state.confirmedConcepts.length)
    lines.push(`Confirmed understanding: ${state.confirmedConcepts.join('; ')}`);
  if (state.mistakes.length)
    lines.push(`Mistakes + corrections on record:\n${state.mistakes.map(m => `  • ${m}`).join('\n')}`);
  if (state.confusionPoints.length)
    lines.push(`Currently struggling with: ${state.confusionPoints.join('; ')} — address these proactively`);
  if (state.scores.length)
    lines.push(`Assessment history: ${state.scores.map(s => `${s.label}: ${s.score}`).join(', ')}`);
  lines.push(`END PINNED STATE`);
  return lines.join('\n');
}

// Extract updated state from recent messages using a fast AI call
async function extractStateUpdate(
  currentState: SessionState,
  recentMessages: { role: string; content: string }[],
  accessToken: string,
): Promise<SessionState> {
  const conversationText = recentMessages
    .slice(-8)
    .map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content.slice(0, 400)}`)
    .join('\n');

  const prompt = `Given this current session state:
${JSON.stringify(currentState, null, 2)}

And these recent exchanges:
${conversationText}

Update the session state JSON. Rules:
- Only ADD to confirmedConcepts if the student demonstrated clear understanding (correct answer, explained it back, etc.)
- Only ADD to mistakes if a specific factual error was made and corrected — record it as "Student said X, correct answer is Y"
- Update confusionPoints to reflect CURRENT struggles (remove resolved ones, add new ones)
- Keep activeTopic current
- Keep each array item under 80 characters
- Return ONLY valid JSON matching this exact shape: {"activeTopic":"...","confirmedConcepts":[...],"mistakes":[...],"scores":[...],"confusionPoints":[...],"lastUpdated":"..."}`;

  try {
    const res = await fetch(PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        model: 'gemma-4-31b-it',
        system_instruction: { parts: [{ text: 'You are a precise session state extractor. Return only valid JSON. No markdown, no explanation.' }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 500, temperature: 0.2 },
      }),
    });
    const json = await res.json();
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return { ...parsed, lastUpdated: new Date().toISOString() };
  } catch {
    // Fail silently — return current state unchanged
    return currentState;
  }
}

// Load state from Supabase
async function loadState(userId: string, sessionKey: string): Promise<SessionState | null> {
  const { data } = await supabase
    .from('session_states')
    .select('state')
    .eq('user_id', userId)
    .eq('session_key', sessionKey)
    .maybeSingle();
  return data?.state as SessionState ?? null;
}

// Save state to Supabase
async function saveState(userId: string, sessionKey: string, state: SessionState) {
  await supabase.from('session_states').upsert(
    { user_id: userId, session_key: sessionKey, state, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,session_key' }
  );
}

// ── React hook ──────────────────────────────────────────────────────────────
// sessionKey: unique per session type e.g. "course-cyb301" or "career-learn-network-security"
export function useSessionState(
  userId: string | undefined,
  sessionKey: string,
  initialTopic: string,
) {
  const [state, setState] = useState<SessionState | null>(null);
  const updatingRef = useRef(false);
  const messageCountRef = useRef(0);

  // Load on mount / session key change
  useEffect(() => {
    if (!userId || !sessionKey) return;
    loadState(userId, sessionKey).then(s => setState(s));
  }, [userId, sessionKey]);

  // Called after every assistant message — updates silently in background
  const maybeUpdateState = useCallback(async (
    messages: { role: string; content: string }[],
    currentTopic: string,
    accessToken: string,
  ) => {
    if (!userId || updatingRef.current) return;

    messageCountRef.current += 1;
    if (messageCountRef.current % UPDATE_EVERY_N !== 0) return;

    updatingRef.current = true;
    try {
      const current = state ?? emptyState(currentTopic);
      const updated = await extractStateUpdate(
        { ...current, activeTopic: currentTopic },
        messages,
        accessToken,
      );
      setState(updated);
      await saveState(userId, sessionKey, updated);
      console.log('[session-state] Updated silently');
    } catch {
      // fail silently
    } finally {
      updatingRef.current = false;
    }
  }, [userId, sessionKey, state]);

  // Call this when a quiz/exam result comes in — updates scores immediately
  const recordScore = useCallback(async (label: string, score: string) => {
    if (!userId) return;
    const current = state ?? emptyState(initialTopic);
    const updated: SessionState = {
      ...current,
      scores: [...current.scores.slice(-4), { label, score }], // keep last 5
      lastUpdated: new Date().toISOString(),
    };
    setState(updated);
    await saveState(userId, sessionKey, updated);
  }, [userId, sessionKey, state, initialTopic]);

  // Clear state when starting a fresh session on a new topic
  const resetState = useCallback(async (newTopic: string) => {
    if (!userId) return;
    const fresh = emptyState(newTopic);
    setState(fresh);
    await saveState(userId, sessionKey, fresh);
  }, [userId, sessionKey]);

  const stateContext = formatSessionState(state);

  return { state, stateContext, maybeUpdateState, recordScore, resetState };
}
