// src/components/ExamCountdownWidget.tsx
// Shows days remaining to the next exam for a course, plus a list of
// high-frequency topics extracted from past questions (AI-powered).
// Admins set exam dates in the Admin Dashboard.

import { useState, useEffect } from 'react';
import { Clock, TrendingUp, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

interface ExamDate {
  exam_date: string;
  exam_type: string;
  label: string | null;
}

interface TopicFrequency {
  topic: string;
  count: number;
}

interface Props {
  courseId: string;
  courseCode: string;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exam = new Date(dateStr);
  exam.setHours(0, 0, 0, 0);
  return Math.ceil((exam.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyColor(days: number) {
  if (days <= 7) return 'text-red-400 border-red-400/30 bg-red-400/10';
  if (days <= 21) return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10';
  return 'text-primary border-primary/30 bg-primary/10';
}

export default function ExamCountdownWidget({ courseId, courseCode }: Props) {
  const [examDate, setExamDate] = useState<ExamDate | null>(null);
  const [hotTopics, setHotTopics] = useState<TopicFrequency[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);

      // Load nearest upcoming exam date
      const { data: dateData } = await supabase
        .from('exam_dates')
        .select('exam_date, exam_type, label')
        .eq('course_id', courseId)
        .gte('exam_date', new Date().toISOString().split('T')[0])
        .order('exam_date', { ascending: true })
        .limit(1)
        .maybeSingle();

      // Load past questions to compute topic frequency
      const { data: questionsData } = await supabase
        .from('past_questions')
        .select('section, question_text')
        .eq('course_id', courseId);

      if (!mounted) return;

      if (dateData) setExamDate(dateData);

      // Extract high-frequency topics from question text using simple keyword frequency
      // This is client-side — no AI call needed. Topic names are extracted from section headers.
      if (questionsData && questionsData.length > 0) {
        const sectionCounts: Record<string, number> = {};
        questionsData.forEach(q => {
          const key = q.section?.trim() || 'General';
          sectionCounts[key] = (sectionCounts[key] || 0) + 1;
        });
        const sorted = Object.entries(sectionCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([topic, count]) => ({ topic, count }));
        setHotTopics(sorted);
      }

      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [courseId]);

  if (loading) return null; // Don't show placeholder — only render if data exists
  if (!examDate && hotTopics.length === 0) return null;

  const days = examDate ? daysUntil(examDate.exam_date) : null;
  const isPast = days !== null && days < 0;
  if (isPast) return null; // Don't show expired countdowns

  return (
    <div className="card-cyber p-5 mb-4 space-y-4">
      {/* Countdown */}
      {examDate && days !== null && (
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${urgencyColor(days)}`}>
          <Clock className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">
              {days === 0 ? '🚨 Exam is TODAY!' : days === 1 ? '⚠️ Exam TOMORROW' : `${days} days to ${examDate.label || examDate.exam_type + ' exam'}`}
            </p>
            <p className="text-xs opacity-70">
              {new Date(examDate.exam_date).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      )}

      {/* Hot topics from past questions */}
      {hotTopics.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
              High-frequency exam topics
            </p>
            <Link to={`/course/${courseId}/past-questions`} className="ml-auto text-xs text-primary hover:underline">
              View past questions →
            </Link>
          </div>
          <div className="space-y-1.5">
            {hotTopics.map(({ topic, count }, i) => (
              <div key={topic} className="flex items-center gap-2">
                <span className="text-xs w-4 text-muted-foreground">{i + 1}.</span>
                <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.round((count / hotTopics[0].count) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-foreground/80 min-w-[120px]">{topic}</span>
                <span className="text-xs text-muted-foreground">{count}×</span>
              </div>
            ))}
          </div>
          {days !== null && days <= 14 && (
            <div className="flex items-start gap-2 mt-3 p-2.5 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
              <AlertCircle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-400/90">
                Prioritise <strong>{hotTopics[0]?.topic}</strong> — it appears most in past exams for {courseCode}.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
