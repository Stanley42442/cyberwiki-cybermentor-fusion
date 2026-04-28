// src/pages/CoursePage.tsx
import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Sparkles, ChevronRight, Plus, Zap, Brain, BookOpen } from 'lucide-react';
import Layout from '@/components/Layout';
import { useCourses } from '@/lib/courses-context';
import { useContributions } from '@/lib/contributions-context';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import ExamCountdownWidget from '@/components/ExamCountdownWidget';
import TopicFlagButton from '@/components/TopicFlagButton';

const typeFilters = ['All', 'written', 'pdf', 'video', 'past-question-tips'] as const;
const typeLabels: Record<string, string> = {
  written: '✏️ Written', pdf: '📄 PDF', video: '🎬 Video', 'past-question-tips': '📝 Past Q Tips',
};

const CoursePage = () => {
  const { id } = useParams();
  const { courses } = useCourses();
  const { contributions, studyNotes, forceRegenerateStudyNote, isAutoGenerating } = useContributions();
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [dbStudyNote, setDbStudyNote] = useState<string | null>(null);
  const [pastQCount, setPastQCount] = useState(0);

  const course = courses.find(c => c.id === id);

  useEffect(() => {
    if (!id) return;
    // Load study note from Supabase
    supabase.from('study_notes').select('content').eq('course_id', id).maybeSingle()
      .then(({ data }) => { if (data?.content) setDbStudyNote(data.content); });
    // Load past question count for badge
    supabase.from('past_questions').select('id', { count: 'exact', head: true }).eq('course_id', id)
      .then(({ count }) => { if (count) setPastQCount(count); });
  }, [id]);

  if (!course) {
    return <Layout><div className="flex-1 flex items-center justify-center text-muted-foreground">Course not found</div></Layout>;
  }

  const courseContribs = contributions.filter(c => c.courseId === course.id);
  const visibleContribs = courseContribs.filter(c => c.status === 'admin_approved' || c.status === 'ai_accepted');
  const filtered = activeFilter === 'All' ? visibleContribs : visibleContribs.filter(c => c.contentType === activeFilter);

  const studyNote = dbStudyNote
    ? { content: dbStudyNote, sourceCount: '?' }
    : studyNotes[course.id];

  const leadsTo = course.leadsTo?.map(cid => courses.find(c => c.id === cid)).filter(Boolean);
  const isAdmin = user?.tier === 'admin';

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 flex-1 max-w-3xl">
        <Link to={`/year/${course.yearLevel}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Year {course.yearLevel} Courses
        </Link>

        <div className="flex flex-wrap gap-2 mb-3">
          <span className="badge-code">{course.code}</span>
          <span className="badge-semester">Year {course.yearLevel}</span>
          <span className="badge-semester">Semester {course.semester}</span>
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-2">{course.title}</h1>
        <p className="text-muted-foreground text-sm mb-6">{course.description}</p>

        {/* Exam countdown + topic prioritiser */}
        <ExamCountdownWidget courseId={course.id} courseCode={course.code} />

        {/* Quick actions row */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Link
            to={`/course/${course.id}/tutor`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors min-h-[36px]"
          >
            <Brain className="h-3.5 w-3.5" /> AI Course Tutor
          </Link>
          <Link
            to={`/course/${course.id}/past-questions`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-xs font-semibold hover:border-primary/40 transition-colors min-h-[36px]"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Past Questions
            {pastQCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs">{pastQCount}</span>}
          </Link>
        </div>

        {/* AI Study Note */}
        <div className="card-cyber p-6 mb-4 border-glow">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground">AI Study Note</span>
              {studyNote && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                  ✦ Generated from {studyNote.sourceCount} sources
                </span>
              )}
            </div>
            {isAdmin && (
              <button onClick={() => forceRegenerateStudyNote(course.id)} disabled={isAutoGenerating}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 min-h-[34px]">
                {isAutoGenerating ? 'Generating...' : '⟳ Force Generate'}
              </button>
            )}
          </div>

          {studyNote ? (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                {studyNote.content.slice(0, 300)}...
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <Link to={`/course/${course.id}/study-note`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                  Read full study note <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Study notes are auto-generated when approved contributions are available for this course.
            </p>
          )}
        </div>

        {/* Leads To */}
        {leadsTo && leadsTo.length > 0 && (
          <div className="card-cyber p-6 mb-8">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Leads to</p>
            <div className="flex flex-wrap gap-2">
              {leadsTo.map((lt) => lt && (
                <Link key={lt.id} to={`/course/${lt.id}`} className="inline-flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-primary transition-colors">
                  {lt.code} — {lt.title} <ChevronRight className="h-3 w-3" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Contribution Pool */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-xl font-bold text-foreground">
            Contribution Pool{' '}
            <span className="text-muted-foreground font-normal text-sm">({visibleContribs.length} contributions)</span>
          </h2>
          <Link to={`/contribute?course=${course.id}`}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary/10 transition-colors min-h-[40px]">
            <Plus className="h-4 w-4" /> Contribute
          </Link>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {typeFilters.map((t) => (
            <button key={t} onClick={() => setActiveFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors min-h-[36px] ${activeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {t === 'All' ? 'All' : typeLabels[t] || t}
            </button>
          ))}
        </div>

        <div className="space-y-4 mb-8">
          {filtered.map((contrib) => (
            <motion.div key={contrib.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-cyber p-5">
              <div className="flex items-start gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <h3 className="font-semibold text-foreground text-sm leading-snug flex-1">{contrib.title}</h3>
                {contrib.isFastTrack && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary flex-shrink-0">
                    <Zap className="h-3 w-3" /> Fast Track
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3 whitespace-pre-line">{contrib.content}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
                <span>{contrib.authorName} · {new Date(contrib.submittedAt).toLocaleDateString()}</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="badge-semester">{typeLabels[contrib.contentType] || contrib.contentType}</span>
                  {contrib.reviewedBy && <span className="text-primary">Reviewed by {contrib.reviewedBy}</span>}
                  {contrib.reviewOutcome === 'accepted_as_is' && <span className="text-primary text-xs">★ 1.0</span>}
                  {contrib.reviewOutcome === 'accepted_with_edits' && <span className="text-primary/70 text-xs">★ 0.5</span>}
                  {/* Anonymous topic flag on each contribution title */}
                  <TopicFlagButton courseId={course.id} topicName={contrib.title} compact />
                </div>
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">No contributions of this type yet.</div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default CoursePage;
