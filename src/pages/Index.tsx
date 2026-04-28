import { Link } from "react-router-dom";
import { ChevronRight, Monitor, Users, FileText, Brain, BookOpen, Target } from "lucide-react";
import Layout from "@/components/Layout";
import { useCourses } from "@/lib/courses-context";
import { useContributions } from "@/lib/contributions-context";
import { yearLevelMeta } from "@/lib/placeholder-data";
import { motion } from "framer-motion";

const Index = () => {
  const { courses } = useCourses();
  const { contributions } = useContributions();

  const totalCourses = courses.filter(c => c.visible).length;
  const totalContributors = new Set(contributions.map(c => c.authorMatNumber)).size;
  const totalNotes = contributions.filter(c => c.status === 'admin_approved').length;

  return (
    <Layout>
      {/* Hero */}
      <section className="relative py-20 md:py-28 text-center px-4 cyber-grid-bg scanlines">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card font-mono text-xs text-muted-foreground">
            <span className="text-primary">⚡</span> Department of Cybersecurity • University of Port Harcourt
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4 leading-tight">
            Every year's knowledge,{" "}
            <span className="text-gradient-green text-glow">one place</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto mb-8 text-sm md:text-base leading-relaxed">
            Student-contributed notes compiled by AI into course references — plus a personal AI tutor that knows your career path, your level, and your weak areas.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/browse"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors border-glow min-h-[48px]"
            >
              Browse Courses <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              to="/tutor"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-primary/40 bg-primary/8 text-primary font-semibold text-sm hover:bg-primary/15 transition-colors min-h-[48px]"
            >
              <Brain className="h-4 w-4" /> Try AI Tutor
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Stats */}
      <section className="border-y border-border py-8">
        <div className="container mx-auto px-4 grid grid-cols-3 divide-x divide-border text-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="flex items-center justify-center gap-2 text-2xl md:text-3xl font-bold text-foreground">
              <Monitor className="h-5 w-5 text-muted-foreground" /> {totalCourses}
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Courses</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="flex items-center justify-center gap-2 text-2xl md:text-3xl font-bold text-foreground">
              <Users className="h-5 w-5 text-muted-foreground" /> {totalContributors}
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Contributors</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center justify-center gap-2 text-2xl md:text-3xl font-bold text-foreground">
              <FileText className="h-5 w-5 text-muted-foreground" /> {totalNotes}
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Notes</p>
          </motion.div>
        </div>
      </section>

      {/* AI Tutor feature highlight */}
      <section className="container mx-auto px-4 py-14">
        <div className="card-cyber p-6 md:p-10 glow-green">
          <div className="flex flex-col md:flex-row md:items-center gap-8">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-xs font-mono text-primary mb-4">
                ✦ NEW — AI Tutor
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                Your personal cybersecurity mentor
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6 max-w-md">
                Picks up where study notes end. Teaches to your career path (SOC Analyst, Pentester, Cloud Engineer and more), adapts to your level, and remembers your weak areas. Includes course-aware mode — open a course and it teaches from the actual study notes.
              </p>
              <div className="flex flex-wrap gap-3">
                {[
                  { icon: <BookOpen className="h-3.5 w-3.5" />, label: 'Learn mode' },
                  { icon: <Target className="h-3.5 w-3.5" />, label: 'Quiz & Exam' },
                  { icon: <span className="text-xs">🧪</span>, label: 'Hands-on Lab' },
                  { icon: <span className="text-xs">🏢</span>, label: 'Real-World Scenarios' },
                ].map(f => (
                  <span key={f.label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground font-medium">
                    {f.icon} {f.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-start md:items-center gap-3 flex-shrink-0">
              <Link
                to="/tutor"
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors min-h-[52px]"
              >
                <Brain className="h-4 w-4" /> Start Learning
              </Link>
              <p className="text-xs text-muted-foreground font-mono text-center">Free for verified UNIPORT students</p>
            </div>
          </div>
        </div>
      </section>

      {/* Year Levels */}
      <section className="container mx-auto px-4 pb-14">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Browse by Year Level</h2>
          <p className="text-muted-foreground text-sm">Select your year to find relevant courses and resources</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {yearLevelMeta.map((yl) => {
            const yearCourses = courses.filter(c => c.yearLevel === yl.level && c.visible);
            return (
              <motion.div key={yl.level} whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
                <Link to={`/year/${yl.level}`} className="card-cyber p-6 block min-h-[140px]">
                  <span className="text-3xl mb-3 block">{yl.icon}</span>
                  <h3 className="font-bold text-foreground mb-1 text-sm">{yl.title}</h3>
                  <p className="text-muted-foreground text-xs mb-3 leading-relaxed">{yl.description}</p>
                  <span className="text-xs text-primary font-mono-cyber">{yearCourses.length} courses →</span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 pb-16">
        <div className="card-cyber p-8 md:p-10 text-center">
          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-3">Share What You Know</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6 leading-relaxed">
            Your notes directly power the AI tutor for every student who studies this course after you. Good contributors are publicly recognised on the leaderboard.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/contribute"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors min-h-[48px]"
            >
              Contribute Notes
            </Link>
            <Link
              to="/leaderboard"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-border text-muted-foreground font-medium text-sm hover:bg-secondary hover:text-foreground transition-colors min-h-[48px]"
            >
              View Leaderboard
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
