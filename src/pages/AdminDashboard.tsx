// src/pages/AdminDashboard.tsx
import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Download, AlertCircle, RefreshCw, Plus, Edit2, Check, X, ArchiveRestore, Archive, Eye, EyeOff, Flag, Calendar } from 'lucide-react';
import Layout from '@/components/Layout';
import { useAuth } from '@/lib/auth-context';
import { useCourses } from '@/lib/courses-context';
import { useContributions } from '@/lib/contributions-context';
import { supabase } from '@/integrations/supabase/client';
import { log, type LogEntry } from '@/lib/logger';
import { toast } from 'sonner';
import type { Course } from '@/lib/placeholder-data';

type Tab = 'pending-users' | 'all-users' | 'contributions' | 'courses' | 'study-notes' | 'topic-flags' | 'exam-dates' | 'diagnostics';

const LEVEL_COLORS: Record<string, string> = {
  error: 'text-red-400', warn: 'text-orange-400',
  network: 'text-blue-400', info: 'text-primary', debug: 'text-muted-foreground',
};

// ── Blank course form state ────────────────────────────────────────────────────
const blankForm = () => ({
  code: '', title: '', description: '', yearLevel: '1', semester: '1', department: 'cybersecurity',
});

const AdminDashboard = () => {
  const { user, allUsers, verifyUser, rejectUser, promoteToAdmin, demoteFromAdmin, promoteToTrusted, demoteFromTrusted } = useAuth();
  const { allCourses, loading: coursesLoading, addCourse, updateCourse, archiveCourse, restoreCourse, toggleVisibility } = useCourses();
  const { contributions, studyNotes, adminApprove, adminReject, forceRegenerateStudyNote, isAutoGenerating } = useContributions();

  const [tab, setTab] = useState<Tab>('pending-users');

  // User modals
  const [rejectNote, setRejectNote] = useState('');
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  // Contribution modals
  const [contribRejectReason, setContribRejectReason] = useState('');
  const [contribRejectTarget, setContribRejectTarget] = useState<string | null>(null);

  // Course form
  const [courseForm, setCourseForm] = useState(blankForm());
  const [editingCourse, setEditingCourse] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(blankForm());
  const [courseTab, setCourseTab] = useState<'active' | 'archived'>('active');

  // Topic flags
  const [topicFlags, setTopicFlags] = useState<{ course_id: string; topic_name: string; count: number }[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(false);

  // Exam dates
  const [examDates, setExamDates] = useState<{ id: string; course_id: string; exam_date: string; exam_type: string; label: string | null }[]>([]);
  const [examForm, setExamForm] = useState({ courseId: '', examDate: '', examType: 'main', label: '' });
  const [examLoading, setExamLoading] = useState(false);

  // Diagnostics
  const [logEntries, setLogEntries] = useState<LogEntry[]>(() => log.entries);
  const [logFilter, setLogFilter] = useState('all');
  const [logSearch, setLogSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (tab !== 'diagnostics' || !autoRefresh) return;
    const t = setInterval(() => setLogEntries(log.entries), 2000);
    return () => clearInterval(t);
  }, [tab, autoRefresh]);

  useEffect(() => {
    if (tab === 'diagnostics') setLogEntries(log.entries);
  }, [tab]);

  // Load topic flags when tab opens
  useEffect(() => {
    if (tab !== 'topic-flags') return;
    setFlagsLoading(true);
    supabase.rpc('get_topic_flag_counts' as never).then(({ data, error }) => {
      if (!error && data) {
        setTopicFlags(data as { course_id: string; topic_name: string; count: number }[]);
      } else {
        // Fallback: manual group-by query
        supabase.from('topic_flags').select('course_id, topic_name').then(({ data: rows }) => {
          if (!rows) return;
          const counts: Record<string, number> = {};
          rows.forEach(r => {
            const key = `${r.course_id}|||${r.topic_name}`;
            counts[key] = (counts[key] || 0) + 1;
          });
          const result = Object.entries(counts)
            .map(([key, count]) => {
              const [course_id, topic_name] = key.split('|||');
              return { course_id, topic_name, count };
            })
            .sort((a, b) => b.count - a.count);
          setTopicFlags(result);
        });
      }
      setFlagsLoading(false);
    });
  }, [tab]);

  // Load exam dates when tab opens
  useEffect(() => {
    if (tab !== 'exam-dates') return;
    setExamLoading(true);
    supabase.from('exam_dates').select('*').order('exam_date').then(({ data }) => {
      if (data) setExamDates(data);
      setExamLoading(false);
    });
  }, [tab]);

  if (!user || user.tier !== 'admin') return <Navigate to="/" />;

  const pendingUsers = allUsers.filter(u => u.status === 'pending');
  const aiAccepted = contributions.filter(c => c.status === 'ai_accepted');
  const activeCourses = allCourses.filter(c => c.active);
  const archivedCourses = allCourses.filter(c => !c.active);

  const stats = {
    totalUsers: allUsers.length,
    totalContribs: contributions.length,
    totalNotes: Object.keys(studyNotes).length,
    pendingCount: pendingUsers.length,
  };

  const tabs: { key: Tab; label: string; count?: number; dot?: boolean }[] = [
    { key: 'pending-users', label: 'Pending Users', count: pendingUsers.length },
    { key: 'all-users', label: 'All Users' },
    { key: 'contributions', label: 'Contributions', count: aiAccepted.length },
    { key: 'courses', label: 'Courses' },
    { key: 'study-notes', label: 'Study Notes' },
    { key: 'topic-flags', label: 'Topic Flags' },
    { key: 'exam-dates', label: 'Exam Dates' },
    { key: 'diagnostics', label: 'Diagnostics', dot: log.errorCount > 0 },
  ];

  // ── Course helpers ─────────────────────────────────────────────────────────
  const handleAddCourse = async () => {
    if (!courseForm.code || !courseForm.title) { toast.error('Code and title required'); return; }
    await addCourse({
      id: courseForm.code.toLowerCase().replace(/\s+/g, ''),
      code: courseForm.code.toUpperCase(),
      title: courseForm.title,
      description: courseForm.description,
      yearLevel: Number(courseForm.yearLevel),
      semester: Number(courseForm.semester),
      department: courseForm.department,
      prerequisites: [],
      leadsTo: [],
      visible: true,
    });
    setCourseForm(blankForm());
  };

  const startEdit = (c: Course) => {
    setEditingCourse(c.id);
    setEditForm({
      code: c.code, title: c.title, description: c.description ?? '',
      yearLevel: String(c.yearLevel), semester: String(c.semester),
      department: (c as any).department ?? 'cybersecurity',
    });
  };

  const saveEdit = async (id: string) => {
    await updateCourse(id, {
      code: editForm.code,
      title: editForm.title,
      description: editForm.description,
      yearLevel: Number(editForm.yearLevel),
      semester: Number(editForm.semester),
      department: editForm.department,
    });
    setEditingCourse(null);
  };

  // ── Exam date helpers ──────────────────────────────────────────────────────
  const handleAddExamDate = async () => {
    if (!examForm.courseId || !examForm.examDate) { toast.error('Course and date required'); return; }
    const { data, error } = await supabase.from('exam_dates').upsert(
      {
        course_id: examForm.courseId,
        exam_date: examForm.examDate,
        exam_type: examForm.examType,
        label: examForm.label || null,
        created_by: user.id,
      },
      { onConflict: 'course_id,exam_type' }
    ).select().single();
    if (error) { toast.error('Failed to save exam date'); return; }
    setExamDates(prev => {
      const filtered = prev.filter(e => !(e.course_id === examForm.courseId && e.exam_type === examForm.examType));
      return [...filtered, data];
    });
    toast.success('Exam date saved');
    setExamForm({ courseId: '', examDate: '', examType: 'main', label: '' });
  };

  const deleteExamDate = async (id: string) => {
    await supabase.from('exam_dates').delete().eq('id', id);
    setExamDates(prev => prev.filter(e => e.id !== id));
    toast.success('Exam date removed');
  };

  // ── Diagnostics ────────────────────────────────────────────────────────────
  const filteredLog = logEntries.filter(e => {
    const matchLevel = logFilter === 'all' || e.level === logFilter;
    const matchSearch = !logSearch || e.msg.toLowerCase().includes(logSearch.toLowerCase()) || e.module.toLowerCase().includes(logSearch.toLowerCase());
    return matchLevel && matchSearch;
  }).slice().reverse();

  const errorCount = logEntries.filter(e => e.level === 'error').length;
  const networkErrors = logEntries.filter(e => e.level === 'error' && e.module === 'network').length;
  const warnCount = logEntries.filter(e => e.level === 'warn').length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <button onClick={() => log.download()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors font-mono">
            <Download className="h-4 w-4" /> Download Log
            {log.errorCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive text-xs font-bold">{log.errorCount} err</span>}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Users', value: stats.totalUsers },
            { label: 'Contributions', value: stats.totalContribs },
            { label: 'Study Notes', value: stats.totalNotes },
            { label: 'Pending', value: stats.pendingCount },
          ].map(s => (
            <div key={s.label} className="card-cyber p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 flex-wrap">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${tab === t.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {t.label}
              {t.count !== undefined && t.count > 0 && <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded-full text-xs">{t.count}</span>}
              {t.dot && <span className="w-2 h-2 rounded-full bg-destructive flex-shrink-0" />}
            </button>
          ))}
        </div>

        {/* ── Pending Users ──────────────────────────────────────────────────── */}
        {tab === 'pending-users' && (
          <div className="space-y-3">
            {pendingUsers.length === 0 ? <p className="text-muted-foreground text-sm">No pending users.</p>
              : pendingUsers.map(u => (
                <div key={u.id} className="card-cyber p-4 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{u.display_name}</p>
                    <p className="text-xs text-muted-foreground">{u.mat_number} · Year {u.year_level}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => verifyUser(u.id)} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs min-h-[34px]">Verify</button>
                    {rejectTarget === u.id ? (
                      <div className="flex gap-1">
                        <input value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Reason..." className="px-2 py-1 rounded bg-background border border-border text-xs w-32" />
                        <button onClick={() => { rejectUser(u.id, rejectNote); setRejectTarget(null); setRejectNote(''); }} className="px-2 py-1 rounded bg-destructive text-destructive-foreground text-xs">Confirm</button>
                        <button onClick={() => setRejectTarget(null)} className="px-2 py-1 rounded bg-secondary text-xs">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setRejectTarget(u.id)} className="px-3 py-1.5 rounded-lg border border-destructive text-destructive text-xs min-h-[34px]">Reject</button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* ── All Users ──────────────────────────────────────────────────────── */}
        {tab === 'all-users' && (
          <div className="space-y-3">
            {allUsers.map(u => (
              <div key={u.id} className="card-cyber p-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="font-semibold text-foreground">{u.display_name} <span className="text-xs text-muted-foreground">({u.mat_number})</span></p>
                  <p className="text-xs text-muted-foreground">Year {u.year_level} · {u.tier} · {u.status}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {u.tier !== 'admin' && <button onClick={() => promoteToAdmin(u.id)} className="text-xs px-2 py-1.5 rounded bg-secondary text-muted-foreground hover:text-foreground min-h-[32px]">→ Admin</button>}
                  {u.tier === 'admin' && u.id !== user.id && <button onClick={() => demoteFromAdmin(u.id)} className="text-xs px-2 py-1.5 rounded bg-secondary text-muted-foreground hover:text-foreground min-h-[32px]">Demote</button>}
                  {u.tier === 'verified_student' && <button onClick={() => promoteToTrusted(u.id)} className="text-xs px-2 py-1.5 rounded bg-secondary text-muted-foreground hover:text-foreground min-h-[32px]">→ Trusted</button>}
                  {u.tier === 'trusted_contributor' && <button onClick={() => demoteFromTrusted(u.id)} className="text-xs px-2 py-1.5 rounded bg-secondary text-muted-foreground hover:text-foreground min-h-[32px]">Demote</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Contributions ──────────────────────────────────────────────────── */}
        {tab === 'contributions' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-2">Pending Admin Review ({aiAccepted.length})</h3>
            {aiAccepted.length === 0 ? <p className="text-muted-foreground text-sm">No contributions pending review.</p>
              : aiAccepted.map(c => (
                <div key={c.id} className="card-cyber p-4">
                  <h4 className="font-semibold text-foreground mb-1">{c.title}</h4>
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-3">{c.content}</p>
                  <p className="text-xs text-muted-foreground mb-3">by {c.authorName} · {c.contentType}</p>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => adminApprove(c.id, 'accepted_as_is', user.display_name)} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs min-h-[34px]">Accept As-Is</button>
                    <button onClick={() => adminApprove(c.id, 'accepted_with_edits', user.display_name)} className="px-3 py-1.5 rounded-lg bg-primary/70 text-primary-foreground text-xs min-h-[34px]">Accept w/ Edits</button>
                    {contribRejectTarget === c.id ? (
                      <div className="flex gap-1">
                        <input value={contribRejectReason} onChange={e => setContribRejectReason(e.target.value)} placeholder="Reason..." className="px-2 py-1 rounded bg-background border border-border text-xs w-32" />
                        <button onClick={() => { adminReject(c.id, contribRejectReason, user.display_name); setContribRejectTarget(null); setContribRejectReason(''); }} className="px-2 py-1 rounded bg-destructive text-destructive-foreground text-xs">Reject</button>
                      </div>
                    ) : (
                      <button onClick={() => setContribRejectTarget(c.id)} className="px-3 py-1.5 rounded-lg border border-destructive text-destructive text-xs min-h-[34px]">Reject</button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* ── Courses ────────────────────────────────────────────────────────── */}
        {tab === 'courses' && (
          <div>
            {/* Add course form */}
            <div className="card-cyber p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Plus className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">Add New Course</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <input value={courseForm.code} onChange={e => setCourseForm(p => ({ ...p, code: e.target.value }))} placeholder="Code (e.g. CYB 302)" className="px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:border-primary focus:outline-none" />
                <input value={courseForm.title} onChange={e => setCourseForm(p => ({ ...p, title: e.target.value }))} placeholder="Title" className="px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:border-primary focus:outline-none" />
                <input value={courseForm.description} onChange={e => setCourseForm(p => ({ ...p, description: e.target.value }))} placeholder="Description (optional)" className="px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:border-primary focus:outline-none sm:col-span-2" />
                <select value={courseForm.yearLevel} onChange={e => setCourseForm(p => ({ ...p, yearLevel: e.target.value }))} className="px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground">
                  {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
                </select>
                <select value={courseForm.semester} onChange={e => setCourseForm(p => ({ ...p, semester: e.target.value }))} className="px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground">
                  <option value="1">Semester 1</option>
                  <option value="2">Semester 2</option>
                </select>
              </div>
              <button onClick={handleAddCourse} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium min-h-[40px] hover:bg-primary/90 transition-colors">
                Add Course
              </button>
            </div>

            {/* Active / Archived toggle */}
            <div className="flex gap-2 mb-4">
              <button onClick={() => setCourseTab('active')} className={`px-4 py-2 rounded-lg text-sm transition-colors ${courseTab === 'active' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                Active ({activeCourses.length})
              </button>
              <button onClick={() => setCourseTab('archived')} className={`px-4 py-2 rounded-lg text-sm transition-colors ${courseTab === 'archived' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                Archived ({archivedCourses.length})
              </button>
            </div>

            {courseTab === 'archived' && archivedCourses.length > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
                ℹ️ Archived courses are hidden from students but all contributions, study notes, and past questions are fully preserved. Restore a course to bring it back instantly.
              </div>
            )}

            {/* Course list */}
            <div className="space-y-3">
              {(courseTab === 'active' ? activeCourses : archivedCourses).map(c => (
                <div key={c.id} className="card-cyber p-4">
                  {editingCourse === c.id ? (
                    // ── Edit mode ──────────────────────────────────────────
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input value={editForm.code} onChange={e => setEditForm(p => ({ ...p, code: e.target.value }))} className="px-3 py-2 rounded-lg bg-background border border-primary text-sm text-foreground focus:outline-none" placeholder="Code" />
                        <input value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} className="px-3 py-2 rounded-lg bg-background border border-primary text-sm text-foreground focus:outline-none" placeholder="Title" />
                        <input value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} className="px-3 py-2 rounded-lg bg-background border border-primary text-sm text-foreground focus:outline-none sm:col-span-2" placeholder="Description" />
                        <select value={editForm.yearLevel} onChange={e => setEditForm(p => ({ ...p, yearLevel: e.target.value }))} className="px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground">
                          {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
                        </select>
                        <select value={editForm.semester} onChange={e => setEditForm(p => ({ ...p, semester: e.target.value }))} className="px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground">
                          <option value="1">Semester 1</option>
                          <option value="2">Semester 2</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(c.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs min-h-[34px]"><Check className="w-3.5 h-3.5" /> Save</button>
                        <button onClick={() => setEditingCourse(null)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground text-xs min-h-[34px]"><X className="w-3.5 h-3.5" /> Cancel</button>
                      </div>
                    </div>
                  ) : (
                    // ── View mode ──────────────────────────────────────────
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="badge-code">{c.code}</span>
                          <span className="font-semibold text-foreground text-sm">{c.title}</span>
                          {!c.visible && c.active && <span className="text-xs text-yellow-400 border border-yellow-400/30 px-1.5 py-0.5 rounded">Hidden</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Year {c.yearLevel} · Semester {c.semester}</p>
                        {c.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.description}</p>}
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {c.active ? (
                          <>
                            <button onClick={() => startEdit(c)} title="Edit" className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors min-h-[34px]"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => toggleVisibility(c.id)} title={c.visible ? 'Hide from students' : 'Show to students'} className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors min-h-[34px]">
                              {c.visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => archiveCourse(c.id)} title="Archive course (preserves all data)" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-orange-400/40 text-orange-400 text-xs hover:bg-orange-400/10 transition-colors min-h-[34px]">
                              <Archive className="w-3.5 h-3.5" /> Archive
                            </button>
                          </>
                        ) : (
                          <button onClick={() => restoreCourse(c.id)} title="Restore course" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs hover:bg-primary/20 transition-colors min-h-[34px]">
                            <ArchiveRestore className="w-3.5 h-3.5" /> Restore
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {(courseTab === 'active' ? activeCourses : archivedCourses).length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-8">
                  {courseTab === 'active' ? 'No active courses.' : 'No archived courses.'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Study Notes ────────────────────────────────────────────────────── */}
        {tab === 'study-notes' && (
          <div className="space-y-3">
            {activeCourses.map(c => {
              const note = studyNotes[c.id];
              return (
                <div key={c.id} className="card-cyber p-4 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <span className="badge-code mr-2">{c.code}</span>
                    <span className="text-foreground text-sm">{c.title}</span>
                    {note
                      ? <span className="text-xs text-primary ml-2">Generated {new Date(note.generatedAt).toLocaleDateString()}</span>
                      : <span className="text-xs text-muted-foreground ml-2">Not generated</span>}
                  </div>
                  <button onClick={() => forceRegenerateStudyNote(c.id)} disabled={isAutoGenerating}
                    className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 min-h-[34px]">
                    {isAutoGenerating ? 'Generating...' : '⟳ Generate'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Topic Flags ────────────────────────────────────────────────────── */}
        {tab === 'topic-flags' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Flag className="w-4 h-4 text-primary" />
              <p className="text-sm text-muted-foreground">Students anonymously flag topics they struggle with. Use this to prioritise which course material needs improvement.</p>
            </div>
            {flagsLoading ? (
              <p className="text-muted-foreground text-sm animate-pulse">Loading flags...</p>
            ) : topicFlags.length === 0 ? (
              <p className="text-muted-foreground text-sm">No topic flags yet. Flags appear when students click "I don't understand this" on course pages.</p>
            ) : (
              <div className="space-y-2">
                {topicFlags.map((f, i) => {
                  const course = allCourses.find(c => c.id === f.course_id);
                  const maxCount = topicFlags[0]?.count || 1;
                  return (
                    <div key={i} className="card-cyber p-4 flex items-center gap-4">
                      <div className="w-8 text-center">
                        <span className={`text-lg font-bold ${f.count >= 10 ? 'text-red-400' : f.count >= 5 ? 'text-yellow-400' : 'text-primary'}`}>
                          {f.count}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{f.topic_name}</p>
                        <p className="text-xs text-muted-foreground">{course?.code ?? f.course_id} — {course?.title}</p>
                        <div className="mt-1.5 bg-secondary rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${(f.count / maxCount) * 100}%` }} />
                        </div>
                      </div>
                      {f.count >= 5 && (
                        <span className="text-xs px-2 py-1 rounded-full bg-red-400/10 text-red-400 border border-red-400/20">High priority</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Exam Dates ─────────────────────────────────────────────────────── */}
        {tab === 'exam-dates' && (
          <div>
            <div className="card-cyber p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">Set Exam Date</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <select value={examForm.courseId} onChange={e => setExamForm(p => ({ ...p, courseId: e.target.value }))} className="px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:border-primary focus:outline-none">
                  <option value="">Select course...</option>
                  {activeCourses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
                </select>
                <input type="date" value={examForm.examDate} onChange={e => setExamForm(p => ({ ...p, examDate: e.target.value }))} className="px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:border-primary focus:outline-none" />
                <select value={examForm.examType} onChange={e => setExamForm(p => ({ ...p, examType: e.target.value }))} className="px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground">
                  <option value="main">Main Exam</option>
                  <option value="test">Mid-semester Test</option>
                  <option value="supplementary">Supplementary</option>
                  <option value="assignment">Assignment Deadline</option>
                </select>
                <input value={examForm.label} onChange={e => setExamForm(p => ({ ...p, label: e.target.value }))} placeholder="Label (optional, e.g. '2nd CA Test')" className="px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:border-primary focus:outline-none" />
              </div>
              <button onClick={handleAddExamDate} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium min-h-[40px] hover:bg-primary/90 transition-colors">
                Save Exam Date
              </button>
            </div>

            {examLoading ? <p className="text-muted-foreground text-sm animate-pulse">Loading...</p>
              : examDates.length === 0 ? <p className="text-muted-foreground text-sm">No exam dates set yet.</p>
                : (
                  <div className="space-y-3">
                    {examDates.map(e => {
                      const course = allCourses.find(c => c.id === e.course_id);
                      const days = Math.ceil((new Date(e.exam_date).getTime() - Date.now()) / 86400000);
                      return (
                        <div key={e.id} className="card-cyber p-4 flex items-center justify-between flex-wrap gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="badge-code">{course?.code ?? e.course_id}</span>
                              <span className="text-sm font-medium text-foreground">{e.label || e.exam_type}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(e.exam_date).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                              {days > 0 ? ` · ${days} days away` : days === 0 ? ' · TODAY' : ' · Past'}
                            </p>
                          </div>
                          <button onClick={() => deleteExamDate(e.id)} className="text-xs px-2.5 py-1.5 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors min-h-[34px]">Remove</button>
                        </div>
                      );
                    })}
                  </div>
                )}
          </div>
        )}

        {/* ── Diagnostics ─────────────────────────────────────────────────────── */}
        {tab === 'diagnostics' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Entries', value: logEntries.length, color: 'text-foreground' },
                { label: 'Errors', value: errorCount, color: errorCount > 0 ? 'text-destructive' : 'text-foreground' },
                { label: 'Network Errs', value: networkErrors, color: networkErrors > 0 ? 'text-orange-400' : 'text-foreground' },
                { label: 'Warnings', value: warnCount, color: warnCount > 0 ? 'text-yellow-400' : 'text-foreground' },
              ].map(s => (
                <div key={s.label} className="card-cyber p-3 text-center">
                  <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <input value={logSearch} onChange={e => setLogSearch(e.target.value)} placeholder="Search logs..." className="flex-1 min-w-[160px] px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
              <select value={logFilter} onChange={e => setLogFilter(e.target.value)} className="px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground">
                <option value="all">All levels</option>
                <option value="error">Errors only</option>
                <option value="warn">Warnings only</option>
                <option value="network">Network only</option>
              </select>
              <button onClick={() => setLogEntries(log.entries)} className="p-2 rounded-lg border border-border text-muted-foreground hover:text-primary transition-colors min-h-[40px]"><RefreshCw className="h-4 w-4" /></button>
              <button onClick={() => { log.clear(); setLogEntries([]); toast.success('Log cleared'); }} className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground min-h-[40px]">Clear</button>
              <button onClick={() => log.download()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium min-h-[40px]"><Download className="h-4 w-4" /> Download</button>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="accent-primary" /> Auto-refresh
              </label>
            </div>
            <div className="card-cyber overflow-hidden">
              <div className="bg-black/40 border-b border-border px-4 py-2 font-mono text-xs text-muted-foreground flex justify-between">
                <span>DIAGNOSTIC LOG — newest first</span><span>{filteredLog.length} entries</span>
              </div>
              <div className="overflow-y-auto max-h-[500px] font-mono text-xs">
                {filteredLog.length === 0 ? <div className="p-8 text-center text-muted-foreground">No entries match filter.</div>
                  : filteredLog.map((e, i) => (
                    <div key={i} className={`flex gap-3 px-4 py-1.5 border-b border-border/50 hover:bg-secondary/30 ${e.level === 'error' ? 'bg-destructive/5' : e.level === 'warn' ? 'bg-orange-500/5' : ''}`}>
                      <span className="text-muted-foreground flex-shrink-0 w-[86px]">{e.ts.slice(11, 23)}</span>
                      <span className={`flex-shrink-0 w-16 font-bold ${LEVEL_COLORS[e.level] ?? 'text-foreground'}`}>{e.level.toUpperCase()}</span>
                      <span className="text-primary/70 flex-shrink-0 w-20 truncate">[{e.module}]</span>
                      <span className="text-foreground/80 flex-1 break-all">{e.msg}{e.data && <span className="text-muted-foreground ml-2">{JSON.stringify(e.data)}</span>}</span>
                    </div>
                  ))}
              </div>
            </div>
            {errorCount > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground"><strong className="text-destructive">{errorCount} error{errorCount > 1 ? 's' : ''} detected.</strong> Download the log and share it for diagnosis.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminDashboard;
