import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Menu, X, Send, ChevronRight, ExternalLink, RotateCcw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { useLearnerProfile } from '@/lib/learner-profile';
import {
  KB, RW_KB, CAREERS, DOMAINS, prepQuestions,
  type Career, type TopicItem,
} from '@/lib/tutor-data';

// ─── Proxy ────────────────────────────────────────────────────
const PROXY = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-proxy`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// ─── Context window management ────────────────────────────────
// Career tutor sessions reset naturally when switching topics,
// so limits are slightly more generous than the course tutor.
const HISTORY_LIMIT = 24;     // max messages sent to AI per call
const SUMMARY_TRIGGER = 20;   // start summarising when history reaches this

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

// Summarises the oldest half of a conversation into one compact block.
// Preserves: topics covered, student understanding, mistakes + corrections,
// career context, and where the session left off.
async function summariseHistory(
  systemPrompt: string,
  messages: Msg[],
  accessToken: string,
): Promise<Msg[]> {
  const half = Math.floor(messages.length / 2);
  const toSummarise = messages.slice(0, half);
  const toKeep = messages.slice(half);

  const conversationText = toSummarise
    .filter(m => !m.isSummary)
    .map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
    .join('\n');

  const summaryPrompt = `Summarise this cybersecurity tutoring conversation into a compact context block (max 250 words). Preserve: topics covered, key concepts explained, the student's career goal and level, understanding gaps, mistakes made and corrections given, quiz/lab results if any, and exactly where the session left off. This summary will be injected into a fresh AI context window so the session continues seamlessly.\n\nConversation:\n${conversationText}`;

  try {
    const res = await fetch(PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        model: 'gemma-4-31b-it',
        system_instruction: { parts: [{ text: 'You are a precise summariser for AI cybersecurity tutoring sessions. Retain all educational and career context. Be concise and specific.' }] },
        contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }],
        generationConfig: { maxOutputTokens: 450, temperature: 0.3 },
      }),
    });
    const json = await res.json();
    const summary = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!summary) return messages;

    const summaryMsg: Msg = {
      role: 'assistant',
      content: `[SESSION SUMMARY — earlier conversation condensed]\n${summary}\n[END SUMMARY]`,
      isSummary: true,
    };
    console.log('[TutorPage] Context summarised:', half, 'messages → 1 block');
    return [summaryMsg, ...toKeep];
  } catch {
    return messages; // fail silently, keep original
  }
}

async function callAI(systemPrompt: string, history: { role: string; content: string }[]): Promise<string> {
  const tok = await getToken();
  // Safety net: never send more than HISTORY_LIMIT messages
  const safeHistory = history.length > HISTORY_LIMIT ? history.slice(history.length - HISTORY_LIMIT) : history;
  const contents = safeHistory.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const res = await fetch(PROXY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${tok}`,
    },
    body: JSON.stringify({
      model: 'gemma-4-31b-it',
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 8192, temperature: 0.9, topP: 0.95 },
    }),
  });
  if (!res.ok) throw new Error(`Proxy error: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? 'AI error');
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ─── Prompt builder ───────────────────────────────────────────
// profileContext is injected here so BOTH tutors automatically personalise
function buildPrompt(
  career: Career | undefined,
  level: number,
  topic: TopicItem | null,
  weakAreas: string[],
  mode: string,
  courseContext?: string,
  profileContext?: string,  // ← learner profile paragraph
): string {
  const lvls = ['', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];
  const courseNote = courseContext ? `\nCOURSE STUDY NOTE CONTEXT:\n${courseContext.slice(0, 3000)}\n` : '';
  const learnerNote = profileContext ? `\n${profileContext}\n` : '';
  return `You are CyberMentor — an elite cybersecurity educator with the personality of a sharp, experienced mentor who genuinely enjoys teaching. You are enthusiastic, thorough, and speak like a real person. ALWAYS use vivid real-world analogies and Nigerian/African examples. ALWAYS be Socratic — ask, guide, challenge, and celebrate breakthroughs. NEVER give dry, lifeless answers.

Your student is a ${lvls[level] ?? 'Beginner'}-level learner working toward becoming a ${career?.title ?? 'cybersecurity professional'}, currently studying ${topic?.title ?? 'general cybersecurity'}. ${weakAreas.length ? `Their known weak areas are: ${weakAreas.join(', ')}.` : ''}
${courseNote}${learnerNote}
YOUR REFERENCE KNOWLEDGE:
${KB}

${RW_KB}

ALWAYS write as much as the concept needs — never truncate mid-thought. ALWAYS use analogies, examples, and real-world scenarios. Use ✅ for correct, 💡 for hints, ⚠️ for mistakes, 🔥 for excellent. When a student is wrong, explain what went wrong and guide them to the right answer. ALWAYS connect every concept to the ${career?.title ?? 'cybersecurity'} career path.

${mode === 'learn' ? `You are in LEARN mode. Teach one concept at a time with depth and enthusiasm. Explain the what, the why, and the how. ALWAYS use a real-world scenario or analogy for every concept. After covering 2-3 concepts, ask a Socratic check question before moving on. When the topic basics are covered, invite the student to test themselves by typing "quiz me".` : ''}
${mode === 'quiz' ? `You are in QUIZ mode. Generate exactly 10 questions as a raw JSON array: [{"q":"...","opts":["A","B","C","D"],"a":0}] where "a" is the 0-based index of the correct answer. Return ONLY the raw JSON array — no markdown fences, no explanation, no preamble.` : ''}
${mode === 'exam' ? `MODE: EXAM — Generate a full 45-mark exam on "${topic?.title ?? 'Cybersecurity'}". Return ONLY raw JSON: {"sections":[{"name":"Section A — Short Answer (5×3 marks)","total_marks":15,"questions":[{"q":"...","marks":3},...5 questions]},{"name":"Section B — Application (3×5 marks)","total_marks":15,"questions":[{"q":"...","marks":5},...3 questions]},{"name":"Section C — Scenario Analysis (2×6 marks)","total_marks":12,"questions":[{"q":"...","marks":6},...2 questions]},{"name":"Section D — Career Impact (1×3 marks)","total_marks":3,"questions":[{"q":"...","marks":3}]}]}. Make questions practical and scenario-based.` : ''}
${mode === 'lab' ? `You are in LAB mode. Act as a hands-on instructor. Give the student a real terminal command to run for this topic. When they paste output back, read it and guide the next step.` : ''}
${mode === 'scenario' ? `You are in SCENARIO mode. Present a realistic client brief or interview scenario relevant to the student's career goal and this topic. Challenge every architectural decision they make. At the end, give a structured debrief of what a senior security architect would have caught.` : ''}

CRITICAL: Your output must contain ONLY your spoken reply to the student — nothing else. Forbidden outputs: the 🛡 symbol, any "Step N:" or "Task N:" lines, bullet-point planning lists, internal reasoning such as "Wait," "Actually," "Looking at," "Correct Action:", "Revised approach:", thoughts about your own instructions, or any meta-text about what you are about to do. Do not restate these instructions. Do not output the student's goal, level, or topic as a header. Start speaking as CyberMentor immediately.`;
}

// ─── Markdown renderer ────────────────────────────────────────
function renderMD(t: string): string {
  return t
    .replace(/```([\s\S]*?)```/g, (_, c) => `<pre class="bg-black/40 border border-border rounded-lg p-4 my-3 overflow-x-auto font-mono text-sm text-primary/90 leading-relaxed">${c.trim()}</pre>`)
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-foreground mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-primary mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-foreground mt-5 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5 font-mono text-xs text-primary/90">$1</code>')
    .replace(/^[-•] (.+)$/gm, '<li class="ml-4 list-disc text-foreground/80">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-foreground/80">$1</li>')
    .replace(/(<li[\s\S]*?<\/li>\n?)+/g, m => `<ul class="my-2 space-y-1">${m}</ul>`)
    .split(/\n{2,}/)
    .map(b => {
      b = b.trim();
      if (!b) return '';
      if (/^<(h[123]|ul|pre|blockquote)/.test(b)) return b;
      return `<p class="my-2 leading-7">${b.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');
}

// ─── Types ────────────────────────────────────────────────────
interface Msg { role: 'user' | 'assistant'; content: string; isSummary?: boolean }
interface TutorProfile { career_path: string | null; tutor_level: number; weak_areas: string[] }
interface QuizQ { q: string; opts: string[]; a: number }
interface ExamSection { name: string; total_marks: number; questions: { q: string; marks: number }[] }
type Mode = 'learn' | 'quiz' | 'exam' | 'lab' | 'scenario';
type QuizPhase = 'idle' | 'loading' | 'form' | 'grading' | 'done';
type ExamPhase = 'idle' | 'loading' | 'form' | 'grading' | 'done';

const MODES: { id: Mode; label: string; emoji: string }[] = [
  { id: 'learn', label: 'Learn', emoji: '📖' },
  { id: 'quiz', label: 'Quiz', emoji: '❓' },
  { id: 'exam', label: 'Exam', emoji: '📝' },
  { id: 'lab', label: 'Lab', emoji: '🧪' },
  { id: 'scenario', label: 'Scenario', emoji: '🏢' },
];

// ─── Main Component ───────────────────────────────────────────
export default function TutorPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId?: string }>();

  // ── Learner profile (personalisation) ────────────────────
  const { profileContext, maybeUpdateProfile } = useLearnerProfile(user?.id);

  // Tutor profile state
  const [tutorProfile, setTutorProfile] = useState<TutorProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [screen, setScreen] = useState<'loading' | 'onboard' | 'assess' | 'app'>('loading');

  const [selCareer, setSelCareer] = useState<string>('');
  const [questions] = useState(() => prepQuestions());
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [topic, setTopic] = useState<TopicItem | null>(null);
  const [mode, setMode] = useState<Mode>('learn');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [courseContext, setCourseContext] = useState<string | undefined>();
  const [summarising, setSummarising] = useState(false);

  const [quizPhase, setQuizPhase] = useState<QuizPhase>('idle');
  const [quizQs, setQuizQs] = useState<QuizQ[]>([]);
  const [quizAns, setQuizAns] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<{ score: number; results: { q: string; correct: string; chosen: string; is_correct: boolean; explanation: string }[]; weak_areas: string[]; overall_feedback: string } | null>(null);

  const [examPhase, setExamPhase] = useState<ExamPhase>('idle');
  const [examSecs, setExamSecs] = useState<ExamSection[]>([]);
  const [examAns, setExamAns] = useState<Record<string, string>>({});
  const [examResult, setExamResult] = useState<{ score: number; grade: string; overall_feedback: string; sections: { name: string; marks_awarded: number; marks_total: number; feedback: string }[]; improvement: string[] } | null>(null);
  const [examTimer, setExamTimer] = useState(2700);
  const [timerOn, setTimerOn] = useState(false);
  const [examQIdx, setExamQIdx] = useState(0);

  const msgsEnd = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const career = CAREERS.find(c => c.id === (tutorProfile?.career_path ?? ''));
  const level = tutorProfile?.tutor_level ?? 1;
  const weakAreas = tutorProfile?.weak_areas ?? [];

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('career_path, tutor_level, weak_areas')
        .eq('id', user.id)
        .maybeSingle();
      const p: TutorProfile = {
        career_path: data?.career_path ?? null,
        tutor_level: data?.tutor_level ?? 1,
        weak_areas: data?.weak_areas ?? [],
      };
      setTutorProfile(p);
      setProfileLoading(false);
      if (!p.career_path && !courseId) setScreen('onboard');
      else if (!data?.tutor_level && !courseId) setScreen('assess');
      else setScreen('app');
    })();
  }, [user]);

  useEffect(() => {
    if (!courseId) return;
    (async () => {
      const { data } = await supabase.from('study_notes').select('content').eq('course_id', courseId).maybeSingle();
      if (data?.content) setCourseContext(data.content);
    })();
  }, [courseId]);

  useEffect(() => {
    if (!timerOn) return;
    const t = setInterval(() => {
      setExamTimer(prev => {
        if (prev <= 1) { clearInterval(t); setTimerOn(false); submitExam(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [timerOn]);

  useEffect(() => { msgsEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const saveConversation = useCallback(async (msgs: Msg[]) => {
    if (!user || !topic) return;
    await supabase.from('conversations').upsert(
      { user_id: user.id, topic_id: topic.id, mode, messages: msgs as unknown as Record<string, unknown>[], updated_at: new Date().toISOString() },
      { onConflict: 'user_id,topic_id,mode' }
    );
  }, [user, topic, mode]);

  // ── Context rot prevention ─────────────────────────────────
  const maybeCondense = useCallback(async (msgs: Msg[], sys: string): Promise<Msg[]> => {
    if (msgs.length < SUMMARY_TRIGGER) return msgs;
    setSummarising(true);
    const tok = await getToken();
    const condensed = await summariseHistory(sys, msgs, tok);
    setSummarising(false);
    return condensed;
  }, []);

  const loadConversation = useCallback(async (topicId: string, m: Mode) => {
    if (!user) return [];
    const { data } = await supabase
      .from('conversations').select('messages')
      .eq('user_id', user.id).eq('topic_id', topicId).eq('mode', m)
      .maybeSingle();
    return (data?.messages as unknown as Msg[]) ?? [];
  }, [user]);

  const selectTopic = async (t: TopicItem) => {
    setTopic(t);
    setStarted(false);
    setSidebarOpen(false);
    setMessages([]);
    setQuizPhase('idle'); setQuizQs([]); setQuizAns({}); setQuizResult(null);
    setExamPhase('idle'); setExamSecs([]); setExamAns({}); setExamResult(null);
    setTimerOn(false); setExamTimer(2700); setExamQIdx(0);
    const saved = await loadConversation(t.id, mode);
    if (saved.length) { setMessages(saved); setStarted(true); }
  };

  const startSession = async () => {
    if (!topic) return;
    setError(null);
    if (mode === 'quiz') {
      setQuizPhase('loading'); setLoading(true);
      try {
        const sys = buildPrompt(career, level, topic, weakAreas, 'quiz', courseContext, profileContext);
        const raw = await callAI(sys, [{ role: 'user', content: `Generate 10 quiz questions on "${topic.title}". Return ONLY the JSON array.` }]);
        const parsed: QuizQ[] = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
        setQuizQs(parsed); setQuizAns({}); setQuizPhase('form'); setStarted(true);
      } catch (e) { setError('Quiz generation failed: ' + (e as Error).message); setQuizPhase('idle'); }
      setLoading(false); return;
    }
    if (mode === 'exam') {
      setExamPhase('loading'); setLoading(true);
      try {
        const sys = buildPrompt(career, level, topic, weakAreas, 'exam', courseContext, profileContext);
        const raw = await callAI(sys, [{ role: 'user', content: 'Generate exam JSON now.' }]);
        const parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
        setExamSecs(parsed.sections ?? []); setExamAns({}); setExamPhase('form');
        setExamTimer(2700); setTimerOn(true); setStarted(true); setExamQIdx(0);
      } catch (e) { setError('Exam generation failed: ' + (e as Error).message); setExamPhase('idle'); }
      setLoading(false); return;
    }
    setLoading(true); setStarted(true);
    try {
      const sys = buildPrompt(career, level, topic, weakAreas, mode, courseContext, profileContext);
      const intro = mode === 'learn'
        ? `Introduce "${topic.title}" to a ${['', 'beginner', 'intermediate', 'advanced', 'expert'][level]} ${career?.title ?? 'cybersecurity'} student. Start with the big picture then dive in.`
        : mode === 'lab' ? `Give me the first lab task for "${topic.title}". Tell me exactly what command to run and why.`
        : `Present a realistic client scenario for "${topic.title}" relevant to ${career?.title ?? 'a cybersecurity professional'}.`;
      const reply = await callAI(sys, [{ role: 'user', content: intro }]);
      const msgs: Msg[] = [{ role: 'assistant', content: reply }];
      setMessages(msgs);
      await saveConversation(msgs);
    } catch (e) { setError((e as Error).message); }
    setLoading(false);
  };

  const send = async () => {
    if (!input.trim() || !topic) return;
    const txt = input.trim();
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';

    if (/^quiz\s*me/i.test(txt)) { await switchMode('quiz'); return; }
    if (/^lab$/i.test(txt)) { await switchMode('lab'); return; }
    if (/^scenario$/i.test(txt)) { await switchMode('scenario'); return; }
    if (/^exam$/i.test(txt)) { await switchMode('exam'); return; }

    let updated: Msg[] = [...messages, { role: 'user', content: txt }];
    setMessages(updated);
    setLoading(true); setError(null);
    try {
      const sys = buildPrompt(career, level, topic, weakAreas, mode, courseContext, profileContext);
      // ── Condense if history is growing too long ────────────
      const condensed = await maybeCondense(updated, sys);
      if (condensed.length !== updated.length) {
        updated = condensed;
        setMessages(condensed);
      }
      const reply = await callAI(sys, condensed);
      const final: Msg[] = [...condensed, { role: 'assistant', content: reply }];
      setMessages(final);
      await saveConversation(final);
      // ── Silently update learner profile in background ──────
      const tok = await getToken();
      maybeUpdateProfile(final.filter(m => !m.isSummary), tok);
    } catch (e) { setError((e as Error).message); }
    setLoading(false);
  };

  const switchMode = async (m: Mode) => {
    setMode(m); setStarted(false);
    setQuizPhase('idle'); setQuizQs([]); setQuizAns({}); setQuizResult(null);
    setExamPhase('idle'); setExamSecs([]); setExamAns({}); setExamResult(null);
    setTimerOn(false); setExamTimer(2700);
    if (topic) {
      const saved = await loadConversation(topic.id, m);
      if (saved.length) { setMessages(saved); setStarted(true); }
      else setMessages([]);
    }
  };

  const submitQuiz = async () => {
    setQuizPhase('grading'); setLoading(true);
    try {
      const sys = buildPrompt(career, level, topic, weakAreas, 'learn', courseContext, profileContext);
      const answersText = quizQs.map((q, i) => `Q${i + 1}: ${q.q}\nChosen: ${q.opts[quizAns[i] ?? -1] ?? 'Not answered'}\nCorrect: ${q.opts[q.a]}`).join('\n\n');
      const raw = await callAI(sys, [{ role: 'user', content: `Grade these quiz answers. Return ONLY raw JSON: {"score":N,"results":[{"q":"...","chosen":"...","correct":"...","is_correct":true/false,"explanation":"..."}],"weak_areas":["..."],"overall_feedback":"..."}\n\nAnswers:\n${answersText}` }]);
      const parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
      setQuizResult(parsed);
      if (user && topic) {
        await supabase.from('quiz_results').insert({ user_id: user.id, topic_id: topic.id, score: parsed.score, total: quizQs.length, weak_areas: parsed.weak_areas ?? [], answers_json: parsed.results as unknown as Record<string, unknown>[] });
        const merged = [...new Set([...weakAreas, ...(parsed.weak_areas ?? [])])].slice(0, 10);
        await supabase.from('profiles').update({ weak_areas: merged }).eq('id', user.id);
        setTutorProfile(p => p ? { ...p, weak_areas: merged } : p);
      }
      setQuizPhase('done');
    } catch (e) { setError('Grading failed: ' + (e as Error).message); setQuizPhase('form'); }
    setLoading(false);
  };

  const submitExam = async () => {
    setTimerOn(false); setExamPhase('grading'); setLoading(true);
    try {
      const sys = buildPrompt(career, level, topic, weakAreas, 'learn', courseContext, profileContext);
      const answersText = examSecs.map((sec, si) =>
        `${sec.name}:\n` + sec.questions.map((q, qi) => `Q${qi + 1} [${q.marks}m]: ${q.q}\nAnswer: ${examAns[`${si}_${qi}`] ?? '(no answer)'}`).join('\n\n')
      ).join('\n\n---\n\n');
      const raw = await callAI(sys, [{ role: 'user', content: `Mark this exam. Return ONLY raw JSON: {"score":N,"grade":"A/B/C/D/F","overall_feedback":"...","sections":[{"name":"...","marks_awarded":N,"marks_total":N,"feedback":"..."}],"improvement":["..."]}\n\nExam answers:\n${answersText}` }]);
      const parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
      setExamResult(parsed);
      if (user && topic) await supabase.from('exam_results').insert({ user_id: user.id, topic_id: topic.id, score: parsed.score, total: 45, grade: parsed.grade, feedback_json: parsed.sections as unknown as Record<string, unknown>[] });
      setExamPhase('done');
    } catch (e) { setError('Marking failed: ' + (e as Error).message); setExamPhase('form'); }
    setLoading(false);
  };

  const saveCareer = async () => {
    if (!selCareer || !user) return;
    await supabase.from('profiles').update({ career_path: selCareer }).eq('id', user.id);
    setTutorProfile(p => p ? { ...p, career_path: selCareer } : { career_path: selCareer, tutor_level: 0, weak_areas: [] });
    setScreen('assess');
  };

  const handleAnswer = async (optIdx: number) => {
    const newAnswers = [...answers, optIdx];
    if (qIdx < questions.length - 1) { setAnswers(newAnswers); setQIdx(qIdx + 1); }
    else {
      const score = newAnswers.filter((a, i) => a === questions[i].a).length;
      const lvl = score >= 12 ? 4 : score >= 8 ? 3 : score >= 5 ? 2 : 1;
      if (user) { await supabase.from('profiles').update({ tutor_level: lvl }).eq('id', user.id); setTutorProfile(p => p ? { ...p, tutor_level: lvl } : null); }
      setScreen('app');
    }
  };

  if (authLoading || profileLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="flex gap-1.5"><span className="dot-pulse" /><span className="dot-pulse" /><span className="dot-pulse" /></div></div>;
  }

  if (screen === 'onboard') {
    return (
      <div className="min-h-screen bg-background cyber-grid-bg overflow-y-auto">
        <div className="container mx-auto px-4 py-12 max-w-2xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 font-mono text-xs text-primary mb-6">⚡ CyberWiki AI Tutor</div>
            <h1 className="text-3xl font-bold text-foreground mb-3">Choose Your Career Path</h1>
            <p className="text-muted-foreground text-sm">Your learning is personalised to your goal. You can change this later.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {CAREERS.map(c => (
              <button key={c.id} onClick={() => setSelCareer(c.id)}
                className={`p-4 rounded-xl border text-left transition-all ${selCareer === c.id ? 'border-primary bg-primary/8 shadow-[0_0_16px_hsl(145_80%_44%/0.15)]' : 'border-border bg-card hover:border-primary/40'}`}>
                <div className="text-2xl mb-2">{c.emoji}</div>
                <div className="font-semibold text-foreground text-sm mb-1">{c.title}</div>
                <div className="font-mono text-xs text-primary/80">{c.salaryNGN}</div>
              </button>
            ))}
          </div>
          {selCareer && (() => { const c = CAREERS.find(x => x.id === selCareer)!; return (
            <div className="card-cyber p-5 mb-6">
              <div className="font-semibold text-foreground mb-2">{c.emoji} {c.title}</div>
              <p className="text-sm text-muted-foreground mb-3">{c.standOut}</p>
              <div className="flex flex-wrap gap-2">{c.certs.map(cert => <span key={cert} className="badge-code">{cert}</span>)}</div>
            </div>
          ); })()}
          <button onClick={saveCareer} disabled={!selCareer} className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-30 min-h-[52px]">Continue →</button>
        </div>
      </div>
    );
  }

  if (screen === 'assess') {
    const q = questions[qIdx];
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-lg">
          <p className="font-mono text-xs text-muted-foreground text-center mb-2">PLACEMENT TEST — QUESTION {qIdx + 1} OF {questions.length}</p>
          <div className="h-1 bg-border rounded-full mb-8 overflow-hidden"><div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(qIdx / questions.length) * 100}%` }} /></div>
          <h2 className="text-lg font-semibold text-foreground mb-6 leading-relaxed">{q.q}</h2>
          <div className="flex flex-col gap-3">
            {q.opts.map((opt, i) => (
              <button key={i} onClick={() => handleAnswer(i)} className="w-full text-left px-5 py-4 rounded-xl border border-border bg-card text-sm text-foreground hover:border-primary hover:bg-primary/5 transition-all min-h-[56px] font-medium">{opt}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const flatExamQs = examSecs.flatMap((sec, si) => sec.questions.map((q, qi) => ({ ...q, si, qi, secName: sec.name })));
  const curExamQ = flatExamQs[examQIdx];
  const examAnswered = Object.values(examAns).filter(v => v.trim()).length;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden relative">
        {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />}

        {/* Sidebar */}
        <aside className={`fixed md:relative top-0 left-0 bottom-0 w-72 z-30 md:z-auto bg-sidebar border-r border-border flex flex-col overflow-hidden transition-transform duration-250 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <div>
              <div className="font-share-tech text-xs text-primary tracking-widest">CYBERMENTOR</div>
              <div className="text-xs text-muted-foreground mt-0.5">{career?.emoji} {career?.title ?? 'Select career'}</div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"><X className="h-4 w-4" /></button>
          </div>
          {career && (
            <div className="mx-3 my-2 p-3 rounded-lg bg-primary/5 border border-primary/15 flex-shrink-0">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-primary">Level {level}</span>
                <span className="font-mono text-xs text-muted-foreground">{['', 'Beginner', 'Intermediate', 'Advanced', 'Expert'][level]}</span>
              </div>
              <button onClick={() => setScreen('onboard')} className="mt-1.5 text-xs text-muted-foreground hover:text-primary transition-colors font-mono">Change path →</button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
            {DOMAINS.map(domain => (
              <div key={domain.name}>
                <div className="px-4 py-2 text-[10px] font-mono tracking-widest text-muted-foreground/70 uppercase border-t border-border mt-1">{domain.name}</div>
                {domain.topics.map(t => (
                  <button key={t.id} onClick={() => selectTopic(t)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors min-h-[40px] relative ${topic?.id === t.id ? 'bg-primary/8 text-primary' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}>
                    {topic?.id === t.id && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />}
                    <span className="text-sm flex-1 truncate">{t.title}</span>
                    <span className="flex gap-0.5 flex-shrink-0">{[1,2,3,4,5].map(i => <span key={i} className={`w-1 h-1 rounded-sm ${i <= t.diff ? 'bg-primary' : 'bg-border'}`} />)}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="px-3 py-3 border-t border-border flex-shrink-0">
            <Link to="/contribute" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"><span>📝</span> Contribute course notes</Link>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-card/50 flex-shrink-0 flex-wrap">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground min-w-[36px] min-h-[36px] flex items-center justify-center"><Menu className="h-4 w-4" /></button>
            <span className="font-semibold text-foreground text-sm flex-1 min-w-0 truncate">{topic?.title ?? 'Select a topic'}</span>
            {topic?.thmUrl && <a href={topic.thmUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-primary text-xs font-mono hover:bg-primary/10 transition-colors">🔬 TryHackMe <ExternalLink className="h-3 w-3" /></a>}
            {started && mode !== 'quiz' && mode !== 'exam' && <button onClick={() => { setMessages([]); setStarted(false); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary transition-colors" title="Reset"><RotateCcw className="h-3.5 w-3.5" /></button>}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border flex-shrink-0 overflow-x-auto">
            {MODES.map(m => (
              <button key={m.id} onClick={() => switchMode(m.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0 min-h-[36px] ${mode === m.id ? 'bg-primary/15 border border-primary/40 text-primary' : 'border border-border text-muted-foreground hover:text-foreground'}`}>
                <span>{m.emoji}</span> {m.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {/* Quiz form */}
            {mode === 'quiz' && quizPhase === 'form' && (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                <div className="flex justify-between text-xs font-mono text-muted-foreground px-1"><span>{Object.keys(quizAns).length}/{quizQs.length} answered</span><span>{topic?.title}</span></div>
                {quizQs.map((q, qi) => (
                  <div key={qi} className="card-cyber p-5">
                    <div className="font-mono text-[10px] text-muted-foreground mb-3 tracking-wider">QUESTION {qi + 1} OF {quizQs.length}</div>
                    <p className="font-semibold text-foreground text-sm mb-4 leading-relaxed">{q.q}</p>
                    <div className="flex flex-col gap-2">
                      {q.opts.map((opt, oi) => (
                        <button key={oi} onClick={() => setQuizAns(a => ({ ...a, [qi]: oi }))}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-all min-h-[48px] ${quizAns[qi] === oi ? 'border-primary bg-primary/8 text-primary font-medium' : 'border-border bg-secondary/30 text-foreground hover:border-primary/40'}`}>
                          <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${quizAns[qi] === oi ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
                          {String.fromCharCode(65 + oi)}. {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={submitQuiz} disabled={loading || Object.keys(quizAns).length < quizQs.length} className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-30 min-h-[52px]">{loading ? 'Grading...' : '✓ Submit All Answers'}</button>
              </div>
            )}

            {/* Quiz result */}
            {mode === 'quiz' && quizPhase === 'done' && quizResult && (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                <div className="card-cyber p-8 text-center">
                  <div className="font-mono text-6xl font-bold text-primary mb-2">{quizResult.score}/{quizQs.length}</div>
                  <div className="text-muted-foreground text-sm">{quizResult.score >= 8 ? '🔥 Excellent!' : quizResult.score >= 6 ? '✅ Good work' : '💡 Keep going'}</div>
                </div>
                {quizResult.overall_feedback && <div className="card-cyber p-4 text-sm text-foreground leading-7">{quizResult.overall_feedback}</div>}
                {quizResult.results.map((r, i) => (
                  <div key={i} className={`card-cyber p-4 border-l-2 ${r.is_correct ? 'border-l-primary' : 'border-l-destructive'}`}>
                    <div className="font-semibold text-sm text-foreground mb-2">{r.is_correct ? '✅' : '❌'} {r.q}</div>
                    {!r.is_correct && <div className="text-xs font-mono text-destructive mb-1">You: {r.chosen}</div>}
                    <div className="text-xs font-mono text-primary mb-2">Answer: {r.correct}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-2">{r.explanation}</div>
                  </div>
                ))}
                <button onClick={() => { setQuizPhase('idle'); setQuizQs([]); setQuizAns({}); setQuizResult(null); setStarted(false); }} className="w-full py-3 rounded-xl border border-primary text-primary text-sm font-semibold mb-4">↺ Take Another Quiz</button>
              </div>
            )}

            {/* Exam loading/grading */}
            {mode === 'exam' && (examPhase === 'loading' || examPhase === 'grading') && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="flex gap-1.5 justify-center mb-3"><span className="dot-pulse" /><span className="dot-pulse" /><span className="dot-pulse" /></div>
                  <p className="text-sm text-muted-foreground font-mono">{examPhase === 'loading' ? 'Generating exam...' : 'Marking your answers...'}</p>
                </div>
              </div>
            )}

            {/* Exam form */}
            {mode === 'exam' && examPhase === 'form' && curExamQ && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card/50 flex-shrink-0 font-mono text-sm">
                  <span className="text-muted-foreground">⏱</span>
                  <span className={`font-bold ${examTimer < 300 ? 'text-destructive' : examTimer < 600 ? 'text-orange-400' : 'text-primary'}`}>{String(Math.floor(examTimer / 60)).padStart(2, '0')}:{String(examTimer % 60).padStart(2, '0')}</span>
                  <span className="flex-1" />
                  <span className="text-xs text-muted-foreground">{examAnswered}/{flatExamQs.length} answered</span>
                </div>
                <div className="h-0.5 bg-border flex-shrink-0"><div className="h-full bg-primary transition-all" style={{ width: `${((examQIdx + 1) / flatExamQs.length) * 100}%` }} /></div>
                <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3 min-h-0">
                  <div className="card-cyber p-5 flex flex-col gap-3 flex-1 min-h-0">
                    <div className="flex justify-between font-mono text-[10px] text-primary tracking-wider"><span>{curExamQ.secName}</span><span>Q {examQIdx + 1} / {flatExamQs.length}</span></div>
                    <p className="font-semibold text-foreground text-sm leading-relaxed">{curExamQ.q}</p>
                    <div className="font-mono text-xs text-primary/70">[{curExamQ.marks} mark{curExamQ.marks > 1 ? 's' : ''}]</div>
                    <textarea autoFocus className="flex-1 min-h-[120px] w-full bg-black/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground resize-none outline-none focus:border-primary/50 transition-colors" placeholder="Your answer..."
                      value={examAns[`${curExamQ.si}_${curExamQ.qi}`] ?? ''}
                      onChange={e => setExamAns(a => ({ ...a, [`${curExamQ.si}_${curExamQ.qi}`]: e.target.value }))} />
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setExamQIdx(i => Math.max(0, i - 1))} disabled={examQIdx === 0} className="px-4 py-2.5 rounded-xl border border-border text-sm font-mono text-muted-foreground hover:border-primary hover:text-primary transition-all disabled:opacity-30 min-h-[44px]">← Prev</button>
                    <div className="flex-1 flex gap-1.5 flex-wrap justify-center">
                      {flatExamQs.map((_, i) => (
                        <button key={i} onClick={() => setExamQIdx(i)} className={`w-7 h-7 rounded-md text-xs font-mono transition-all ${i === examQIdx ? 'bg-primary text-primary-foreground' : examAns[`${flatExamQs[i].si}_${flatExamQs[i].qi}`]?.trim() ? 'bg-primary/20 border border-primary/40 text-primary' : 'bg-secondary border border-border text-muted-foreground'}`}>{i + 1}</button>
                      ))}
                    </div>
                    <button onClick={() => setExamQIdx(i => Math.min(flatExamQs.length - 1, i + 1))} disabled={examQIdx === flatExamQs.length - 1} className="px-4 py-2.5 rounded-xl border border-border text-sm font-mono text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-30 min-h-[44px]">Next →</button>
                  </div>
                  {error && <p className="text-xs text-destructive font-mono">⚠ {error}</p>}
                  <button onClick={submitExam} disabled={loading} className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-30 min-h-[52px] flex-shrink-0">{loading ? 'Marking...' : `✓ Submit Exam${examAnswered < flatExamQs.length ? ` (${examAnswered}/${flatExamQs.length})` : ''}`}</button>
                </div>
              </div>
            )}

            {/* Exam result */}
            {mode === 'exam' && examPhase === 'done' && examResult && (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                <div className="card-cyber p-8 text-center"><div className="font-mono text-7xl font-bold text-primary mb-1">{examResult.grade}</div><div className="font-mono text-2xl text-primary/70">{examResult.score}/45</div></div>
                {examResult.overall_feedback && <div className="card-cyber p-4 text-sm text-foreground leading-7">{examResult.overall_feedback}</div>}
                {examResult.sections.map((s, i) => <div key={i} className="card-cyber p-4"><div className="font-mono text-[10px] text-muted-foreground tracking-wider mb-1">{s.name}</div><div className="font-semibold text-foreground text-sm mb-2">{s.marks_awarded}/{s.marks_total} marks</div><div className="text-sm text-foreground/80 leading-7">{s.feedback}</div></div>)}
                <button onClick={() => { setExamPhase('idle'); setExamSecs([]); setExamAns({}); setExamResult(null); setStarted(false); }} className="w-full py-3 rounded-xl border border-primary text-primary text-sm font-semibold mb-4">↺ Take Another Exam</button>
              </div>
            )}

            {/* Quiz loading */}
            {mode === 'quiz' && (quizPhase === 'loading' || quizPhase === 'grading') && (
              <div className="flex-1 flex items-center justify-center"><div className="flex gap-1.5"><span className="dot-pulse" /><span className="dot-pulse" /><span className="dot-pulse" /></div></div>
            )}

            {/* Chat view */}
            {(mode === 'learn' || mode === 'lab' || mode === 'scenario' || (mode === 'quiz' && quizPhase === 'idle') || (mode === 'exam' && examPhase === 'idle')) && (
              <>
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-h-0">
                  {!topic && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-12">
                      <div className="text-5xl">🛡️</div>
                      <div><h2 className="text-xl font-bold text-foreground mb-2">CyberMentor AI Tutor</h2><p className="text-sm text-muted-foreground max-w-xs">Select a topic from the sidebar to begin. Your progress saves automatically.</p></div>
                      <button onClick={() => setSidebarOpen(true)} className="md:hidden flex items-center gap-2 px-5 py-3 rounded-xl border border-primary/40 text-primary text-sm font-medium"><Menu className="h-4 w-4" /> Open Topics</button>
                    </div>
                  )}
                  {topic && !started && (
                    <div className="flex flex-col items-center justify-center py-12 gap-5 text-center">
                      <div className="text-4xl">{mode === 'learn' ? '📖' : mode === 'quiz' ? '❓' : mode === 'lab' ? '🧪' : '🏢'}</div>
                      <div>
                        <h2 className="font-bold text-xl text-foreground mb-1">{topic.title}</h2>
                        <p className="text-sm text-muted-foreground max-w-xs">
                          {mode === 'learn' && 'Guided teaching with depth, analogies, and real-world examples.'}
                          {mode === 'quiz' && '10 questions — answer all, then submit at once.'}
                          {mode === 'exam' && '45-mark exam with a 45-minute timer.'}
                          {mode === 'lab' && 'Hands-on. Run real commands and paste output here.'}
                          {mode === 'scenario' && 'Real client brief. Reason through architecture and security controls.'}
                        </p>
                      </div>
                      <button onClick={startSession} className="px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 min-h-[48px]">
                        {mode === 'exam' ? 'Generate Exam' : mode === 'quiz' ? 'Start Quiz' : 'Start →'}
                      </button>
                    </div>
                  )}
                  {messages.filter(m => !m.isSummary).map((m, i) => (
                    <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${m.role === 'assistant' ? 'bg-primary/15 border border-primary/25 text-primary' : 'bg-secondary border border-border text-muted-foreground text-xs font-mono'}`}>
                        {m.role === 'assistant' ? '🛡' : user?.display_name?.charAt(0).toUpperCase() ?? 'U'}
                      </div>
                      <div className={`max-w-[85%] ${m.role === 'assistant' ? 'tutor-bubble-ai' : 'tutor-bubble-user'}`} dangerouslySetInnerHTML={{ __html: renderMD(m.content) }} />
                    </div>
                  ))}
                  {(loading || summarising) && <div className="flex gap-3"><div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-sm flex-shrink-0">🛡</div><div className="tutor-bubble-ai flex items-center gap-1.5"><span className="dot-pulse" /><span className="dot-pulse" /><span className="dot-pulse" /></div></div>}
                  {error && <p className="text-xs text-destructive font-mono px-1">⚠ {error}</p>}
                  <div ref={msgsEnd} />
                </div>
                {started && mode !== 'quiz' && mode !== 'exam' && (
                  <div className="border-t border-border bg-card/50 p-3 flex-shrink-0">
                    <div className="flex gap-2 items-end">
                      <textarea ref={taRef} rows={1} value={input}
                        placeholder={mode === 'lab' ? 'Paste your terminal output...' : mode === 'scenario' ? 'Your analysis...' : 'Answer or ask anything...'}
                        className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground resize-none min-h-[46px] max-h-[120px] outline-none focus:border-primary/50 transition-colors"
                        onChange={e => { setInput(e.target.value); if (taRef.current) { taRef.current.style.height = 'auto'; taRef.current.style.height = Math.min(taRef.current.scrollHeight, 120) + 'px'; } }}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
                      <button onClick={send} disabled={loading || !input.trim()} className="w-11 h-11 flex-shrink-0 bg-primary rounded-xl flex items-center justify-center hover:bg-primary/90 disabled:opacity-30"><Send className="h-4 w-4 text-primary-foreground" /></button>
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground mt-2 px-1">ENTER send · SHIFT+ENTER new line · type "quiz me", "exam", "lab", "scenario" to switch modes</p>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
