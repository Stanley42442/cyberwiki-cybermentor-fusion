// src/pages/PastQuestionsPage.tsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Upload, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import Layout from '@/components/Layout';
import { useCourses } from '@/lib/courses-context';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PastQuestion {
  id: string;
  year: number;
  semester: number;
  exam_type: string;
  section: string | null;
  question_text: string;
  answer_hint: string | null;
  marks: number | null;
  uploader_name: string | null;
}

const examTypeLabels: Record<string, string> = {
  main: 'Main Exam', supplementary: 'Supplementary', test: 'Mid-semester Test', assignment: 'Assignment',
};

const PastQuestionsPage = () => {
  const { id } = useParams();
  const { courses } = useCourses();
  const { user } = useAuth();

  const [questions, setQuestions] = useState<PastQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  // Upload form
  const [form, setForm] = useState({
    year: new Date().getFullYear().toString(),
    semester: '1',
    examType: 'main',
    section: '',
    questionText: '',
    answerHint: '',
    marks: '',
  });
  const [uploading, setUploading] = useState(false);

  const course = courses.find(c => c.id === id);
  const canUpload = user?.tier === 'admin' || user?.tier === 'trusted_contributor';

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    supabase.from('past_questions').select('*').eq('course_id', id).order('year', { ascending: false }).order('exam_type')
      .then(({ data }) => {
        setQuestions(data ?? []);
        setLoading(false);
      });
  }, [id]);

  if (!course) return <Layout><div className="flex-1 flex items-center justify-center text-muted-foreground">Course not found</div></Layout>;

  const availableYears = [...new Set(questions.map(q => q.year))].sort((a, b) => b - a);
  const filtered = questions
    .filter(q => yearFilter === 'all' || q.year === Number(yearFilter))
    .filter(q => typeFilter === 'all' || q.exam_type === typeFilter);

  // Group by year + type
  const grouped: Record<string, PastQuestion[]> = {};
  filtered.forEach(q => {
    const key = `${q.year}|${q.exam_type}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(q);
  });

  const handleUpload = async () => {
    if (!form.questionText.trim()) { toast.error('Question text is required'); return; }
    setUploading(true);
    const { error } = await supabase.from('past_questions').insert({
      course_id: id,
      year: Number(form.year),
      semester: Number(form.semester),
      exam_type: form.examType,
      section: form.section || null,
      question_text: form.questionText,
      answer_hint: form.answerHint || null,
      marks: form.marks ? Number(form.marks) : null,
      uploaded_by: user?.id,
      uploader_name: user?.display_name,
    });
    if (error) { toast.error('Upload failed: ' + error.message); setUploading(false); return; }

    // Reload
    const { data } = await supabase.from('past_questions').select('*').eq('course_id', id).order('year', { ascending: false });
    setQuestions(data ?? []);
    setForm({ year: new Date().getFullYear().toString(), semester: '1', examType: 'main', section: '', questionText: '', answerHint: '', marks: '' });
    setShowUpload(false);
    toast.success('Past question added');
    setUploading(false);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 flex-1 max-w-3xl">
        <Link to={`/course/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> {course.code}
        </Link>

        <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Past Questions</h1>
            </div>
            <p className="text-muted-foreground text-sm">{course.code} — {course.title}</p>
          </div>
          {canUpload && (
            <button onClick={() => setShowUpload(p => !p)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary/10 transition-colors min-h-[40px]">
              <Upload className="h-4 w-4" /> Add Question
            </button>
          )}
        </div>

        {/* Upload form */}
        {showUpload && (
          <div className="card-cyber p-5 mb-6 mt-4">
            <h3 className="font-semibold text-foreground mb-4">Add Past Question</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <input type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} placeholder="Year" className="px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:border-primary focus:outline-none" />
              <select value={form.semester} onChange={e => setForm(p => ({ ...p, semester: e.target.value }))} className="px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground">
                <option value="1">Sem 1</option><option value="2">Sem 2</option>
              </select>
              <select value={form.examType} onChange={e => setForm(p => ({ ...p, examType: e.target.value }))} className="px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground col-span-2">
                <option value="main">Main Exam</option><option value="test">Mid-semester Test</option>
                <option value="supplementary">Supplementary</option><option value="assignment">Assignment</option>
              </select>
              <input value={form.section} onChange={e => setForm(p => ({ ...p, section: e.target.value }))} placeholder="Section (e.g. Section A)" className="px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:border-primary focus:outline-none col-span-2" />
              <input type="number" value={form.marks} onChange={e => setForm(p => ({ ...p, marks: e.target.value }))} placeholder="Marks" className="px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:border-primary focus:outline-none col-span-2" />
            </div>
            <textarea value={form.questionText} onChange={e => setForm(p => ({ ...p, questionText: e.target.value }))}
              placeholder="Question text..." rows={4}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:border-primary focus:outline-none resize-none mb-3" />
            <textarea value={form.answerHint} onChange={e => setForm(p => ({ ...p, answerHint: e.target.value }))}
              placeholder="Answer hint / model answer (optional — helps AI generate practice papers)" rows={3}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:border-primary focus:outline-none resize-none mb-3" />
            <div className="flex gap-2">
              <button onClick={handleUpload} disabled={uploading}
                className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 min-h-[40px] hover:bg-primary/90 transition-colors">
                {uploading ? 'Uploading...' : 'Add Question'}
              </button>
              <button onClick={() => setShowUpload(false)} className="px-4 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm min-h-[40px]">Cancel</button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-6 mt-4 flex-wrap">
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none">
            <option value="all">All Years</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none">
            <option value="all">All Types</option>
            {Object.entries(examTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm animate-pulse">Loading past questions...</p>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-muted-foreground text-sm">No past questions yet for {course.code}.</p>
            {canUpload && <p className="text-muted-foreground text-xs mt-1">Use the "Add Question" button to start building the bank.</p>}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).sort((a, b) => {
              const [aYear] = a[0].split('|'); const [bYear] = b[0].split('|');
              return Number(bYear) - Number(aYear);
            }).map(([key, qs]) => {
              const [year, type] = key.split('|');
              return (
                <div key={key}>
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-lg font-bold text-foreground">{year}</h2>
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {examTypeLabels[type] ?? type}
                    </span>
                    <span className="text-xs text-muted-foreground">{qs.length} question{qs.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-3">
                    {qs.map((q, qi) => (
                      <div key={q.id} className="card-cyber p-4">
                        <div className="flex items-start gap-3 cursor-pointer" onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}>
                          <span className="text-primary font-mono text-sm flex-shrink-0 mt-0.5">Q{qi + 1}</span>
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm text-foreground leading-relaxed">{q.question_text}</p>
                              {expandedId === q.id
                                ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
                            </div>
                            <div className="flex gap-2 mt-1 flex-wrap">
                              {q.section && <span className="text-xs text-muted-foreground">{q.section}</span>}
                              {q.marks && <span className="text-xs text-primary/60">[{q.marks} marks]</span>}
                            </div>
                          </div>
                        </div>
                        {expandedId === q.id && q.answer_hint && (
                          <div className="mt-3 ml-7 p-3 rounded-lg bg-primary/5 border border-primary/15">
                            <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wide">Answer hint</p>
                            <p className="text-sm text-foreground/80 leading-relaxed">{q.answer_hint}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PastQuestionsPage;
