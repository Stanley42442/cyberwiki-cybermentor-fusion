

# CyberWiki UNIPORT — Full System Description

This is a research/documentation answer (no code changes). Below is a comprehensive walkthrough of what the site is, how every piece works, and what it's trying to achieve.

---

## 1. What CyberWiki Is

**CyberWiki UNIPORT** is a private, student-only academic knowledge platform built specifically for the **Department of Cybersecurity at the University of Port Harcourt**. It's a hybrid between a wiki, a peer-reviewed journal, and an AI-powered textbook generator.

The core idea: students contribute notes, summaries, past-question walkthroughs, and explanations for their courses. An AI layer validates each contribution for quality and relevance, admins do a second human review, and then a separate AI fuses everything approved for a course into a single **comprehensive, textbook-quality study note** that any student in the department can read, search, and export as a PDF.

It is deliberately gated to UNIPORT students — sign-up requires a matriculation number (e.g. `U2023/5571085`), which is converted internally to a synthetic email so Supabase Auth can manage the session. Outsiders cannot self-register.

---

## 2. Goals (What It's Solving)

- **Fix scattered, unreliable study materials** — replace WhatsApp PDF dumps and lost handouts with one curated, searchable source per course.
- **Reward good contributors** — leaderboard, accuracy scores, tier promotions (verified student → trusted contributor → admin) so academic effort gets visible recognition.
- **Quality control without burning out admins** — AI does a first-pass quality + relevance check so human admins only review content that already passed automated filters.
- **Generate textbook-grade notes automatically** — instead of every student rewriting the same material, the AI synthesizes all approved contributions per course into a structured, exam-ready document with diagrams, case studies, and "Exam Focus" sections.
- **Build institutional credibility** — peer-reviewed, attributed contributions create a permanent department-owned knowledge base.

---

## 3. User Roles & Tiers

Stored in the `profiles` table, two orthogonal axes:

**Status** (verification state):
- `pending` — just signed up, can browse but not contribute
- `verified` — admin confirmed they're a real UNIPORT student, can contribute
- `rejected` — sign-up denied, with a rejection note

**Tier** (privilege level):
- `verified_student` — default, can submit contributions (go through full AI + admin review)
- `trusted_contributor` — fast-track flag set on submissions, signals reduced friction
- `admin` — full access to Admin Dashboard (verify users, approve/reject contributions, force-regenerate study notes, promote/demote)

---

## 4. Page-by-Page Walkthrough

### Public / Auth pages
- **`/` (Index)** — landing page, project intro, CTA to browse or sign up.
- **`/login`, `/signup`** — mat-number + password forms. Signup also captures display name and year level (1–5).

### Browsing
- **`/browse`** — top-level catalog of all courses across all year levels.
- **`/year/:level`** — courses filtered to a specific year (100L–500L).
- **`/course/:id`** — single course page: description, list of approved contributions, link to the AI study note.
- **`/course/:id/study-note`** — the synthesized AI textbook for that course, rendered with `MarkdownRenderer` and `SyncPlayer` (synchronized scroll between markdown sections and any associated media). PDF export available.
- **`/search`** — global search across courses, contributions, study notes.

### Contribution & community
- **`/contribute`** — submission form: pick a course, choose content type (notes, summary, past-question solution, etc.), title, and content body. On submit it's queued for AI validation.
- **`/leaderboard`** — ranks users by approved contributions and accuracy score.
- **`/profile`** — the logged-in user's stats, contribution history, notifications.

### Admin
- **`/admin`** — Admin Dashboard: pending user verifications, pending contributions awaiting human review, force-regenerate study note button per course, promotion/demotion controls.

### Misc
- **`/*` (NotFound)** — 404 page.

---

## 5. How a Contribution Flows End-to-End

```text
Student submits via /contribute
        │
        ▼
Saved as 'under_review' in contributions list (localStorage)
        │
        ▼
Edge function: validate-contribution (Gemini 2.5)
   ├── Quality score
   ├── Relevance check (does it match the course?)
   └── Issues list
        │
        ├── isValid = false  →  status: 'ai_rejected'  →  notify author
        │
        └── isValid = true   →  status: 'ai_accepted'  →  appears in admin queue
                                       │
                                       ▼
                       Admin reviews in /admin
                                       │
                       ┌───────────────┴──────────────┐
                       ▼                              ▼
              status: 'admin_approved'       status: 'admin_rejected'
                       │                              │
                       ▼                              ▼
       Visible on course page           Author notified with reason
                       │
                       ▼
       Triggers study-note regeneration check
       (fingerprint of approved set changes)
                       │
                       ▼
       Edge function: generate-study-note (Gemini 2.5 Pro)
       Produces textbook-quality markdown for /course/:id/study-note
```

If the AI flags content as **not relevant** to the course (even if quality is okay), all admin users get a notification so they can manually review before approval.

---

## 6. The AI Study Note Engine

This is the flagship feature. It lives in `supabase/functions/generate-study-note/index.ts`.

**Trigger paths:**
1. **Automatic** — `ContributionsProvider` periodically (every 30 min, plus 5s after load) computes a "fingerprint" of all `admin_approved` contributions per course. If the fingerprint changed since last generation, it regenerates.
2. **Manual** — admin clicks "Force Regenerate" on the dashboard.

**What the AI does:**
- Reads every approved contribution for the course.
- Supplements with its internal academic knowledge (industry standards: ISO 27001, NIST, OWASP; real-world case studies; Nigerian/UNIPORT-relevant context where applicable).
- Outputs structured markdown with: introduction, progressive subtopics, Mermaid diagrams for architectures, comparison tables, "Exam Focus" boxes with sample questions, and per-section "Key Takeaways."
- Returns `studyNote`, `generatedAt`, and `syncMetadata` (used by SyncPlayer for synchronized scrolling).

**Storage:** Generated notes are saved to localStorage (`studyNotes` keyed by courseId) along with the source contribution count and sync metadata.

**Export:** A separate `export-pdf` edge function converts the markdown to a downloadable academic PDF.

---

## 7. State & Data Architecture

**Backend (Supabase / Lovable Cloud):**
- `auth.users` — managed by Supabase Auth. Mat number is converted to `<mat>@student.uniport.edu.ng` synthetic email.
- `public.profiles` — mirrors auth users with department-specific fields: `mat_number`, `display_name`, `year_level`, `tier`, `status`, `accuracy_score`, `reviewed_contributions`, `total_contributions`, `rejection_note`. RLS-protected. A trigger auto-creates a profile row on signup using the metadata passed in `options.data`.
- **Edge Functions:**
  - `validate-contribution` — AI quality + relevance gate
  - `generate-study-note` — textbook synthesis
  - `export-pdf` — markdown → PDF

**Client-side state (React Context):**
- `AuthProvider` (`auth-context.tsx`) — current user, all users (for admin views), notifications, login/signup/logout, role mutations. Listens to `supabase.auth.onAuthStateChange` and refetches the profile.
- `CoursesProvider` (`courses-context.tsx`) — course catalog.
- `ContributionsProvider` (`contributions-context.tsx`) — contributions list, study notes cache, submit/edit/approve/reject actions, auto-regeneration loop.
- `ThemeProvider` — dark/light mode.

**Persisted in localStorage** (currently — not yet in DB):
- contributions list
- study notes cache + fingerprints
- notifications

This is a known architectural gap: contributions and study notes should eventually move to Supabase tables for true multi-user sync.

---

## 8. UI / Design System

- **Stack:** Vite + React 18 + TypeScript, Tailwind CSS v3, shadcn/ui (Radix primitives), Framer Motion for animations.
- **Routing:** react-router-dom v6.
- **Data fetching:** TanStack React Query (set up but lightly used so far — most state is in Contexts).
- **Toasts:** dual system (`@/components/ui/toaster` + `sonner`).
- **Markdown:** custom `MarkdownRenderer` with Mermaid diagram support; `SyncPlayer` for synchronized video/markdown navigation; `StudyNoteTOC` for table-of-contents sidebar.
- **Layout:** `Header` (nav + user menu + notifications bell) + `Layout` wrapper + `Footer` (attribution: "Built by students, Department of Cybersecurity, Uniport").
- **Theme:** professional academic look, mono font for branding, dark mode supported.

---

## 9. Notifications System

In-app notification bell (in Header). Generated when:
- AI accepts or rejects your contribution
- Admin approves or rejects your contribution
- Admin gets a relevance-flag notification when AI suspects a contribution is off-topic

Currently stored in localStorage per browser (`cyberwiki-notifications`), which means notifications don't follow a user across devices yet.

---

## 10. Current Strengths

- Working AI dual-pipeline (validation + synthesis) with no paid API dependencies (uses Lovable AI Gateway / Gemini).
- Mat-number gating creates a real moat — only UNIPORT students.
- Role/tier system with proper Supabase RLS via `has_role` pattern.
- Auto-regenerating study notes mean the textbook stays fresh as new contributions land.
- Clean UX: contribute → AI feedback → admin review → published, all visible to the author via notifications.

## 11. Current Limitations / Known Gaps

- Contributions, study notes, and notifications live in **localStorage**, not the database — they don't sync across devices or users yet (admins on different machines see different queues).
- No payments, no Pro tier, no quotas — everything is free and unlimited.
- No tutor chat, no quiz/exam generator, no analytics dashboard for the department.
- Sign-up is open to any mat-number string — there's no real verification that the mat number belongs to a real UNIPORT student beyond admin manual review.
- Footer attribution is generic ("students of Cybersecurity") — your name (Stanley) isn't yet on the public landing page.

---

## 12. The Bigger Picture

CyberWiki is positioned to become the **default academic knowledge layer for the UNIPORT Cybersecurity department**: a place where every course has a living, peer-reviewed textbook, where good contributors are publicly recognized, and where the AI does the heavy lifting of turning fragmented student notes into something genuinely studyable for exams. The technical foundation (auth, roles, AI pipeline, study-note generation) is in place — what remains is moving the contribution/notes data into the database for real multi-device sync, and layering on the reputation, monetization, and tutor features on top of that base.

