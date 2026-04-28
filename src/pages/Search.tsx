import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search as SearchIcon } from "lucide-react";
import Layout from "@/components/Layout";
import { useCourses } from "@/lib/courses-context";
import { useContributions } from "@/lib/contributions-context";

const Search = () => {
  const [query, setQuery] = useState("");
  const { courses } = useCourses();
  const { contributions } = useContributions();

  const courseResults = query.length > 0
    ? courses.filter(c => c.visible && (
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        c.code.toLowerCase().includes(query.toLowerCase()) ||
        c.description.toLowerCase().includes(query.toLowerCase())
      ))
    : [];

  const contribResults = query.length > 0
    ? contributions.filter(c =>
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        c.content.toLowerCase().includes(query.toLowerCase()) ||
        c.authorName.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10)
    : [];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 flex-1 max-w-2xl">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>
        <h1 className="text-3xl font-bold text-foreground mb-6">Search</h1>

        <div className="relative mb-8">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input type="text" placeholder="Search courses, notes, contributors..." value={query} onChange={e => setQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-card border border-primary/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors" autoFocus />
        </div>

        {query.length === 0 ? (
          <div className="text-center py-16">
            <SearchIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground text-sm">Start typing to search across courses and contributions</p>
          </div>
        ) : (
          <>
            {courseResults.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Courses ({courseResults.length})</h2>
                <div className="space-y-3">
                  {courseResults.map(course => (
                    <Link key={course.id} to={`/course/${course.id}`} className="card-cyber p-4 block">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge-code">{course.code}</span>
                        <span className="badge-semester">Year {course.yearLevel}</span>
                      </div>
                      <h3 className="font-semibold text-foreground">{course.title}</h3>
                      <p className="text-sm text-muted-foreground">{course.description}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {contribResults.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contributions ({contribResults.length})</h2>
                <div className="space-y-3">
                  {contribResults.map(c => (
                    <Link key={c.id} to={`/course/${c.courseId}`} className="card-cyber p-4 block">
                      <h3 className="font-semibold text-foreground">{c.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{c.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">by {c.authorName}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {courseResults.length === 0 && contribResults.length === 0 && (
              <div className="text-center py-16 text-muted-foreground text-sm">No results found for "{query}"</div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default Search;
