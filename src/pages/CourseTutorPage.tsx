// src/pages/CourseTutorPage.tsx — see full version in this session's output files
// Sidebar: all courses grouped by year → click to expand → topic list
// Each topic has its own isolated conversation history (session key: course-{id}-{slug})
// Context rot handled: summarisation at 20 msgs, hard cap at 24
// Learner profile injected into every system prompt

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Menu, X, Send, RotateCcw, BookOpen, ChevronRight, Brain, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useCourses } from '@/lib/courses-context';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import SafeMarkdown from '@/components/SafeMarkdown';
import { useLearnerProfile } from '@/lib/learner-profile';

const PROXY = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-proxy`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const HISTORY_LIMIT = 24;
const SUMMARY_TRIGGER = 20;

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

async function callAI(sys: string, history: Msg[]): Promise<string> {
  const tok = await getToken();
  const safe = history.length > HISTORY_LIMIT ? history.slice(-HISTORY_LIMIT) : history;
  const res = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${tok}` },
    body: JSON.stringify({
      model: 'gemma-4-31b-it',
      system_instruction: { parts: [{ text: sys }] },
      contents: safe.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: 8192, temperature: 0.7, topP: 0.95 },
    }),
  });
  if (!res.ok) throw new Error(`Proxy ${res.status}`);
  const d = await res.json();
  if (d.error) throw new Error(d.error.message);
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function summarise(msgs: Msg[], tok: string): Promise<Msg[]> {
  const half = Math.floor(msgs.length / 2);
  const text = msgs.slice(0, half).filter(m => !m.isSummary)
    .map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`).join('\n');
  try {
    const res = await fetch(PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${tok}` },
      body: JSON.stringify({
        model: 'gemma-4-31b-it',
        system_instruction: { parts: [{ text: 'Summarise tutoring conversations. Preserve: topics covered, understanding gaps, corrections, where session ended.' }] },
        contents: [{ role: 'user', parts: [{ text: `Summarise in max 200 words:\n${text}` }] }],
        generationConfig: { maxOutputTokens: 350, temperature: 0.3 },
      }),
    });
    const d = await res.json();
    const summary = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!summary) return msgs;
    return [
      { role: 'assistant', content: `[SESSION SUMMARY]\n${summary}\n[END SUMMARY]`, isSummary: true },
      ...msgs.slice(half),
    ];
  } catch { return msgs; }
}

function buildPrompt(code: string, title: string, topicName: string, topicDesc: string, studyNote: string, profileCtx: string) {
  const noteSection = studyNote ? `\n\nCOURSE STUDY MATERIAL:\n${studyNote.slice(0, 6000)}` : '';
  return `You are an academic lecturer teaching the topic "${topicName}" within ${code} — ${title} at UNIPORT Nigeria.

FOCUS: Teach ONLY "${topicName}". ${topicDesc ? `It covers: ${topicDesc}` : ''} Do not drift to other topics.

TEACHING STYLE: Teach with the depth of a UNIPORT lecturer preparing students for 70-mark exams. ALWAYS define all terms clearly. ALWAYS use Nigerian examples. ALWAYS do a comprehension check every 2-3 concepts. Use ✅ correct, 💡 hint, ⚠️ mistake, 📝 exam tip. When a topic is fully covered, tell the student to type "quiz me" to test themselves.

EXAM: Section A definitions (40%), Section B application (40%), Section C essays (20%). Flag which type each concept targets.
${noteSection}
${profileCtx}

If you see [SESSION SUMMARY], use it for continuity without mentioning it.

CRITICAL: Your output must contain ONLY your spoken reply to the student — nothing else. Forbidden outputs: the 🛡 symbol, any "Step N:" or "Task N:" lines, bullet-point planning lists, internal reasoning such as "Wait," "Actually," "Looking at," "Correct Action:", "Revised approach:", thoughts about your own instructions, or any meta-text about what you are about to do. Do not restate these instructions. Do not output the topic or course code as a header. Start speaking as the lecturer immediately.`;
}

interface Msg { role: 'user' | 'assistant'; content: string; isSummary?: boolean }
interface CourseTopic { id: string; name: string; slug: string; description: string | null; topic_order: number }
interface QuizQ { q: string; opts: string[]; a: number }

export default function CourseTutorPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { courses } = useCourses();
  const { profileContext, maybeUpdateProfile } = useLearnerProfile(user?.id);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [topicsByCourse, setTopicsByCourse] = useState<Record<string, CourseTopic[]>>({});
  const [topicsLoading, setTopicsLoading] = useState<Record<string, boolean>>({});
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<CourseTopic | null>(null);
  const [studyNote, setStudyNote] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [summarising, setSummarising] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizPhase, setQuizPhase] = useState<'idle'|'loading'|'form'|'done'>('idle');
  const [quizQs, setQuizQs] = useState<QuizQ[]>([]);
  const [quizAns, setQuizAns] = useState<Record<number,number>>({});
  const [quizScore, setQuizScore] = useState<number|null>(null);

  const msgsEnd = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (!authLoading && !user) navigate('/login'); }, [user, authLoading, navigate]);
  useEffect(() => { msgsEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const loadTopics = useCallback(async (cid: string) => {
    if (topicsByCourse[cid] !== undefined || topicsLoading[cid]) return;
    setTopicsLoading(p => ({ ...p, [cid]: true }));
    const { data } = await supabase.from('course_topics').select('*').eq('course_id', cid).order('topic_order');
    setTopicsByCourse(p => ({ ...p, [cid]: data ?? [] }));
    setTopicsLoading(p => ({ ...p, [cid]: false }));
  }, [topicsByCourse, topicsLoading]);

  useEffect(() => {
    if (!activeCourseId) return;
    supabase.from('study_notes').select('content').eq('course_id', activeCourseId).maybeSingle()
      .then(({ data }) => setStudyNote(data?.content ?? ''));
  }, [activeCourseId]);

  const selectTopic = useCallback(async (cid: string, topic: CourseTopic) => {
    setActiveCourseId(cid); setActiveTopic(topic);
    setMessages([]); setQuizPhase('idle'); setQuizQs([]); setQuizAns({}); setQuizScore(null); setError(null);
    setSidebarOpen(false);
    if (!user) return;
    const key = `course-${cid}-${topic.slug}`;
    const { data } = await supabase.from('conversations').select('messages')
      .eq('user_id', user.id).eq('topic_id', key).eq('mode', 'course').maybeSingle();
    if (data?.messages) setMessages(data.messages as unknown as Msg[]);
  }, [user]);

  const saveConv = useCallback(async (msgs: Msg[]) => {
    if (!user || !activeTopic || !activeCourseId) return;
    const key = `course-${activeCourseId}-${activeTopic.slug}`;
    await supabase.from('conversations').upsert(
      { user_id: user.id, topic_id: key, mode: 'course', messages: msgs as unknown as Record<string,unknown>[], updated_at: new Date().toISOString() },
      { onConflict: 'user_id,topic_id,mode' }
    );
  }, [user, activeTopic, activeCourseId]);

  const condense = useCallback(async (msgs: Msg[]): Promise<Msg[]> => {
    if (msgs.length < SUMMARY_TRIGGER) return msgs;
    setSummarising(true);
    const tok = await getToken();
    const c = await summarise(msgs, tok);
    setSummarising(false);
    return c;
  }, []);

  const getPrompt = useCallback(() => {
    const course = courses.find(c => c.id === activeCourseId);
    return buildPrompt(course?.code??'', course?.title??'', activeTopic?.name??'', activeTopic?.description??'', studyNote, profileContext);
  }, [courses, activeCourseId, activeTopic, studyNote, profileContext]);

  const startSession = async () => {
    if (!activeTopic || !activeCourseId) return;
    setError(null); setLoading(true);
    const course = courses.find(c => c.id === activeCourseId);
    try {
      const reply = await callAI(getPrompt(), [{ role: 'user', content: `Introduce the topic "${activeTopic.name}" for ${course?.code ?? 'this course'}. Give a brief overview and ask where the student wants to start.` }]);
      const msgs: Msg[] = [{ role: 'assistant', content: reply }];
      setMessages(msgs); await saveConv(msgs);
    } catch (e) { setError((e as Error).message); }
    setLoading(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading || !activeTopic) return;
    setInput(''); if (taRef.current) taRef.current.style.height = 'auto';
    setError(null);
    if (/quiz\s*me/i.test(text)) { await generateQuiz(); return; }
    const userMsg: Msg = { role: 'user', content: text };
    let updated = [...messages, userMsg];
    setMessages(updated); setLoading(true);
    try {
      const condensed = await condense(updated);
      if (condensed.length !== updated.length) { updated = condensed; setMessages(condensed); }
      const reply = await callAI(getPrompt(), condensed);
      const final: Msg[] = [...condensed, { role: 'assistant', content: reply }];
      setMessages(final); await saveConv(final);
      const tok = await getToken();
      maybeUpdateProfile(final.filter(m => !m.isSummary), tok);
    } catch (e) { setError((e as Error).message); setMessages(updated); }
    setLoading(false);
  };

  const generateQuiz = async () => {
    if (!activeTopic) return;
    setQuizPhase('loading'); setLoading(true);
    try {
      const raw = await callAI(getPrompt(), [{ role: 'user', content: `Generate 10 MCQs on "${activeTopic.name}" (UNIPORT exam style). ONLY JSON array: [{"q":"...","opts":["A","B","C","D"],"a":0}]` }]);
      const parsed: QuizQ[] = JSON.parse(raw.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim());
      setQuizQs(parsed); setQuizAns({}); setQuizPhase('form');
    } catch(e) { setError('Quiz failed: '+(e as Error).message); setQuizPhase('idle'); }
    setLoading(false);
  };

  const submitQuiz = () => {
    const score = quizQs.reduce((a,q,i)=>a+(quizAns[i]===q.a?1:0),0);
    setQuizScore(score); setQuizPhase('done');
  };

  const clearChat = async () => {
    setMessages([]); setQuizPhase('idle'); setQuizQs([]); setQuizAns({}); setQuizScore(null);
    if (user && activeTopic && activeCourseId) {
      const key = `course-${activeCourseId}-${activeTopic.slug}`;
      await supabase.from('conversations').delete().eq('user_id',user.id).eq('topic_id',key).eq('mode','course');
    }
  };

  const visibleMessages = messages.filter(m => !m.isSummary);
  const condensedCount = messages.length - visibleMessages.length;
  const activeCourse = courses.find(c => c.id === activeCourseId);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden relative">
        {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />}

        {/* Sidebar */}
        <aside className={`fixed md:relative top-0 left-0 bottom-0 w-72 z-30 md:z-auto bg-sidebar border-r border-border flex flex-col overflow-hidden transition-transform duration-250 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <div><div className="font-mono text-xs text-primary tracking-widest">COURSE TUTOR</div><div className="text-xs text-muted-foreground mt-0.5">Select course & topic</div></div>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {[1,2,3,4].map(year => {
              const yc = courses.filter(c => c.yearLevel === year);
              if (!yc.length) return null;
              return (
                <div key={year}>
                  <div className="px-4 py-1.5 text-[10px] font-mono tracking-widest text-muted-foreground/60 uppercase border-t border-border mt-1">Year {year}</div>
                  {yc.map(course => {
                    const isExp = expandedCourse === course.id;
                    const topics = topicsByCourse[course.id] ?? [];
                    const isLoad = topicsLoading[course.id];
                    return (
                      <div key={course.id}>
                        <button onClick={() => { const next = isExp ? null : course.id; setExpandedCourse(next); if (next) loadTopics(next); }}
                          className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors min-h-[40px] ${activeCourseId===course.id?'bg-primary/8':'hover:bg-secondary/50'}`}>
                          <BookOpen className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0"><div className="font-mono text-[11px] text-primary">{course.code}</div><div className="text-xs text-muted-foreground truncate">{course.title}</div></div>
                          <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform flex-shrink-0 ${isExp?'rotate-90':''}`} />
                        </button>
                        {isExp && (
                          <div className="bg-black/20 border-t border-b border-border/50">
                            {isLoad ? (
                              <div className="px-6 py-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>
                            ) : topics.length === 0 ? (
                              <div className="px-6 py-3"><p className="text-xs text-muted-foreground">No topics yet.</p><p className="text-[11px] text-muted-foreground/60 mt-0.5">Topics appear after contributions are approved and a study note is generated.</p></div>
                            ) : topics.map(topic => {
                              const isActive = activeTopic?.slug===topic.slug && activeCourseId===course.id;
                              return (
                                <button key={topic.slug} onClick={() => selectTopic(course.id, topic)}
                                  className={`w-full flex items-center gap-2 pl-8 pr-4 py-2 text-left transition-colors min-h-[36px] relative ${isActive?'bg-primary/10 text-primary':'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'}`}>
                                  {isActive && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />}
                                  <span className="text-xs flex-1 truncate">{topic.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="px-3 py-3 border-t border-border flex-shrink-0">
            <Link to="/contribute" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"><span>📝</span> Add course notes</Link>
            <p className="text-[10px] text-muted-foreground/50 mt-1">Topics appear automatically when contributions are approved</p>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-card/50 flex-shrink-0 flex-wrap">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground min-w-[36px] min-h-[36px] flex items-center justify-center"><Menu className="h-4 w-4" /></button>
            <div className="flex-1 min-w-0">
              {activeTopic ? (<><div className="font-mono text-[11px] text-primary">{activeCourse?.code}</div><div className="font-semibold text-sm text-foreground truncate">{activeTopic.name}</div></>) : (<span className="text-sm text-muted-foreground">Select a course and topic</span>)}
            </div>
            <div className="flex items-center gap-2">
              {condensedCount > 0 && <span className="text-xs font-mono text-muted-foreground border border-border px-2 py-1 rounded-lg">📦 {condensedCount} condensed</span>}
              {visibleMessages.length > 0 && <button onClick={clearChat} className="p-1.5 rounded text-muted-foreground hover:text-primary transition-colors" title="Clear chat"><RotateCcw className="w-4 h-4" /></button>}
            </div>
          </div>

          {summarising && <div className="flex items-center gap-2 py-1.5 px-3 bg-primary/5 border-b border-primary/10 text-xs text-primary/70 font-mono flex-shrink-0"><span className="animate-pulse">⟳</span> Condensing history…</div>}

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-h-0">
            {!activeTopic && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-16">
                <Brain className="w-12 h-12 text-primary/30" />
                <div><p className="font-semibold text-foreground">Course AI Tutor</p><p className="text-muted-foreground text-sm mt-1 max-w-xs">Choose a course, then select a topic for a focused exam-ready session. Each topic has its own conversation history.</p></div>
                <button onClick={() => setSidebarOpen(true)} className="md:hidden flex items-center gap-2 px-5 py-3 rounded-xl border border-primary/40 text-primary text-sm font-medium"><Menu className="h-4 w-4" /> Browse Courses</button>
              </div>
            )}

            {activeTopic && visibleMessages.length === 0 && !loading && quizPhase === 'idle' && (
              <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
                <div className="text-4xl">🎓</div>
                <div>
                  <div className="font-mono text-xs text-primary mb-1">{activeCourse?.code}</div>
                  <h2 className="font-bold text-xl text-foreground mb-1">{activeTopic.name}</h2>
                  {activeTopic.description && <p className="text-sm text-muted-foreground max-w-sm mx-auto">{activeTopic.description}</p>}
                </div>
                <button onClick={startSession} className="px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 min-h-[48px]">Start Learning →</button>
                <p className="text-xs text-muted-foreground">Progress saves automatically per topic</p>
              </div>
            )}

            {condensedCount > 0 && visibleMessages.length > 0 && (
              <div className="text-center"><span className="text-xs text-muted-foreground border border-border/50 px-3 py-1 rounded-full bg-secondary/50">📦 Earlier messages condensed — context preserved</span></div>
            )}

            {visibleMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.role==='user'?'bg-primary text-primary-foreground rounded-tr-sm':'bg-secondary text-secondary-foreground rounded-tl-sm border border-border'}`}>
                  {m.role==='assistant' ? <SafeMarkdown content={m.content} /> : <p className="text-sm">{m.content}</p>}
                </div>
              </div>
            ))}

            {(loading || summarising) && <div className="flex justify-start"><div className="bg-secondary border border-border rounded-2xl rounded-tl-sm px-4 py-3"><div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}</div></div></div>}
            {error && <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 text-destructive text-sm">{error}</div>}

            {quizPhase === 'form' && (
              <div className="bg-secondary border border-border rounded-xl p-4 space-y-4">
                <p className="font-semibold text-foreground text-sm">📝 Quiz on {activeTopic?.name}</p>
                {quizQs.map((q,qi)=>(
                  <div key={qi} className="space-y-2">
                    <p className="text-sm text-foreground font-medium">{qi+1}. {q.q}</p>
                    {q.opts.map((opt,oi)=>(
                      <button key={oi} onClick={()=>setQuizAns(p=>({...p,[qi]:oi}))}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border ${quizAns[qi]===oi?'bg-primary/20 border-primary text-primary':'border-border hover:border-primary/50'}`}>
                        {String.fromCharCode(65+oi)}. {opt}
                      </button>
                    ))}
                  </div>
                ))}
                <button onClick={submitQuiz} disabled={Object.keys(quizAns).length<quizQs.length} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50">Submit Quiz</button>
              </div>
            )}

            {quizPhase==='done' && quizScore!==null && (
              <div className="bg-secondary border border-border rounded-xl p-4 space-y-3">
                <p className="font-semibold text-foreground">Result: {quizScore}/{quizQs.length} ({Math.round(quizScore/quizQs.length*100)}%){quizScore>=8?' 🔥':quizScore>=6?' ✅':' 💡'}</p>
                <div className="space-y-1.5">
                  {quizQs.map((q,qi)=>(<div key={qi} className={`text-xs p-2 rounded ${quizAns[qi]===q.a?'bg-green-500/10 text-green-400':'bg-red-500/10 text-red-400'}`}>{quizAns[qi]===q.a?'✅':'❌'} {q.q} — {q.opts[q.a]}</div>))}
                </div>
                <button onClick={()=>{setQuizPhase('idle');setQuizQs([]);setQuizAns({});setQuizScore(null);}} className="w-full py-2 border border-border rounded-lg text-sm hover:border-primary/50">Continue Learning</button>
              </div>
            )}
            <div ref={msgsEnd} />
          </div>

          {activeTopic && visibleMessages.length > 0 && (
            <div className="border-t border-border bg-card/50 p-3 flex-shrink-0">
              <div className="flex gap-2 items-end">
                <textarea ref={taRef} rows={1} value={input}
                  onChange={e=>{setInput(e.target.value);const t=e.currentTarget;t.style.height='auto';t.style.height=`${Math.min(t.scrollHeight,120)}px`;}}
                  onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}
                  placeholder={`Ask about ${activeTopic.name}… or type "quiz me"`}
                  className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-sm resize-none min-h-[46px] max-h-[120px] focus:outline-none focus:border-primary/50 transition-colors" />
                <button onClick={send} disabled={!input.trim()||loading} className="w-11 h-11 flex-shrink-0 bg-primary rounded-xl flex items-center justify-center hover:bg-primary/90 disabled:opacity-30"><Send className="h-4 w-4 text-primary-foreground" /></button>
              </div>
              <p className="text-[11px] font-mono text-muted-foreground mt-1.5 px-1">ENTER send · SHIFT+ENTER new line · "quiz me" to test yourself</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
