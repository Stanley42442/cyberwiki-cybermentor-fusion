import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { defaultCourses, type Course } from '@/lib/placeholder-data';
import { toast } from 'sonner';

const ADMIN_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-action`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

async function adminAction(action: string, payload: unknown): Promise<unknown> {
  const { data: session } = await supabase.auth.getSession();
  const tok = session.session?.access_token ?? '';
  const res = await fetch(ADMIN_FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ action, payload }),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error ?? res.statusText);
  return json.data;
}

interface CoursesContextType {
  courses: Course[];
  allCourses: Course[];
  loading: boolean;
  addCourse: (course: Omit<Course, 'contributorCount' | 'noteCount'>) => Promise<void>;
  updateCourse: (id: string, updates: Partial<Course>) => Promise<void>;
  archiveCourse: (id: string) => Promise<void>;
  restoreCourse: (id: string) => Promise<void>;
  toggleVisibility: (id: string) => Promise<void>;
}

const CoursesContext = createContext<CoursesContextType | undefined>(undefined);

function rowToCourse(row: Record<string, unknown>): Course {
  return {
    id: row.id as string,
    code: row.code as string,
    title: row.title as string,
    description: (row.description as string) ?? '',
    yearLevel: row.year_level as number,
    semester: row.semester as number,
    department: (row.department as string) ?? 'cybersecurity',
    prerequisites: (row.prerequisites as string[]) ?? [],
    leadsTo: (row.leads_to as string[]) ?? [],
    visible: (row.visible as boolean) ?? true,
    active: (row.active as boolean) ?? true,
    contributorCount: 0,
    noteCount: 0,
  };
}

export const CoursesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('courses').select('*').order('year_level').order('semester').order('code');

      if (error) {
        console.error('[courses-context] Load failed:', error.message);
        setAllCourses(defaultCourses.map(c => ({ ...c, active: true, visible: true })));
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        console.log('[courses-context] Seeding courses...');
        for (const c of defaultCourses) {
          try {
            await adminAction('upsert_course', { course: { ...c, visible: true, active: true } });
          } catch { /* best effort */ }
        }
        setAllCourses(defaultCourses.map(c => ({ ...c, active: true, visible: true })));
      } else {
        setAllCourses(data.map(r => rowToCourse(r as Record<string, unknown>)));
      }
      setLoading(false);
    })();
  }, []);

  const courses = allCourses.filter(c => c.active && c.visible);

  const addCourse = useCallback(async (course: Omit<Course, 'contributorCount' | 'noteCount'>) => {
    const id = course.id || course.code.toLowerCase().replace(/\s+/g, '');
    await adminAction('upsert_course', { course: { ...course, id } });
    setAllCourses(prev => [...prev, { ...course, id, active: true, contributorCount: 0, noteCount: 0 }]);
    toast.success(`${course.code} added`);
  }, []);

  const updateCourse = useCallback(async (id: string, updates: Partial<Course>) => {
    const existing = allCourses.find(c => c.id === id);
    if (!existing) return;
    await adminAction('upsert_course', { course: { ...existing, ...updates, id } });
    setAllCourses(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    toast.success('Course updated');
  }, [allCourses]);

  const archiveCourse = useCallback(async (id: string) => {
    await adminAction('archive_course', { courseId: id });
    setAllCourses(prev => prev.map(c => c.id === id ? { ...c, active: false } : c));
    toast.success('Course archived');
  }, []);

  const restoreCourse = useCallback(async (id: string) => {
    await adminAction('restore_course', { courseId: id });
    setAllCourses(prev => prev.map(c => c.id === id ? { ...c, active: true, visible: true } : c));
    toast.success('Course restored');
  }, []);

  const toggleVisibility = useCallback(async (id: string) => {
    const course = allCourses.find(c => c.id === id);
    if (!course) return;
    await adminAction('toggle_course_visibility', { courseId: id, visible: !course.visible });
    setAllCourses(prev => prev.map(c => c.id === id ? { ...c, visible: !course.visible } : c));
    toast.success(!course.visible ? 'Course visible' : 'Course hidden');
  }, [allCourses]);

  return (
    <CoursesContext.Provider value={{
      courses, allCourses, loading,
      addCourse, updateCourse, archiveCourse, restoreCourse, toggleVisibility,
    }}>
      {children}
    </CoursesContext.Provider>
  );
};

export function useCourses() {
  const ctx = useContext(CoursesContext);
  if (!ctx) throw new Error('useCourses must be used within CoursesProvider');
  return ctx;
}
