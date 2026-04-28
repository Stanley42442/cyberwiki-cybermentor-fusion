import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Layout from "@/components/Layout";
import { useCourses } from "@/lib/courses-context";
import { yearLevelMeta } from "@/lib/placeholder-data";
import { motion } from "framer-motion";

const Browse = () => {
  const { courses } = useCourses();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 flex-1">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>
        <h1 className="text-3xl font-bold text-foreground mb-2">Browse Courses</h1>
        <p className="text-muted-foreground text-sm mb-8">Select a year level to view available courses</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {yearLevelMeta.map((yl, i) => {
            const yearCourses = courses.filter(c => c.yearLevel === yl.level && c.visible);
            return (
              <motion.div key={yl.level} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Link to={`/year/${yl.level}`} className="card-cyber p-6 block">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{yl.icon}</span>
                    <div>
                      <h3 className="font-bold text-foreground">{yl.title}</h3>
                      <p className="text-xs text-muted-foreground">{yl.description}</p>
                    </div>
                  </div>
                  <p className="text-sm text-primary font-mono-cyber">{yearCourses.length} courses →</p>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
};

export default Browse;
