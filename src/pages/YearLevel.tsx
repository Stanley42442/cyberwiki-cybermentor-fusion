import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Layout from "@/components/Layout";
import { useCourses } from "@/lib/courses-context";
import { useContributions } from "@/lib/contributions-context";
import { yearLevelMeta } from "@/lib/placeholder-data";
import { motion } from "framer-motion";

const YearLevel = () => {
  const { level } = useParams();
  const yearNum = Number(level);
  const { courses } = useCourses();
  const { contributions } = useContributions();
  const [filter, setFilter] = useState<"all" | "1" | "2">("all");

  const meta = yearLevelMeta.find(y => y.level === yearNum);
  const yearCourses = courses.filter(c => c.yearLevel === yearNum && c.visible);
  const filtered = filter === "all" ? yearCourses : yearCourses.filter(c => c.semester === Number(filter));

  if (!meta) {
    return <Layout><div className="flex-1 flex items-center justify-center text-muted-foreground">Year not found</div></Layout>;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 flex-1">
        <Link to="/browse" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Browse
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{meta.icon}</span>
          <h1 className="text-3xl font-bold text-foreground">{meta.title}</h1>
        </div>
        <p className="text-muted-foreground text-sm mb-6">{meta.description}</p>

        <div className="flex gap-1 mb-8">
          {[{ key: "all", label: "All Courses" }, { key: "1", label: "1st Semester" }, { key: "2", label: "2nd Semester" }].map((tab) => (
            <button key={tab.key} onClick={() => setFilter(tab.key as typeof filter)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${filter === tab.key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((course, i) => {
            const contribCount = contributions.filter(c => c.courseId === course.id).length;
            return (
              <motion.div key={course.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link to={`/course/${course.id}`} className="card-cyber p-5 block">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="badge-code">{course.code}</span>
                    <span className="badge-semester">Sem {course.semester}</span>
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{course.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{course.description}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{course.contributorCount} contributors</span>
                    <span>{contribCount} contributions</span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
};

export default YearLevel;
