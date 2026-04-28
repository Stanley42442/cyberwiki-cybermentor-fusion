// src/lib/learner-profile.ts
// ─────────────────────────────────────────────────────────────────────────────
// Manages the AI-generated learner profile for each user.
// The profile is a short paragraph describing how this student thinks, what
// they struggle with, and how to teach them. It is prepended to BOTH the
// course tutor and career tutor system prompts so they adapt over time.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const PROXY = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-proxy`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// How many AI message exchanges before we attempt a profile update
const UPDATE_EVERY_N_MESSAGES = 6;

export interface LearnerProfile {
  profileText: string;
  sessionCount: number;
  lastUpdated: string;
}

// ── Load profile from Supabase ────────────────────────────────────────────────
async function fetchProfile(userId: string): Promise<LearnerProfile | null> {
  const { data } = await supabase
    .from('learner_profiles')
    .select('profile_text, session_count, last_updated')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return null;
  return {
    profileText: data.profile_text,
    sessionCount: data.session_count,
    lastUpdated: data.last_updated,
  };
}

// ── Generate/update profile from conversation ─────────────────────────────────
async function generateProfileUpdate(
  existingProfile: string,
  recentMessages: { role: string; content: string }[],
  accessToken: string
): Promise<string> {
  const conversationText = recentMessages
    .map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
    .join('\n');

  const prompt = existingProfile
    ? `You have an existing learner profile for this student:\n"${existingProfile}"\n\nBased on this new conversation excerpt, update and refine the profile. Keep what's still accurate, update what has changed, add new observations:\n\n${conversationText}`
    : `Analyse this conversation between a student and an AI tutor. Write a concise learner profile (3–5 sentences max) that captures:\n1. How they prefer information (examples/definitions first, bullet points/narrative, etc.)\n2. What concepts they struggle with\n3. Their confidence level and pacing\n4. Specific teaching recommendations\n\nWrite as direct instructions for an AI tutor: "This student prefers...". Be specific, not generic.\n\nConversation:\n${conversationText}`;

  const res = await fetch(PROXY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      model: 'gemma-4-31b-it',
      system_instruction: {
        parts: [{ text: 'You are an expert educational psychologist. Analyse student conversations and write precise, actionable learner profiles for AI tutors. Be concise and specific. Never use generic advice.' }],
      },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 300, temperature: 0.4 },
    }),
  });

  if (!res.ok) throw new Error(`Profile update failed: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? existingProfile;
}

// ── Save profile to Supabase ──────────────────────────────────────────────────
async function saveProfile(userId: string, profileText: string, sessionCount: number) {
  await supabase.from('learner_profiles').upsert(
    {
      user_id: userId,
      profile_text: profileText,
      session_count: sessionCount,
      last_updated: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
}

// ── React hook — use in both TutorPage and CourseTutorPage ───────────────────
export function useLearnerProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const updatingRef = useRef(false);

  // Load on mount
  useEffect(() => {
    if (!userId) return;
    fetchProfile(userId).then(p => {
      setProfile(p);
      setLoaded(true);
    });
  }, [userId]);

  // Called by tutors after enough messages accumulate — runs in background, never blocks UI
  const maybeUpdateProfile = useCallback(async (
    messages: { role: string; content: string }[],
    accessToken: string
  ) => {
    if (!userId || updatingRef.current) return;
    // Only update every N messages (count only AI replies)
    const aiMessages = messages.filter(m => m.role === 'assistant').length;
    if (aiMessages === 0 || aiMessages % UPDATE_EVERY_N_MESSAGES !== 0) return;

    updatingRef.current = true;
    try {
      const currentProfile = profile?.profileText ?? '';
      const sessionCount = (profile?.sessionCount ?? 0) + 1;
      // Use last 12 messages for context (keep token cost low)
      const recent = messages.slice(-12);
      const newProfileText = await generateProfileUpdate(currentProfile, recent, accessToken);
      await saveProfile(userId, newProfileText, sessionCount);
      setProfile({ profileText: newProfileText, sessionCount, lastUpdated: new Date().toISOString() });
      console.log('[learner-profile] Profile updated silently');
    } catch (e) {
      // Fail silently — profile update is a background enhancement, not critical
      console.warn('[learner-profile] Silent update failed:', e);
    } finally {
      updatingRef.current = false;
    }
  }, [userId, profile]);

  // Returns the profile text formatted for injection into a system prompt
  const profileContext = profile?.profileText
    ? `\n\nSTUDENT LEARNING PROFILE (adapt your teaching style accordingly):\n${profile.profileText}`
    : '';

  return { profile, loaded, profileContext, maybeUpdateProfile };
}
