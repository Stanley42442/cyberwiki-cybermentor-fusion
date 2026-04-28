// supabase/functions/generate-knowledge-base/index.ts
// Generates comprehensive knowledge base content for a given entity.
// Called from the admin dashboard. Uses Gemma 4 31B with high token budget.
// Stores result in the knowledge_bases table.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_KEY = () => Deno.env.get('GEMINI_API_KEY') ?? '';

async function generate(prompt: string, systemText: string, maxTokens = 8192): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${GEMINI_KEY()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemText }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.6 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemma error ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ── KB prompts per type ────────────────────────────────────────

function careerPathPrompt(careerId: string, careerTitle: string): string {
  return `Write a comprehensive knowledge base for the cybersecurity career path: "${careerTitle}".

This document will be used by an AI tutor to teach Nigerian university students (UNIPORT) pursuing this career. It must be the single most useful reference document a mentor in this field could write.

Structure:
## 1. Career Overview
- What this role does day-to-day in Nigeria and internationally
- Where these professionals work (banks, telecoms, government, consulting)
- Average salary ranges in Nigeria (₦) and remote/international ($)

## 2. Core Technical Competencies
For each competency: definition, why it matters for this career, how deeply it must be understood
Cover every major technical area relevant to ${careerTitle}

## 3. Essential Tools & Technologies
For each tool: what it does, when to use it, free vs paid, Nigerian availability/alternatives

## 4. Certifications Roadmap
Entry level → Mid level → Senior level
For each cert: what it proves, cost, how to study on a Nigerian budget, exam format

## 5. Nigerian Market Context
- Key industries hiring this role in Nigeria
- What Nigerian employers specifically test in interviews
- NDPR, Cybercrimes Act 2015, NCC regulations relevant to this role
- Remote work opportunities accessible from Nigeria

## 6. Career Progression
Junior → Mid → Senior → Lead → CISO/Specialist track
Timeline expectations, skill gates at each level

## 7. Common Interview Questions
10 technical questions with model answers
5 scenario-based questions with what interviewers look for

## 8. Learning Resources
Free resources (YouTube, TryHackMe, HackTheBox, etc.)
Nigerian-accessible paid options
Communities and mentorship networks

Write with depth, precision, and practical Nigerian context throughout.`;
}

function careerTopicPrompt(careerId: string, careerTitle: string, topicTitle: string, topicId: string): string {
  return `Write a deep-dive knowledge base document on the topic "${topicTitle}" for the ${careerTitle} career path.

This document will be injected into an AI tutor's context when a student is studying this specific topic. It must be comprehensive enough that the AI can teach this topic at the level of a senior practitioner — not a summary, but a genuine expert reference.

Structure:
## What is ${topicTitle}?
Precise technical definition. Historical context. Why it exists.

## How It Works — The Deep Technical Picture
Go deep. Cover the mechanism, the protocol, the algorithm, or the process at a level that would satisfy a CIEM or OSCP examiner. Use examples throughout.

## Variants and Sub-categories
Every major variant, type, or sub-category with their distinctions

## Tools and Implementation
Specific tools used in ${careerTitle} work involving ${topicTitle}
Commands, configurations, practical workflows

## Attack Vectors and Defences (if applicable)
How this is exploited and how it is defended

## Nigerian and African Context
How this applies specifically in Nigerian networks, regulations, and industry

## UNIPORT Exam Angle
What types of exam questions cover this topic
Model answers for definition, application, and scenario questions

## Common Mistakes and Misconceptions
What students and junior practitioners get wrong

## Worked Examples
At least 3 concrete, realistic scenarios from a ${careerTitle} perspective

Write as a senior ${careerTitle} practitioner who is also an exceptional teacher. Assume the student has foundation cybersecurity knowledge but is not yet an expert in this specific topic.`;
}

function aiLiteracyCareerPrompt(careerId: string, careerTitle: string): string {
  return `Write a comprehensive AI Literacy knowledge base specifically for the ${careerTitle} career path in cybersecurity.

This is NOT a generic "how to use AI" document. It must be specifically scoped to how ${careerTitle} professionals use AI tools in their daily work, the unique risks they face, and the specific skills they need.

Structure:
## The AI Landscape for ${careerTitle} in 2025–2026
Which AI tools are actually being used in this role right now
How AI has changed this job in the past 2 years
What parts of ${careerTitle} work AI has automated and what remains human

## AI Tools Specific to ${careerTitle}
For each major tool: what it does, how to use it effectively, what it misses, whether it is safe for client/sensitive data
Focus on tools specifically relevant to ${careerTitle} workflows

## Data Security When Using AI (${careerTitle} Context)
What data is handled in ${careerTitle} work (client credentials, vulnerability data, evidence, code, etc.)
Which of this data can never be sent to consumer AI APIs and why
Safe workflows for using AI with sensitive data (local models, anonymisation, etc.)

## Prompt Engineering for ${careerTitle}
How to craft prompts for ${careerTitle}-specific tasks (report writing, analysis, code review, etc.)
Prompt templates that produce reliable, accurate output for this role
How to structure AI interactions to get expert-level responses

## Verifying AI Output — The ${careerTitle} Standard
How AI fails specifically in ${careerTitle} contexts (hallucinated CVEs, wrong configurations, incorrect legal claims, etc.)
A verification framework: what to always check before acting on AI output
When to trust AI and when to override it

## AI-Powered Threats Relevant to ${careerTitle}
How attackers are using AI in ways that specifically affect ${careerTitle} work
What new attack patterns have emerged that this role must defend against
How AI changes the threat landscape for systems this role protects

## Regulatory and Ethical Considerations
Nigerian NDPR obligations when using AI tools that process personal data
International regulations affecting AI use in security contexts
Ethical considerations specific to ${careerTitle} AI use
Disclosure obligations when AI was used in professional deliverables

## Practical Workflows
5 specific workflows where ${careerTitle} professionals should use AI
5 specific situations where AI must not be used or must be heavily verified
Decision framework: "Should I use AI for this task?"

Write with concrete, specific, actionable content for someone working as a ${careerTitle} in Nigeria in 2025–2026.`;
}

function aiLiteracyTopicPrompt(careerId: string, careerTitle: string, topicTitle: string, topicDescription: string): string {
  return `Write a comprehensive deep-dive on "${topicTitle}" for ${careerTitle} professionals.

Context: ${topicDescription}

This document will be used by an AI tutor to teach this specific AI literacy topic to students pursuing the ${careerTitle} career path. It must be specific to ${careerTitle} work — not generic AI literacy content.

Structure:
## What is ${topicTitle}?
Clear definition in the context of ${careerTitle} work specifically

## Why ${careerTitle} Professionals Must Understand This
Concrete consequences of not knowing this in ${careerTitle} work
Real-world incidents or examples where this mattered

## The Technical Picture
Go deep on the mechanics. How does this actually work?
What does a ${careerTitle} practitioner need to understand technically?

## Practical Application for ${careerTitle}
Step-by-step workflows for how a ${careerTitle} professional uses or defends against this
Tool-specific guidance relevant to ${careerTitle}

## Nigerian Context
How does this specifically apply working in Nigeria?
Local regulations, tools available, industry standards

## Common Mistakes
What ${careerTitle} professionals get wrong about this topic
How to avoid them

## Hands-On Exercises
3 practical exercises a student can do with free tools to build this skill

## Assessment Questions
5 exam-style questions (definitions, applications, scenarios) with model answers

Write as a senior ${careerTitle} practitioner who also deeply understands AI systems.`;
}

function courseTopicPrompt(courseCode: string, courseTitle: string, topicName: string, studyNoteSection: string): string {
  return `Write a deep-dive knowledge base document on "${topicName}" for the course ${courseCode} — ${courseTitle} at UNIPORT Nigeria.

${studyNoteSection ? `Existing study note content for this topic:\n${studyNoteSection}\n\nExpand significantly on the above.` : ''}

This document will be used by an AI course tutor. It must be comprehensive enough to answer any exam question on this topic and deep enough to satisfy a first-class student.

Structure:
## Formal Definition
Academic-level definition as it would appear in a textbook

## Conceptual Foundation
Why does this exist? What problem does it solve? Historical background.

## Technical Deep-Dive
The mechanisms, algorithms, or processes in full technical detail
Every sub-component explained

## UNIPORT Exam Context
What exam question types cover this topic (Section A definition, Section B application, Section C essay)
Model answers at different grade levels (pass / credit / distinction)
5 past-question-style questions with full answers

## Nigerian and African Applications
Real-world examples from Nigerian industry, banking, government, or telecoms
NDPR, Cybercrimes Act 2015, or NCC regulations that touch this topic

## Worked Examples
At least 4 concrete examples with step-by-step worked solutions

## Common Student Errors
What students consistently get wrong in exams on this topic
How to avoid those mistakes

## Connections to Other Topics
How this topic relates to other topics in ${courseCode}
What you must understand first (prerequisites) and what this enables next

Write at the level of a brilliant UNIPORT lecturer who has taught this topic for 10 years.`;
}

// ── Main handler ────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // Auth check
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Unauthorised' }), { status: 401, headers: cors });

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: authErr } = await sb.auth.getUser(auth.replace('Bearer ', ''));
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorised' }), { status: 401, headers: cors });

    // Admin check
    const { data: profile } = await sb.from('profiles').select('tier').eq('id', user.id).maybeSingle();
    if (profile?.tier !== 'admin') return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: cors });

    const body = await req.json();
    const { type, entityId, careerId, careerTitle, topicTitle, topicDescription, courseCode, courseTitle, studyNoteSection } = body;

    if (!type || !entityId) return new Response(JSON.stringify({ error: 'type and entityId required' }), { status: 400, headers: cors });

    let prompt = '';
    let systemText = 'You are a world-class cybersecurity educator and practitioner writing comprehensive reference documents for an AI tutoring platform. Be specific, deep, and practical. Nigerian context is essential throughout.';
    let title = topicTitle || entityId;
    let maxTokens = 8192;

    switch (type) {
      case 'career_path':
        prompt = careerPathPrompt(careerId, careerTitle);
        maxTokens = 16384;
        break;
      case 'career_topic':
        prompt = careerTopicPrompt(careerId, careerTitle, topicTitle, entityId);
        maxTokens = 12288;
        break;
      case 'ai_literacy':
        prompt = aiLiteracyCareerPrompt(careerId, careerTitle);
        title = `AI Literacy for ${careerTitle}`;
        maxTokens = 12288;
        break;
      case 'ai_literacy_topic':
        prompt = aiLiteracyTopicPrompt(careerId, careerTitle, topicTitle, topicDescription ?? '');
        maxTokens = 8192;
        break;
      case 'course_topic':
        prompt = courseTopicPrompt(courseCode, courseTitle, topicTitle, studyNoteSection ?? '');
        systemText = 'You are a brilliant UNIPORT cybersecurity lecturer and author writing a comprehensive exam-prep knowledge base for your students.';
        maxTokens = 12288;
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown type: ${type}` }), { status: 400, headers: cors });
    }

    console.log(`[gen-kb] Generating ${type} KB for ${entityId}...`);
    const content = await generate(prompt, systemText, maxTokens);

    if (!content || content.length < 100) {
      throw new Error('Generation produced empty or too-short content');
    }

    // Upsert into knowledge_bases
    const { error: upsertErr } = await sb.from('knowledge_bases').upsert(
      {
        type,
        entity_id: entityId,
        title,
        content,
        is_ready: false,  // admin must review and mark ready before tutors use it
        generated_by: 'ai',
        last_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'type,entity_id' }
    );

    if (upsertErr) throw new Error(`DB upsert failed: ${upsertErr.message}`);

    console.log(`[gen-kb] ✓ ${type}:${entityId} — ${content.length} chars`);

    return new Response(
      JSON.stringify({ success: true, entityId, type, charCount: content.length, preview: content.slice(0, 300) }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[gen-kb] error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: cors });
  }
});
