// src/pages/DeptLandingPage.tsx
// Route: /dept/:deptId   e.g. /dept/cybersecurity, /dept/computer-science
// Shows a department-specific branded landing page.
// Adding a new department = just add an entry to DEPARTMENTS below.
// No backend needed — it's a marketing/pitch page that filters real data.

import { useParams, Link } from 'react-router-dom';
import { ArrowRight, Users, BookOpen, Brain, Trophy, Shield } from 'lucide-react';
import Layout from '@/components/Layout';
import { useCourses } from '@/lib/courses-context';
import { useAuth } from '@/lib/auth-context';
import { useContributions } from '@/lib/contributions-context';

interface DeptConfig {
  name: string;
  faculty: string;
  shortName: string;
  icon: string;
  tagline: string;
  color: string;       // Tailwind color for accents (used in inline styles)
  accentHex: string;
  description: string;
}

// ── Add new departments here ───────────────────────────────────────────────────
const DEPARTMENTS: Record<string, DeptConfig> = {
  cybersecurity: {
    name: 'Cybersecurity',
    shortName: 'CyberWiki',
    faculty: 'Faculty of Computing',
    icon: '🛡️',
    tagline: 'The smarter way to study Cybersecurity at UNIPORT',
    color: 'primary',
    accentHex: '#22d3ee',
    description: 'AI-powered study notes, peer contributions, exam preparation and a personalised AI tutor — built for UNIPORT Cybersecurity students.',
  },
  'computer-science': {
    name: 'Computer Science',
    shortName: 'CSC Wiki',
    faculty: 'Faculty of Computing',
    icon: '💻',
    tagline: 'The smarter way to study Computer Science at UNIPORT',
    color: 'primary',
    accentHex: '#a78bfa',
    description: 'AI-powered study notes, peer contributions, exam preparation and a personalised AI tutor — built specifically for UNIPORT Computer Science students.',
  },
  'information-technology': {
    name: 'Information Technology',
    shortName: 'IT Wiki',
    faculty: 'Faculty of Computing',
    icon: '🌐',
    tagline: 'The smarter way to study IT at UNIPORT',
    color: 'primary',
    accentHex: '#34d399',
    description: 'Peer-validated study notes, past question banks, exam countdowns, and a personalised AI tutor built for UNIPORT IT students.',
  },
  'electrical-engineering': {
    name: 'Electrical Engineering',
    shortName: 'EEE Wiki',
    faculty: 'Faculty of Engineering',
    icon: '⚡',
    tagline: 'The smarter way to study Electrical Engineering at UNIPORT',
    color: 'primary',
    accentHex: '#fbbf24',
    description: 'Everything your department needs — peer notes, past questions, AI tutoring — tailored for UNIPORT Electrical Engineering.',
  },
};

const FEATURES = [
  {
    icon: BookOpen,
    title: 'AI Study Notes',
    desc: 'Peer contributions are automatically compiled into comprehensive, textbook-quality study notes by AI — one per course, always up to date.',
  },
  {
    icon: Brain,
    title: 'Personalised AI Tutor',
    desc: 'An AI tutor that remembers how you learn across every session. It adapts its teaching style to your strengths and weak areas over the semester.',
  },
  {
    icon: Shield,
    title: 'Past Questions Bank',
    desc: 'Course reps and admins upload past exam questions. The AI analyses them to tell you which topics appear most — so you study smarter.',
  },
  {
    icon: Trophy,
    title: 'Contribution Leaderboard',
    desc: 'Students earn accuracy scores by contributing quality notes. Top contributors are recognised — motivation to share what you know.',
  },
  {
    icon: Users,
    title: 'Exam Countdowns',
    desc: 'Admins set exam dates. Every course page shows a live countdown and a prioritised list of high-frequency exam topics from past questions.',
  },
  {
    icon: ArrowRight,
    title: 'Anonymous Topic Flags',
    desc: 'Students flag topics they don\'t understand — anonymously. Admins see aggregated data and can prioritise improving weak material.',
  },
];

export default function DeptLandingPage() {
  const { deptId } = useParams<{ deptId: string }>();
  const dept = DEPARTMENTS[deptId ?? ''];
  const { courses } = useCourses();
  const { contributions } = useContributions();
  const { allUsers } = useAuth();

  // Filter to dept courses if deptId matches
  const deptCourses = courses.filter(c => (c as any).department === deptId || deptId === 'cybersecurity');
  const deptContribs = contributions.filter(c => deptCourses.some(dc => dc.id === c.courseId) && c.status === 'admin_approved');

  if (!dept) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-24">
          <p className="text-4xl">🏫</p>
          <h1 className="text-2xl font-bold text-foreground">Department not found</h1>
          <p className="text-muted-foreground text-sm">We don't have a page for that department yet.</p>
          <Link to="/" className="text-primary hover:underline text-sm">← Back to home</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex-1">
        {/* Hero */}
        <section className="py-20 px-4 text-center border-b border-border" style={{ background: `radial-gradient(ellipse at 50% 0%, ${dept.accentHex}15 0%, transparent 70%)` }}>
          <div className="max-w-2xl mx-auto">
            <div className="text-6xl mb-4">{dept.icon}</div>
            <div className="inline-block text-xs font-mono px-3 py-1 rounded-full border border-border text-muted-foreground mb-4">
              {dept.faculty} · University of Port Harcourt
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
              {dept.shortName}
            </h1>
            <p className="text-xl text-muted-foreground mb-2">{dept.tagline}</p>
            <p className="text-sm text-muted-foreground/70 max-w-lg mx-auto mb-8">{dept.description}</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link to="/signup" className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors text-sm">
                Join {dept.shortName} →
              </Link>
              <Link to="/browse" className="px-6 py-3 rounded-xl border border-border text-foreground font-semibold hover:border-primary/50 transition-colors text-sm">
                Browse Courses
              </Link>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-10 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto grid grid-cols-3 gap-6 text-center">
            {[
              { value: deptCourses.length, label: 'Active Courses' },
              { value: deptContribs.length, label: 'Approved Notes' },
              { value: allUsers.filter(u => u.status === 'verified').length, label: 'Verified Students' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-3xl font-bold text-primary font-mono">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-foreground text-center mb-10">Everything your department needs</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {FEATURES.map(f => (
                <div key={f.title} className="card-cyber p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <f.icon className="w-5 h-5 text-primary flex-shrink-0" />
                    <h3 className="font-semibold text-foreground text-sm">{f.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA for course reps pitching to departments */}
        <section className="py-12 px-4 border-t border-border">
          <div className="max-w-xl mx-auto text-center">
            <p className="text-muted-foreground text-sm mb-2">Want this for your department?</p>
            <h2 className="text-2xl font-bold text-foreground mb-4">Talk to us</h2>
            <p className="text-muted-foreground text-sm mb-6">
              We can set up a version of this platform for any department in the Faculty of Computing. All existing contributions, study notes and past questions carry over when you expand.
            </p>
            <a href="mailto:cyberwiki@uniport.edu.ng"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors text-sm">
              Contact us <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </section>
      </div>
    </Layout>
  );
}
