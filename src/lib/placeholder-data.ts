export interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  yearLevel: number;
  semester: number;
  department?: string;
  prerequisites: string[];
  leadsTo: string[];
  contributorCount: number;
  noteCount: number;
  visible: boolean;
  active?: boolean;
}

export interface Contribution {
  id: string;
  courseId: string;
  contentType: 'written' | 'pdf' | 'video' | 'past-question-tips';
  title: string;
  content: string;
  pdfUrl?: string;
  videoUrl?: string;
  whatItAdds?: string;
  authorMatNumber: string;
  authorName: string;
  status: 'under_review' | 'ai_rejected' | 'ai_accepted' | 'admin_approved' | 'admin_rejected';
  isFastTrack: boolean;
  aiRejectionReason?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  accuracyScore?: number;
  isEdited?: boolean;
  reviewOutcome?: 'accepted_as_is' | 'accepted_with_edits' | 'rejected';
}

export interface StudyNote {
  content: string;
  generatedAt: string;
  sourceCount: number;
  syncMetadata?: {
    videoUrl: string;
    timestamps: { time: number; sectionId: string }[];
  };
}

export interface UserProfile {
  id: string;
  mat_number: string;
  display_name: string;
  email?: string;
  year_level: number;
  tier: 'guest' | 'verified_student' | 'trusted_contributor' | 'admin';
  status: 'pending' | 'verified' | 'rejected';
  accuracy_score: number;
  reviewed_contributions: number;
  total_contributions: number;
  rejection_note?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'ai_accepted' | 'ai_rejected' | 'admin_approved' | 'admin_rejected' | 'relevance_flagged';
  message: string;
  contributionId: string;
  read: boolean;
  createdAt: string;
}

const COURSES_KEY = 'cyberwiki-courses';
const CONTRIBUTIONS_KEY = 'cyberwiki-contributions';
const STUDY_NOTES_KEY = 'cyberwiki-study-notes';
const FINGERPRINTS_KEY = 'cyberwiki-content-fingerprints';

export const defaultCourses: Course[] = [
  // Year 1
  { id: "csc101", code: "CSC 101", title: "Introduction to Computer Science", description: "Fundamentals of computing, algorithms, and problem-solving.", yearLevel: 1, semester: 1, prerequisites: [], leadsTo: ["csc105", "csc106"], contributorCount: 24, noteCount: 18, visible: true },
  { id: "csc102", code: "CSC 102", title: "Programming Fundamentals", description: "Introduction to programming using Python and C.", yearLevel: 1, semester: 1, prerequisites: [], leadsTo: ["csc105"], contributorCount: 31, noteCount: 22, visible: true },
  { id: "csc103", code: "CSC 103", title: "Digital Logic & Design", description: "Boolean algebra, logic gates, and circuit design.", yearLevel: 1, semester: 1, prerequisites: [], leadsTo: [], contributorCount: 15, noteCount: 11, visible: true },
  { id: "csc104", code: "CSC 104", title: "Discrete Mathematics", description: "Set theory, graph theory, and combinatorics for CS.", yearLevel: 1, semester: 1, prerequisites: [], leadsTo: [], contributorCount: 19, noteCount: 14, visible: true },
  { id: "csc105", code: "CSC 105", title: "Object-Oriented Programming", description: "OOP concepts using Java: classes, inheritance, polymorphism.", yearLevel: 1, semester: 2, prerequisites: ["csc102"], leadsTo: [], contributorCount: 27, noteCount: 20, visible: true },
  { id: "csc106", code: "CSC 106", title: "Introduction to Web Technologies", description: "HTML, CSS, JavaScript basics, and web standards.", yearLevel: 1, semester: 2, prerequisites: [], leadsTo: [], contributorCount: 22, noteCount: 17, visible: true },
  { id: "csc107", code: "CSC 107", title: "Linear Algebra for Computing", description: "Vectors, matrices, and linear transformations for CS applications.", yearLevel: 1, semester: 2, prerequisites: [], leadsTo: [], contributorCount: 13, noteCount: 9, visible: true },
  { id: "csc108", code: "CSC 108", title: "Technical Writing & Communication", description: "Report writing, documentation, and technical presentation skills.", yearLevel: 1, semester: 2, prerequisites: [], leadsTo: [], contributorCount: 10, noteCount: 7, visible: true },
  // Year 2
  { id: "cyb201", code: "CYB 201", title: "Introduction to Cybersecurity", description: "Core cybersecurity principles, threat landscape, and security models.", yearLevel: 2, semester: 1, prerequisites: [], leadsTo: [], contributorCount: 28, noteCount: 21, visible: true },
  { id: "cyb202", code: "CYB 202", title: "Computer Networking", description: "Network protocols, TCP/IP, routing, and network architecture.", yearLevel: 2, semester: 1, prerequisites: [], leadsTo: [], contributorCount: 25, noteCount: 19, visible: true },
  { id: "cyb203", code: "CYB 203", title: "Operating Systems Security", description: "OS security mechanisms, access control, and hardening techniques.", yearLevel: 2, semester: 1, prerequisites: [], leadsTo: [], contributorCount: 18, noteCount: 13, visible: true },
  { id: "cyb204", code: "CYB 204", title: "Database Systems", description: "Relational databases, SQL, and database security fundamentals.", yearLevel: 2, semester: 1, prerequisites: [], leadsTo: [], contributorCount: 20, noteCount: 15, visible: true },
  { id: "cyb205", code: "CYB 205", title: "Cryptography Fundamentals", description: "Encryption algorithms, hashing, digital signatures, and PKI.", yearLevel: 2, semester: 2, prerequisites: [], leadsTo: [], contributorCount: 22, noteCount: 16, visible: true },
  { id: "cyb206", code: "CYB 206", title: "Web Application Security", description: "OWASP Top 10, secure coding, and web vulnerability assessment.", yearLevel: 2, semester: 2, prerequisites: [], leadsTo: [], contributorCount: 26, noteCount: 20, visible: true },
  { id: "cyb207", code: "CYB 207", title: "Statistics for Security", description: "Statistical methods for threat analysis and anomaly detection.", yearLevel: 2, semester: 2, prerequisites: [], leadsTo: [], contributorCount: 12, noteCount: 8, visible: true },
  { id: "cyb208", code: "CYB 208", title: "Professional Ethics in IT", description: "Cyber law, ethics, intellectual property, and compliance.", yearLevel: 2, semester: 2, prerequisites: [], leadsTo: [], contributorCount: 14, noteCount: 10, visible: true },
  // Year 3
  { id: "cyb301", code: "CYB 301", title: "Network Security", description: "Firewalls, IDS/IPS, VPNs, and network defense strategies.", yearLevel: 3, semester: 1, prerequisites: [], leadsTo: [], contributorCount: 20, noteCount: 15, visible: true },
  { id: "cyb302", code: "CYB 302", title: "Ethical Hacking", description: "Penetration testing methodologies, tools, and reporting.", yearLevel: 3, semester: 1, prerequisites: [], leadsTo: [], contributorCount: 30, noteCount: 24, visible: true },
  { id: "cyb303", code: "CYB 303", title: "Malware Analysis", description: "Reverse engineering malware, static and dynamic analysis.", yearLevel: 3, semester: 1, prerequisites: [], leadsTo: [], contributorCount: 16, noteCount: 12, visible: true },
  { id: "cyb304", code: "CYB 304", title: "Security Operations Center", description: "SOC operations, SIEM tools, and incident monitoring.", yearLevel: 3, semester: 1, prerequisites: [], leadsTo: [], contributorCount: 18, noteCount: 14, visible: true },
  { id: "cyb305", code: "CYB 305", title: "Digital Forensics", description: "Evidence collection, forensic tools, and chain of custody.", yearLevel: 3, semester: 2, prerequisites: [], leadsTo: [], contributorCount: 21, noteCount: 17, visible: true },
  { id: "cyb306", code: "CYB 306", title: "Cloud Security", description: "Securing cloud infrastructure, AWS/Azure security services.", yearLevel: 3, semester: 2, prerequisites: [], leadsTo: [], contributorCount: 19, noteCount: 14, visible: true },
  { id: "cyb307", code: "CYB 307", title: "Incident Response", description: "IR frameworks, playbooks, and post-incident procedures.", yearLevel: 3, semester: 2, prerequisites: [], leadsTo: [], contributorCount: 15, noteCount: 11, visible: true },
  { id: "cyb308", code: "CYB 308", title: "Security Research Methods", description: "Research methodology, academic writing, and literature review.", yearLevel: 3, semester: 2, prerequisites: [], leadsTo: [], contributorCount: 11, noteCount: 8, visible: true },
  // Year 4
  { id: "cyb401", code: "CYB 401", title: "Advanced Cryptography", description: "Post-quantum cryptography, zero-knowledge proofs, and protocols.", yearLevel: 4, semester: 1, prerequisites: [], leadsTo: [], contributorCount: 14, noteCount: 10, visible: true },
  { id: "cyb402", code: "CYB 402", title: "Cyber Threat Intelligence", description: "Threat modeling, intelligence frameworks, and APT analysis.", yearLevel: 4, semester: 1, prerequisites: [], leadsTo: [], contributorCount: 17, noteCount: 13, visible: true },
  { id: "cyb403", code: "CYB 403", title: "IoT & Industrial Security", description: "SCADA security, IoT vulnerabilities, and embedded systems.", yearLevel: 4, semester: 1, prerequisites: [], leadsTo: [], contributorCount: 12, noteCount: 9, visible: true },
  { id: "cyb404", code: "CYB 404", title: "Security Architecture", description: "Enterprise security design, zero trust, and defense in depth.", yearLevel: 4, semester: 1, prerequisites: [], leadsTo: [], contributorCount: 16, noteCount: 12, visible: true },
  { id: "cyb405", code: "CYB 405", title: "Capstone Project I", description: "Individual security research project proposal and planning.", yearLevel: 4, semester: 2, prerequisites: [], leadsTo: [], contributorCount: 8, noteCount: 5, visible: true },
  { id: "cyb406", code: "CYB 406", title: "Capstone Project II", description: "Project implementation, testing, and final presentation.", yearLevel: 4, semester: 2, prerequisites: [], leadsTo: [], contributorCount: 7, noteCount: 4, visible: true },
  { id: "cyb407", code: "CYB 407", title: "Governance & Compliance", description: "ISO 27001, NIST frameworks, risk management, and auditing.", yearLevel: 4, semester: 2, prerequisites: [], leadsTo: [], contributorCount: 13, noteCount: 10, visible: true },
  { id: "cyb408", code: "CYB 408", title: "Emerging Technologies in Security", description: "AI in security, blockchain security, and future threats.", yearLevel: 4, semester: 2, prerequisites: [], leadsTo: [], contributorCount: 15, noteCount: 11, visible: true },
];

export const defaultContributions: Contribution[] = [
  { id: "1", courseId: "csc101", contentType: "written", title: "What is an Algorithm?", content: "An algorithm is a step-by-step procedure for solving a problem or accomplishing a task. Key properties include: finiteness, definiteness, input, output, and effectiveness.\n\nCommon examples include binary search (O(log n)), bubble sort (O(n²)), and merge sort (O(n log n)).", authorMatNumber: "U2023/5571001", authorName: "Chidi Okonkwo", status: "admin_approved", isFastTrack: false, submittedAt: "2025-09-14T10:00:00Z", reviewedBy: "Dr. Adeyemi", reviewedAt: "2025-09-15T14:00:00Z", reviewOutcome: "accepted_as_is" },
  { id: "2", courseId: "csc101", contentType: "written", title: "Number Systems Explained", content: "Binary (base 2), Octal (base 8), Decimal (base 10), Hexadecimal (base 16). Converting between them: divide-and-remainder for decimal to others, positional notation for others to decimal.", authorMatNumber: "U2023/5571002", authorName: "Amina Bello", status: "admin_approved", isFastTrack: false, submittedAt: "2025-09-20T10:00:00Z", reviewedBy: "Dr. Adeyemi", reviewedAt: "2025-09-21T14:00:00Z", reviewOutcome: "accepted_as_is" },
  { id: "3", courseId: "csc101", contentType: "written", title: "Flowcharts vs Pseudocode", content: "Flowcharts use symbols (oval=start/end, rectangle=process, diamond=decision, parallelogram=I/O). Pseudocode uses structured English. Both describe algorithms before coding.", authorMatNumber: "U2023/5571003", authorName: "Emeka Nwankwo", status: "ai_accepted", isFastTrack: false, submittedAt: "2025-10-02T10:00:00Z" },
  { id: "4", courseId: "csc101", contentType: "past-question-tips", title: "CSC 101 Past Questions 2024", content: "Key topics: Algorithm properties, number system conversions, flowchart drawing, pseudocode writing. Focus on binary-to-hexadecimal conversion and algorithm complexity.", authorMatNumber: "U2023/5571004", authorName: "Grace Obi", status: "admin_approved", isFastTrack: false, submittedAt: "2025-10-15T10:00:00Z", reviewedBy: "Admin", reviewedAt: "2025-10-16T14:00:00Z", reviewOutcome: "accepted_with_edits" },
  { id: "5", courseId: "csc101", contentType: "video", title: "Intro to CS Video Lecture Notes", content: "Video summary covering Week 1-4 lecture content including history of computing, generations of computers, and Von Neumann architecture.", authorMatNumber: "U2023/5571005", authorName: "David Eze", status: "admin_approved", isFastTrack: false, submittedAt: "2025-11-01T10:00:00Z", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", reviewedBy: "Admin", reviewedAt: "2025-11-02T14:00:00Z", reviewOutcome: "accepted_as_is" },
];

export function loadFromStorage<T>(key: string, defaults: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return defaults;
}

export function saveToStorage<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export function loadCourses(): Course[] {
  return loadFromStorage(COURSES_KEY, defaultCourses);
}
export function saveCourses(courses: Course[]) {
  saveToStorage(COURSES_KEY, courses);
}

export function loadContributions(): Contribution[] {
  return loadFromStorage(CONTRIBUTIONS_KEY, defaultContributions);
}
export function saveContributions(contributions: Contribution[]) {
  saveToStorage(CONTRIBUTIONS_KEY, contributions);
}

export function loadStudyNotes(): Record<string, StudyNote> {
  return loadFromStorage(STUDY_NOTES_KEY, {});
}
export function saveStudyNotes(notes: Record<string, StudyNote>) {
  saveToStorage(STUDY_NOTES_KEY, notes);
}

export function loadFingerprints(): Record<string, string> {
  return loadFromStorage(FINGERPRINTS_KEY, {});
}
export function saveFingerprints(fp: Record<string, string>) {
  saveToStorage(FINGERPRINTS_KEY, fp);
}

export function generateFingerprint(contribs: Contribution[]): string {
  return contribs
    .filter(c => c.status === 'admin_approved')
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(c => `${c.id}:${c.content.length}`)
    .join('|');
}

export const yearLevelMeta = [
  { level: 1, title: "Year 1 — Foundations", subtitle: "Foundations", icon: "🔰", description: "Core CS fundamentals and mathematical foundations" },
  { level: 2, title: "Year 2 — Core Security", subtitle: "Core Security", icon: "🛡️", description: "Introduction to cybersecurity concepts and networking" },
  { level: 3, title: "Year 3 — Specialization", subtitle: "Specialization", icon: "⚔️", description: "Advanced security topics and hands-on practice" },
  { level: 4, title: "Year 4 — Mastery", subtitle: "Mastery", icon: "🎓", description: "Expert-level security and capstone projects" },
];
