// src/pages/Contribute.tsx
// Contribution form with:
// - Written text (markdown supported)
// - PDF/DOCX file upload (text extracted in browser, sent to AI for validation)
// - Video link (YouTube, Google Drive, etc.) — AI analysis in a future update
// - Past question tips

import { useState, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Upload, X, FileText, ExternalLink, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import Layout from '@/components/Layout';
import { useAuth } from '@/lib/auth-context';
import { useCourses } from '@/lib/courses-context';
import { useContributions } from '@/lib/contributions-context';
import { supabase } from '@/integrations/supabase/client';
import { extractTextFromFile } from '@/lib/extract-document-text';
import { toast } from 'sonner';

const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx';
const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

const VIDEO_PLATFORMS = [
  { name: 'YouTube', example: 'https://youtube.com/watch?v=...' },
  { name: 'Google Drive', example: 'https://drive.google.com/file/...' },
  { name: 'Other', example: 'Any publicly accessible video link' },
];

const contentTypes = [
  { value: 'written', label: '✏️ Written Notes', desc: 'Type your notes directly. Markdown supported.' },
  { value: 'pdf', label: '📄 Document', desc: 'Upload a PDF or Word document (.pdf, .doc, .docx)' },
  { value: 'video', label: '🎬 Video Link', desc: 'Link to a YouTube video or Google Drive recording' },
  { value: 'past-question-tips', label: '📝 Past Q Tips', desc: 'Share exam tips and past question insights' },
] as const;

type ContentType = typeof contentTypes[number]['value'];

const Contribute = () => {
  const { user } = useAuth();
  const { courses } = useCourses();
  const { submitContribution, isAIProcessing } = useContributions();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [courseId, setCourseId] = useState(searchParams.get('course') || '');
  const [contentType, setContentType] = useState<ContentType>('written');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [whatItAdds, setWhatItAdds] = useState('');

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');

  // Extracted text from PDF/DOCX (used as the real content for AI validation)
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 flex-1 max-w-lg">
          <div className="card-cyber p-8 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-bold text-foreground mb-2">Sign in Required</h2>
            <p className="text-muted-foreground text-sm mb-6">You need to be signed in to contribute.</p>
            <div className="flex justify-center gap-3">
              <Link to="/login" className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90">Login</Link>
              <Link to="/signup" className="px-6 py-2.5 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-secondary">Sign Up</Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (user.status !== 'verified') {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 flex-1 max-w-lg">
          <div className="card-cyber p-8 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-bold text-foreground mb-2">Account Pending Verification</h2>
            <p className="text-muted-foreground text-sm">Your account needs to be verified by an admin before you can contribute.</p>
          </div>
        </div>
      </Layout>
    );
  }

  // ── File handling ────────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError('');
    setUploadedFileUrl('');
    setExtractedText(null);
    if (!file) return;

    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowed.includes(file.type)) {
      setFileError('Only PDF, DOC, and DOCX files are accepted.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError(`File is too large. Maximum size is ${MAX_FILE_MB}MB.`);
      return;
    }

    setSelectedFile(file);

    // Extract text immediately so the AI gets the real document content
    setIsExtracting(true);
    try {
      const text = await extractTextFromFile(file);
      setExtractedText(text);
      if (text && text.length > 100) {
        toast.success('Document read successfully — AI will validate the full content.');
      } else {
        toast.info('Could not read document text automatically. Please fill in the summary below.');
      }
    } catch {
      setExtractedText(null);
    } finally {
      setIsExtracting(false);
    }
  };

  const uploadFile = async (): Promise<string> => {
    if (!selectedFile || !user) return '';
    setUploading(true);
    setUploadProgress(10);

    const ext = selectedFile.name.split('.').pop() ?? 'pdf';
    const path = `contributions/${user.id}/${crypto.randomUUID()}.${ext}`;

    setUploadProgress(40);

    const { error } = await supabase.storage
      .from('contributions')
      .upload(path, selectedFile, { contentType: selectedFile.type, upsert: false });

    if (error) {
      setUploading(false);
      setUploadProgress(0);
      throw new Error('File upload failed: ' + error.message);
    }

    setUploadProgress(80);
    const { data: urlData } = supabase.storage.from('contributions').getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    setUploadProgress(100);
    setUploading(false);
    setUploadedFileUrl(publicUrl);
    return publicUrl;
  };

  const removeFile = () => {
    setSelectedFile(null);
    setUploadedFileUrl('');
    setFileError('');
    setUploadProgress(0);
    setExtractedText(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Validation ───────────────────────────────────────────────
  const validate = (): string | null => {
    if (!courseId) return 'Please select a course.';
    if (!title.trim()) return 'Please add a title.';
    if (contentType === 'written' || contentType === 'past-question-tips') {
      if (!content.trim() || content.trim().length < 50) return 'Content must be at least 50 characters.';
    }
    if (contentType === 'pdf') {
      if (!selectedFile && !uploadedFileUrl) return 'Please select a file to upload.';
      if (fileError) return fileError;
      if (isExtracting) return 'Please wait — document is still being processed.';
      const hasContent = (extractedText && extractedText.length > 50) || content.trim().length > 20;
      if (!hasContent) return 'Please add a brief description of what this document covers.';
    }
    if (contentType === 'video') {
      if (!videoUrl.trim()) return 'Please enter a video URL.';
      try { new URL(videoUrl); } catch { return 'Please enter a valid URL.'; }
      if (!content.trim()) return 'Please add a brief description of what the video covers.';
    }
    return null;
  };

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { toast.error(err); return; }

    try {
      let pdfUrl: string | undefined;
      if (contentType === 'pdf' && selectedFile) {
        toast.info('Uploading file…');
        pdfUrl = await uploadFile();
      }

      // Use extracted text as the main content for document contributions.
      // The user summary is appended as extra context.
      // This means the AI actually validates the document body, not just a short description.
      const effectiveContent = contentType === 'pdf'
        ? (extractedText && extractedText.length > 50
            ? extractedText + (content.trim() ? `\n\nDocument Summary: ${content.trim()}` : '')
            : content.trim() || '[Document contribution — see attached file]')
        : content.trim();

      await submitContribution({
        courseId,
        contentType,
        title: title.trim(),
        content: effectiveContent,
        pdfUrl: contentType === 'pdf' ? (pdfUrl || uploadedFileUrl) : undefined,
        videoUrl: contentType === 'video' ? videoUrl.trim() : undefined,
        whatItAdds: whatItAdds.trim() || undefined,
        authorMatNumber: user.mat_number,
        authorName: user.display_name,
      });

      navigate(`/course/${courseId}`);
    } catch (err) {
      toast.error((err as Error).message || 'Submission failed. Please try again.');
    }
  };

  const canSubmit = !isAIProcessing && !uploading && !isExtracting && !fileError;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 flex-1 max-w-2xl">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <h1 className="text-3xl font-bold text-foreground mb-2">Submit Contribution</h1>
        <p className="text-muted-foreground text-sm mb-8">Share your knowledge to help fellow students. All contributions are AI-validated then reviewed by an admin before going live.</p>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Course */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Course <span className="text-destructive">*</span></label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-primary transition-colors">
              <option value="">Select a course</option>
              {courses.filter(c => c.visible).map(c => (
                <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
              ))}
            </select>
          </div>

          {/* Content type */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Contribution Type</label>
            <div className="grid grid-cols-2 gap-2">
              {contentTypes.map(ct => (
                <button key={ct.value} type="button" onClick={() => {
                  setContentType(ct.value);
                  removeFile();
                  setVideoUrl('');
                }}
                  className={`p-3 rounded-lg border text-left transition-all ${contentType === ct.value ? 'border-primary bg-primary/8' : 'border-border hover:border-primary/40'}`}>
                  <div className="text-sm font-medium text-foreground">{ct.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{ct.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Title <span className="text-destructive">*</span></label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder={
                contentType === 'written' ? 'e.g. CIA Triad — Detailed Breakdown' :
                contentType === 'pdf' ? 'e.g. Week 3 Lecture Notes — Cryptography' :
                contentType === 'video' ? 'e.g. Video: Public Key Infrastructure Explained' :
                'e.g. Past Q Tips — Network Security (2022/2023)'
              }
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors" />
          </div>

          {/* ── PDF / DOCX Upload ─────────────────────────────── */}
          {contentType === 'pdf' && (
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                Document <span className="text-destructive">*</span>
                <span className="text-muted-foreground font-normal ml-2">(.pdf, .doc, .docx — max {MAX_FILE_MB}MB)</span>
              </label>

              {!selectedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                >
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-foreground font-medium">Click to upload or drag & drop</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX up to {MAX_FILE_MB}MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_FILE_TYPES}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="border border-border rounded-xl p-4 flex items-center gap-3">
                  <FileText className="w-8 h-8 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>

                    {isExtracting && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-primary">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Reading document text for AI validation…
                      </div>
                    )}
                    {!isExtracting && extractedText && extractedText.length > 50 && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-green-500">
                        <CheckCircle2 className="w-3 h-3" />
                        {extractedText.trim().split(/\s+/).filter(Boolean).length.toLocaleString()} words extracted — AI will read the full document
                      </div>
                    )}
                    {!isExtracting && extractedText === null && selectedFile && (
                      <p className="text-xs text-orange-400 mt-1.5">Could not auto-read text — fill in the summary below</p>
                    )}

                    {uploading && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${uploadProgress}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Uploading… {uploadProgress}%</p>
                      </div>
                    )}
                    {uploadedFileUrl && (
                      <a href={uploadedFileUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                        <ExternalLink className="w-3 h-3" /> View uploaded file
                      </a>
                    )}
                  </div>
                  <button type="button" onClick={removeFile}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {fileError && (
                <div className="flex items-center gap-2 mt-2 text-destructive text-xs">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {fileError}
                </div>
              )}

              <div className="mt-3">
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Document Summary
                  <span className="text-muted-foreground font-normal ml-2">
                    {extractedText && extractedText.length > 50
                      ? '— optional, adds context'
                      : '— describe what this document covers (required if text could not be auto-read)'}
                  </span>
                </label>
                <textarea value={content} onChange={e => setContent(e.target.value)} rows={3}
                  placeholder="e.g. Week 3 lecture notes covering the CIA Triad, with definitions, examples, and exam-style questions."
                  className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-y transition-colors" />
              </div>
            </div>
          )}

          {/* ── Video Link ────────────────────────────────────── */}
          {contentType === 'video' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Video URL <span className="text-destructive">*</span>
                </label>
                <input type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=... or https://drive.google.com/..."
                  className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors" />
                <div className="flex flex-wrap gap-2 mt-2">
                  {VIDEO_PLATFORMS.map(p => (
                    <span key={p.name} className="text-xs text-muted-foreground border border-border/50 px-2 py-0.5 rounded-full">{p.name}</span>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/15 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">🎬 AI video analysis — coming soon</p>
                <p>Once subscriptions launch, the AI will be able to watch and summarise videos automatically. For now, please add a written summary below so the AI validator can check relevance.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Video Summary <span className="text-destructive">*</span>
                  <span className="text-muted-foreground font-normal ml-2">— briefly describe what the video covers</span>
                </label>
                <textarea value={content} onChange={e => setContent(e.target.value)} rows={4}
                  placeholder="e.g. This YouTube video by Professor John explains Public Key Infrastructure with visual diagrams."
                  className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-y transition-colors" />
              </div>
            </div>
          )}

          {/* ── Written / Past Q Tips ─────────────────────────── */}
          {(contentType === 'written' || contentType === 'past-question-tips') && (
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                Content <span className="text-destructive">*</span>
                <span className="text-muted-foreground font-normal ml-2">— Markdown supported</span>
              </label>
              <textarea value={content} onChange={e => setContent(e.target.value)} rows={10}
                placeholder={
                  contentType === 'written'
                    ? '## Topic Overview\n\nWrite your notes here. Use ## for headings, **bold**, bullet points, code blocks, etc.\n\nTip: The more detailed and accurate, the higher your accuracy score.'
                    : 'Share what topics appear most in past questions, common question formats, or exam tips for this course...'
                }
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-y transition-colors font-mono text-sm" />
              <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                <span>{content.length} characters</span>
                {content.length > 0 && content.length < 50 && <span className="text-orange-400">Minimum 50 characters required</span>}
              </div>
            </div>
          )}

          {/* What it adds */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              What does this add? <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input type="text" value={whatItAdds} onChange={e => setWhatItAdds(e.target.value)}
              placeholder="e.g. Covers exam tips for Chapter 3, includes diagrams missing from the textbook"
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors" />
          </div>

          {(user.tier === 'trusted_contributor' || user.tier === 'admin') && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/15">
              <span className="text-primary mt-0.5">⚡</span>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Fast Track enabled.</strong> Your contribution will skip the AI queue and go directly to admin review.
              </p>
            </div>
          )}

          <button type="submit" disabled={!canSubmit}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 min-h-[48px]">
            {isExtracting ? 'Reading document…' :
             uploading ? `Uploading… ${uploadProgress}%` :
             isAIProcessing ? 'AI is validating…' :
             'Submit for Review'}
          </button>
        </form>
      </div>
    </Layout>
  );
};

export default Contribute;
