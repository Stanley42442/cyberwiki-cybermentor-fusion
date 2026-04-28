import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import Layout from "@/components/Layout";
import SyncPlayer from "@/components/SyncPlayer";
import StudyNoteTOC from "@/components/StudyNoteTOC";
import { useCourses } from "@/lib/courses-context";
import { useContributions } from "@/lib/contributions-context";

const StudyNotePage = () => {
  const { id } = useParams();
  const { courses } = useCourses();
  const { studyNotes } = useContributions();

  const course = courses.find(c => c.id === id);
  const note = id ? studyNotes[id] : undefined;

  if (!course || !note) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <Link to={id ? `/course/${id}` : '/browse'} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="text-center py-16 text-muted-foreground">
            {!course ? 'Course not found' : 'No study note generated yet for this course.'}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Print header (hidden on screen) */}
      <div className="print-header hidden">
        <h1>{course.code} — {course.title}</h1>
        <p>Generated: {new Date(note.generatedAt).toLocaleDateString()} · Sources: {note.sourceCount}</p>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link to={`/course/${course.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> {course.code}
          </Link>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors no-print">
            <Printer className="h-4 w-4" /> Export PDF
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">{course.title} — Study Note</h1>
          <p className="text-sm text-muted-foreground">
            Generated {new Date(note.generatedAt).toLocaleDateString()} from {note.sourceCount} approved contributions
          </p>
        </div>

        <div className="flex gap-6">
          <div className="flex-1">
            <SyncPlayer content={note.content} syncMetadata={note.syncMetadata} />
          </div>
          <StudyNoteTOC content={note.content} />
        </div>
      </div>
    </Layout>
  );
};

export default StudyNotePage;
