import { log } from '@/lib/logger';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { UserProfile, Notification } from '@/lib/placeholder-data';
import { toast } from 'sonner';

interface AuthContextType {
  user: UserProfile | null;
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  login: (matNumber: string, password: string) => Promise<void>;
  signup: (matNumber: string, displayName: string, yearLevel: number, password: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyUser: (userId: string) => void;
  rejectUser: (userId: string, note: string) => void;
  promoteToAdmin: (userId: string) => void;
  demoteFromAdmin: (userId: string) => void;
  promoteToTrusted: (userId: string) => void;
  demoteFromTrusted: (userId: string) => void;
  updateUserStats: (matNumber: string, stats: Partial<UserProfile>) => void;
  allUsers: UserProfile[];
  markNotificationRead: (id: string) => void;
  addNotification: (n: Omit<Notification, 'id' | 'createdAt'>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const NOTIFICATIONS_KEY = 'cyberwiki-notifications';

function loadNotifications(): Notification[] {
  try { const s = localStorage.getItem(NOTIFICATIONS_KEY); if (s) return JSON.parse(s); } catch { /**/ }
  return [];
}
function saveNotifications(n: Notification[]) { localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(n)); }
function matToEmail(mat: string) { return `${mat.toLowerCase().replace(/\//g, '')}@student.uniport.edu.ng`; }

function rowToUser(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    mat_number: (row.mat_number as string) ?? '',
    display_name: (row.display_name as string) ?? 'Student',
    email: row.email as string | undefined,
    year_level: (row.year_level as number) ?? 1,
    tier: (row.tier as UserProfile['tier']) ?? 'verified_student',
    status: (row.status as UserProfile['status']) ?? 'verified',
    accuracy_score: Number(row.accuracy_score) || 0,
    reviewed_contributions: (row.reviewed_contributions as number) ?? 0,
    total_contributions: (row.total_contributions as number) ?? 0,
    rejection_note: row.rejection_note as string | undefined,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
  };
}

// Supabase query with timeout — prevents infinite hang
// Timeout tuned for Supabase free-tier latency from Nigeria (queries can take 6-22s)
// Accept PromiseLike<T> so Supabase PostgREST builders (which only implement .then(),
// not the full Promise interface) are valid arguments.
async function withTimeout<T>(promise: PromiseLike<T>, ms = 25000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Query timed out after ${ms}ms`)), ms);
  });
  try {
    // Promise.resolve() converts PromiseLike → real Promise so .race() can use it
    return await Promise.race([Promise.resolve(promise), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>(loadNotifications);
  const [loading, setLoading] = useState(true);
  // Use a generation counter instead of a boolean lock.
  // Each loadProfile call increments it; only the latest call commits its result.
  const profileGenRef = useRef(0);

  // Fetch and set user profile — never throws, never hangs
  const loadProfile = useCallback(async (
    userId: string,
    email?: string,
    meta?: Record<string, string>
  ) => {
    // Bump the generation so any in-flight older call won't overwrite us
    const myGen = ++profileGenRef.current;

    const commit = (profile: UserProfile) => {
      // Only apply if we are still the most-recent call
      if (profileGenRef.current === myGen) setUser(profile);
    };

    try {
      const { data } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      );

      if (data) {
        const profile = rowToUser(data as Record<string, unknown>);
        commit(profile);
        // Cache key fields so the fallback preserves admin tier across cold-start timeouts
        try { localStorage.setItem('cyberwiki-profile-cache', JSON.stringify({ id: profile.id, tier: profile.tier, mat_number: profile.mat_number, display_name: profile.display_name })); } catch { /**/ }
        return;
      }

      // No profile yet — create one. Use upsert so it's idempotent.
      const mat = meta?.mat_number ?? (email?.split('@')[0] ?? userId.slice(0, 8));
      const { data: created } = await withTimeout(
        supabase.from('profiles').upsert({
          id: userId,
          mat_number: mat,
          display_name: meta?.display_name ?? mat,
          email: email ?? null,
          year_level: meta?.year_level ? Number(meta.year_level) : 1,
          tier: 'verified_student',
          status: 'verified',
          accuracy_score: 0,
          reviewed_contributions: 0,
          total_contributions: 0,
        }, { onConflict: 'id' }).select().single()
      );
      if (created) commit(rowToUser(created as Record<string, unknown>));

    } catch (e) {
      log.error('auth', 'loadProfile failed', { userId, error: String(e) });

      // Restore from localStorage cache — preserves admin tier across timeouts
      try {
        const cached = JSON.parse(localStorage.getItem('cyberwiki-profile-cache') || '{}');
        if (cached.id === userId && cached.tier) {
          commit({
            id: userId,
            mat_number: cached.mat_number ?? meta?.mat_number ?? '',
            display_name: cached.display_name ?? meta?.display_name ?? 'Student',
            email: email,
            year_level: 1,
            tier: cached.tier,
            status: 'verified',
            accuracy_score: 0,
            reviewed_contributions: 0,
            total_contributions: 0,
            created_at: new Date().toISOString(),
          });
          return;
        }
      } catch { /**/ }

      // Final fallback — no cache available
      commit({
        id: userId,
        mat_number: meta?.mat_number ?? '',
        display_name: meta?.display_name ?? 'Student',
        email: email,
        year_level: 1,
        tier: 'verified_student',
        status: 'verified',
        accuracy_score: 0,
        reviewed_contributions: 0,
        total_contributions: 0,
        created_at: new Date().toISOString(),
      });
    }
  }, []);

  const loadAllProfiles = useCallback(async () => {
    try {
      const { data } = await withTimeout(supabase.from('profiles').select('*'));
      if (data) setAllUsers(data.map(r => rowToUser(r as Record<string, unknown>)));
    } catch (e) { log.error('auth', 'loadAllProfiles failed', { error: String(e) }); }
  }, []);

  useEffect(() => {
    let mounted = true;

    // ── KEY CHANGE ─────────────────────────────────────────────────────────────
    // We no longer call getSession() in boot. getSession() is slow on free-tier
    // and duplicates what onAuthStateChange already does on initialization.
    // onAuthStateChange fires INITIAL_SESSION (or no event) shortly after mount,
    // which is all we need. This eliminates the 15 s boot timeout.
    // ───────────────────────────────────────────────────────────────────────────

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      log.info('auth', 'onAuthStateChange', { event, userId: session?.user?.id ?? null });

      if (session?.user) {
        setLoading(false); // resolve loading immediately on any authenticated event
        const meta = session.user.user_metadata as Record<string, string>;
        // loadProfile is now safe to call concurrently — generation counter handles races
        loadProfile(session.user.id, session.user.email ?? undefined, meta);
        // Fetch all profiles only on explicit sign-in events to avoid refetching on every token refresh
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          loadAllProfiles();
        }
      } else {
        // No session — stop loading and clear user
        setLoading(false);
        if (event === 'SIGNED_OUT') setUser(null);
        // INITIAL_SESSION with no user = not logged in
        if (event === 'INITIAL_SESSION') setUser(null);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [loadProfile, loadAllProfiles]);

  useEffect(() => { saveNotifications(notifications); }, [notifications]);

  // login() ONLY does signInWithPassword — no blocking profile fetch
  // onAuthStateChange above handles the profile in background
  const login = async (matNumber: string, password: string) => {
    const email = matToEmail(matNumber);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('Email not confirmed'))
        throw new Error('Email confirmation still ON — go to Supabase → Auth → Providers → Email → disable "Confirm email".');
      if (error.message.includes('Invalid login credentials'))
        throw new Error('Wrong matriculation number or password.');
      throw new Error(error.message);
    }
    log.info('auth', 'signInWithPassword success', { mat: matNumber });
    // Don't await profile — onAuthStateChange handles it.
    // login() returns here immediately after successful auth.
  };

  const signup = async (matNumber: string, displayName: string, yearLevel: number, password: string) => {
    const email = matToEmail(matNumber);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { mat_number: matNumber, display_name: displayName, year_level: String(yearLevel) } },
    });
    if (error) throw new Error(error.message);
    if (!data.session && !data.user) throw new Error('Signup succeeded but no user returned — check Supabase email settings.');

    // Upsert profile immediately — don't rely solely on DB trigger
    if (data.user) {
      try {
        await withTimeout(supabase.from('profiles').upsert({
          id: data.user.id,
          mat_number: matNumber,
          display_name: displayName,
          email,
          year_level: yearLevel,
          tier: 'verified_student',
          status: 'verified',
          accuracy_score: 0,
          reviewed_contributions: 0,
          total_contributions: 0,
        }, { onConflict: 'id' }));
      } catch (e) { log.error('auth', 'Signup upsert failed', { error: String(e) }); }
    }
    // onAuthStateChange fires after signup and handles setUser
  };

  const logout = async () => { await supabase.auth.signOut(); setUser(null); };

  const updateProfileInDB = useCallback(async (userId: string, updates: Record<string, unknown>) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from('profiles').update(updates as any).eq('id', userId);
      await loadAllProfiles();
      if (user?.id === userId) await loadProfile(userId);
    } catch (e) { log.error('auth', 'updateProfileInDB failed', { error: String(e) }); }
  }, [user, loadAllProfiles, loadProfile]);

  const verifyUser        = (id: string)            => { updateProfileInDB(id, { status: 'verified' }); toast.success('User verified'); };
  const rejectUser        = (id: string, n: string)  => { updateProfileInDB(id, { status: 'rejected', rejection_note: n }); toast.success('Rejected'); };
  const promoteToAdmin    = (id: string)             => { updateProfileInDB(id, { tier: 'admin' }); toast.success('Promoted to admin'); };
  const demoteFromAdmin   = (id: string)             => { updateProfileInDB(id, { tier: 'verified_student' }); toast.success('Demoted'); };
  const promoteToTrusted  = (id: string)             => { updateProfileInDB(id, { tier: 'trusted_contributor' }); toast.success('Promoted to trusted'); };
  const demoteFromTrusted = (id: string)             => { updateProfileInDB(id, { tier: 'verified_student' }); toast.success('Demoted'); };
  const updateUserStats   = (mat: string, stats: Partial<UserProfile>) => {
    const t = allUsers.find(u => u.mat_number === mat);
    if (t) updateProfileInDB(t.id, stats as Record<string, unknown>);
  };

  const unreadCount = notifications.filter(n => n.userId === user?.id && !n.read).length;
  const markNotificationRead = (id: string) => setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n));
  const addNotification = (n: Omit<Notification, 'id' | 'createdAt'>) =>
    setNotifications(p => [{ ...n, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...p]);

  return (
    <AuthContext.Provider value={{
      user, notifications, unreadCount, loading, login, signup, logout,
      verifyUser, rejectUser, promoteToAdmin, demoteFromAdmin, promoteToTrusted, demoteFromTrusted,
      updateUserStats, allUsers, markNotificationRead, addNotification,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
