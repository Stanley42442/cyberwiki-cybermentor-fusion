// src/lib/contributions-context.tsx
// Contributions now live fully in Supabase. No localStorage writes for contributions.
// localStorage is only used for fingerprints (a few hundred bytes max).

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  Contribution, StudyNote,
  loadFingerprints, saveFingerprints, generateFingerprint,
} from '@/lib/placeholder-data';
import { useCourses } from '@/lib/courses-context';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ContributionsContextType {
  contributions: Contribution[];
  studyNotes: Record<string, StudyNote>;
  submitContribution: (contrib: Omit<Contribution, 'id' | 'status' | 'submittedAt' | 'isFastTrack'>) => Promise<void>;
  editContribution: (id: string, updates: Partial<Contribution>) => void;
  adminApprove: (id: string, outcome: 'accepted_as_is' | 'accepted_with_edits', reviewerName: string) => void;
  adminReject: (id: string, reason: string, reviewerName: string) => void;
  forceRegenerateStudyNote: (courseId: string) => Promise<void>;
  isAIProcessing: boolean;
  isAutoGenerating: boolean;
  unreadCount: number;
}

const ContributionsContext = createContext<ContributionsContextType | undefined>(undefined);

function rowToContribution(row: Record<string, unknown>): Contribution {
  return {
    id: row.id as string,
    courseId: row.course_id as string,
    contentType: row.content_type as Contribution['contentType'],
    title: row.title as string,
    content: row.content as string,
    pdfUrl: row.pdf_url as string | undefined,
    videoUrl: row.video_url as string | undefined,
    whatItAdds: row.what_it_adds as string | undefined,
    authorMatNumber: row.author_mat_number as string,
    authorName: row.author_name as string,
    status: row.status as Contribution['status'],
    isFastTrack: row.is_fast_track as boolean,
    aiRejectionReason: row.ai_rejection_reason as string | undefined,
    submittedAt: row.submitted_at as string,
    reviewedAt: row.reviewed_at as string | undefined,
    reviewedBy: row.reviewed_by as string | undefined,
    accuracyScore: row.accuracy_score as number | undefined,
    isEdited: row.is_edited as boolean | undefined,
    reviewOutcome: row.review_outcome as Contribution['reviewOutcome'],
  };
}

function contributionToRow(c: Contribution): Record<string, unknown> {
  return {
    id: c.id,
    course_id: c.courseId,
    content_type: c.contentType,
    title: c.title,
    content: c.content,
    pdf_url: c.pdfUrl ?? null,
    video_url: c.videoUrl ?? null,
    what_it_adds: c.whatItAdds ?? null,
    author_mat_number: c.authorMatNumber,
    author_name: c.authorName,
    status: c.status,
    is_fast_track: c.isFastTrack,
    ai_rejection_reason: c.aiRejectionReason ?? null,
    submitted_at: c.submittedAt,
    reviewed_at: c.reviewedAt ?? null,
    reviewed_by: c.reviewedBy ?? null,
    accuracy_score: c.accuracyScore ?? null,
    is_edited: c.isEdited ?? false,
    review_outcome: c.reviewOutcome ?? null,
    updated_at: new Date().toISOString(),
  };
}

export const ContributionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [studyNotes, setStudyNotes] = useState<Record<string, StudyNote>>({});
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { courses } = useCourses();
  const { user, addNotification, allUsers } = useAuth();
  const autoGenRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const studyNotesRef = useRef(studyNotes);
  studyNotesRef.current = studyNotes;
  const contributionsRef = useRef(contributions);
  contributionsRef.current = contributions;
  const coursesRef = useRef(courses);
  coursesRef.current = courses;

  // Load contributions from Supabase
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('contributions').select('*').order('submitted_at', { ascending: false });
      if (error) { console.error('[contributions] Load failed:', error.message); setLoaded(true); return; }
      setContributions((data ?? []).map(r => rowToContribution(r as Record<string, unknown>)));
      setLoaded(true);
    })();
  }, []);

  // Load study notes from Supabase
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('study_notes').select('*');
      if (!data) return;
      const notes: Record<string, StudyNote> = {};
      data.forEach(r => {
        notes[r.course_id] = { content: r.content, generatedAt: r.generated_at, sourceCount: r.source_count ?? 0 };
      });
      setStudyNotes(notes);
    })();
  }, []);

  // Upsert single contribution to Supabase
  const persist = useCallback(async (updated: Contribution[], changedId?: string) => {
    setContributions(updated);
    if (!changedId) return;
    const c = updated.find(x => x.id === changedId);
    if (!c) return;
    const { error } = await supabase.from('contributions').upsert(contributionToRow(c), { onConflict: 'id' });
    if (error) console.error('[contributions] Upsert failed:', error.message);
  }, []);

  // Save study note to Supabase only - never localStorage
  const persistNotes = useCallback(async (updated: Record<string, StudyNote>, changedCourseId?: string) => {
    setStudyNotes(updated);
    if (!changedCourseId || !updated[changedCourseId]) return;
    const note = updated[changedCourseId];
    await supabase.from('study_notes').upsert(
      { course_id: changedCourseId, content: note.content, source_count: note.sourceCount, generated_at: note.generatedAt },
      { onConflict: 'course_id' }
    );
  }, []);

  const notifyAdmins = useCallback((message: string, contributionId: string) => {
    allUsers.filter(u => u.tier === 'admin').forEach(admin =>
      addNotification({ userId: admin.id, type: 'relevance_flagged', message, contributionId, read: false })
    );
  }, [allUsers, addNotification]);

  // Auto-generate study notes - stable callback using refs
  const checkAndGenerateNotes = useCallback(async () => {
    if (!loaded) return;
    const contribs = contributionsRef.current;
    const allCourses = coursesRef.current;
    const notes = studyNotesRef.current;
    const fingerprints = loadFingerprints();
    const approvedByCourse: Record<string, Contribution[]> = {};
    contribs.filter(c => c.status === 'admin_approved').forEach(c => {
      if (!approvedByCourse[c.courseId]) approvedByCourse[c.courseId] = [];
      approvedByCourse[c.courseId].push(c);
    });
    for (const courseId of Object.keys(approvedByCourse)) {
      const fp = generateFingerprint(approvedByCourse[courseId]);
      if (fingerprints[courseId] === fp) continue;
      const course = allCourses.find(c => c.id === courseId);
      if (!course) continue;
      setIsAutoGenerating(true);
      try {
        const { data, error } = await supabase.functions.invoke('generate-study-note', {
          body: {
            courseTitle: course.title, courseCode: course.code, courseDescription: course.description,
            courseId,  // needed for automatic topic extraction after generation
            contributions: approvedByCourse[courseId].map(c => ({ title: c.title, content: c.content, type: c.contentType })),
          },
        });
        if (!error && data?.studyNote) {
          const newNotes = { ...notes, [courseId]: { content: data.studyNote, generatedAt: data.generatedAt || new Date().toISOString(), sourceCount: approvedByCourse[courseId].length } };
          fingerprints[courseId] = fp;
          try { saveFingerprints(fingerprints); } catch { /* localStorage full */ }
          await persistNotes(newNotes, courseId);
        }
      } catch (e) { console.error('[contributions] Auto-generate failed for', courseId, e); }
      finally { setIsAutoGenerating(false); }
    }
  }, [loaded]);

  useEffect(() => {
    const timer = setTimeout(checkAndGenerateNotes, 5000);
    autoGenRef.current = setInterval(checkAndGenerateNotes, 30 * 60 * 1000);
    return () => { clearTimeout(timer); if (autoGenRef.current) clearInterval(autoGenRef.current); };
  }, [checkAndGenerateNotes]);

  const submitContribution = async (contrib: Omit<Contribution, 'id' | 'status' | 'submittedAt' | 'isFastTrack'>) => {
    const isFastTrack = user?.tier === 'trusted_contributor' || user?.tier === 'admin';
    const newContrib: Contribution = { ...contrib, id: crypto.randomUUID(), status: 'under_review', submittedAt: new Date().toISOString(), isFastTrack };
    const withNew = [newContrib, ...contributions];
    setContributions(withNew);
    const { error: insertErr } = await supabase.from('contributions').insert(contributionToRow(newContrib));
    if (insertErr) {
      console.error('[contributions] Insert failed:', insertErr.message);
      toast.error('Failed to save contribution. Please try again.');
      setContributions(contributions);
      return;
    }
    toast.success('Contribution submitted! AI is validating…');
    setIsAIProcessing(true);
    try {
      const course = courses.find(c => c.id === contrib.courseId);
      const { data, error } = await supabase.functions.invoke('validate-contribution', {
        body: { title: contrib.title, content: contrib.content, contentType: contrib.contentType, courseTitle: course?.title || '', courseCode: course?.code || '' },
      });
      if (error) throw error;
      const isValid = data?.isValid !== false;
      const isRelevant = data?.isRelevant !== false;
      const updated = withNew.map(c => c.id === newContrib.id ? {
        ...c, status: (isValid ? 'ai_accepted' : 'ai_rejected') as Contribution['status'],
        aiRejectionReason: isValid ? undefined : (data?.issues?.join('; ') || 'Did not pass quality checks'),
        accuracyScore: data?.qualityScore,
      } : c);
      await persist(updated, newContrib.id);
      addNotification({
        userId: newContrib.authorMatNumber,
        type: isValid ? 'ai_accepted' : 'ai_rejected',
        message: isValid ? `Your contribution "${newContrib.title}" passed AI review and is pending admin approval.` : `Your contribution "${newContrib.title}" was rejected: ${data?.issues?.join('; ') || 'Quality check failed'}.`,
        contributionId: newContrib.id, read: false,
      });
      if (!isRelevant) {
        const courseName = course ? `${course.code} — ${course.title}` : 'Unknown Course';
        notifyAdmins(`⚠️ Relevance flag: "${newContrib.title}" by ${newContrib.authorName} may not be relevant to ${courseName}.`, newContrib.id);
        toast.warning('Your contribution was flagged for relevance review.');
      }
    } catch (e) {
      console.error('[contributions] Validation failed, using fallback:', e);
      const isValid = contrib.content.length > 50;
      const updated = withNew.map(c => c.id === newContrib.id ? {
        ...c, status: (isValid ? 'ai_accepted' : 'ai_rejected') as Contribution['status'],
        aiRejectionReason: isValid ? undefined : 'Content too short or low quality',
      } : c);
      await persist(updated, newContrib.id);
      addNotification({ userId: newContrib.authorMatNumber, type: isValid ? 'ai_accepted' : 'ai_rejected', message: isValid ? `Your contribution "${newContrib.title}" passed review.` : `Your contribution "${newContrib.title}" was rejected: Content too short.`, contributionId: newContrib.id, read: false });
    }
    setIsAIProcessing(false);
  };

  const editContribution = async (id: string, updates: Partial<Contribution>) => {
    const updated = contributions.map(c => c.id === id ? { ...c, ...updates, isEdited: true } : c);
    await persist(updated, id);
  };

  const adminApprove = async (id: string, outcome: 'accepted_as_is' | 'accepted_with_edits', reviewerName: string) => {
    const contrib = contributions.find(c => c.id === id);
    const updated = contributions.map(c => c.id === id ? { ...c, status: 'admin_approved' as const, reviewedAt: new Date().toISOString(), reviewedBy: reviewerName, reviewOutcome: outcome } : c);
    await persist(updated, id);
    if (contrib) addNotification({ userId: contrib.authorMatNumber, type: 'admin_approved', message: `Your contribution "${contrib.title}" has been approved by ${reviewerName}.`, contributionId: id, read: false });
    toast.success('Contribution approved');
  };

  const adminReject = async (id: string, reason: string, reviewerName: string) => {
    const contrib = contributions.find(c => c.id === id);
    const updated = contributions.map(c => c.id === id ? { ...c, status: 'admin_rejected' as const, reviewedAt: new Date().toISOString(), reviewedBy: reviewerName, reviewOutcome: 'rejected' as const, aiRejectionReason: reason } : c);
    await persist(updated, id);
    if (contrib) addNotification({ userId: contrib.authorMatNumber, type: 'admin_rejected', message: `Your contribution "${contrib.title}" was rejected: ${reason}`, contributionId: id, read: false });
    toast.success('Contribution rejected');
  };

  const forceRegenerateStudyNote = async (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    const approved = contributions.filter(c => c.courseId === courseId && c.status === 'admin_approved');
    if (!approved.length) { toast.error('No approved contributions to generate from'); return; }
    setIsAutoGenerating(true);
    toast.info('Generating study note…');
    try {
      const { data, error } = await supabase.functions.invoke('generate-study-note', {
        body: { courseTitle: course.title, courseCode: course.code, courseDescription: course.description, courseId, contributions: approved.map(c => ({ title: c.title, content: c.content, type: c.contentType })) },
      });
      if (error) throw error;
      if (data?.studyNote) {
        const newNotes = { ...studyNotes, [courseId]: { content: data.studyNote, generatedAt: data.generatedAt || new Date().toISOString(), sourceCount: approved.length } };
        await persistNotes(newNotes, courseId);
        const fps = loadFingerprints();
        fps[courseId] = generateFingerprint(approved);
        try { saveFingerprints(fps); } catch { /* localStorage full */ }
        toast.success('Study note regenerated!');
      }
    } catch (e) { console.error('[contributions] Force generate failed:', e); toast.error('Failed to generate study note'); }
    setIsAutoGenerating(false);
  };

  return (
    <ContributionsContext.Provider value={{
      contributions, studyNotes, submitContribution, editContribution,
      adminApprove, adminReject, forceRegenerateStudyNote,
      isAIProcessing, isAutoGenerating, unreadCount: 0,
    }}>
      {children}
    </ContributionsContext.Provider>
  );
};

export function useContributions() {
  const ctx = useContext(ContributionsContext);
  if (!ctx) throw new Error('useContributions must be used within ContributionsProvider');
  return ctx;
}
