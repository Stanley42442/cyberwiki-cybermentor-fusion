// supabase/functions/validate-contribution/index.ts
// Validates a contribution and updates its status in the DB using the service role key.
// This bypasses RLS entirely, so the client never needs to do the status upsert.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      contributionId,   // NEW: used to update the DB status directly
      title,
      content,
      contentType,
      courseTitle,
      courseCode,
    } = await req.json()

    if (!title || !content) {
      return new Response(JSON.stringify({ error: 'Missing title or content' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const issues: string[] = []

    // Basic length checks — more lenient for document/pdf types
    // because the extracted text may be formatted differently
    const isPdfType = contentType === 'pdf'
    const minChars = isPdfType ? 30 : 50
    const minWords = isPdfType ? 10 : 20

    if (content.length < minChars) issues.push(`Content is too short (minimum ${minChars} characters)`)
    if (title.length < 5) issues.push('Title is too short (minimum 5 characters)')
    if (title.length > 200) issues.push('Title is too long (maximum 200 characters)')

    const words = content.split(/\s+/).filter(Boolean)
    if (words.length < minWords) issues.push(`Content has too few words (minimum ${minWords} words)`)
    if (/(.)\1{10,}/.test(content)) issues.push('Content contains repeated characters (possible spam)')

    if (issues.length > 0) {
      const result = {
        isValid: false,
        issues,
        qualityScore: 0,
        isRelevant: false,
        relevanceReason: 'Failed basic quality checks',
        validatedAt: new Date().toISOString(),
      }
      if (contributionId) {
        await updateContributionStatus(contributionId, false, result.issues.join('; '), 0)
      }
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // AI validation
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    let isRelevant = true
    let relevanceReason = ''
    let qualityScore = 0.5

    if (LOVABLE_API_KEY && courseTitle) {
      try {
        // For documents, take the first 3000 chars (the extracted text)
        const contentSample = isPdfType ? content.slice(0, 4000) : content.slice(0, 3000)

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              {
                role: 'system',
                content: `You are an academic content validator for a university Cybersecurity department. You evaluate student contributions for quality and relevance. For document uploads (PDF/DOCX), be more lenient because the text is machine-extracted and may have formatting artefacts. Focus on whether the core academic content is relevant and substantial, not formatting perfection.`,
              },
              {
                role: 'user',
                content: `Evaluate this contribution for the course "${courseCode} — ${courseTitle}".

Content Type: ${contentType}
Title: "${title}"
Content (first 4000 chars of ${content.length} total):
"""
${contentSample}
"""

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "isRelevant": true/false,
  "relevanceReason": "brief explanation",
  "qualityScore": 0.0 to 1.0,
  "qualityIssues": [],
  "summary": "one-sentence summary"
}`,
              },
            ],
          }),
        })

        if (aiResponse.ok) {
          const aiData = await aiResponse.json()
          const aiText = aiData.choices?.[0]?.message?.content || ''
          let cleanJson = aiText.trim()
          if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
          }
          try {
            const parsed = JSON.parse(cleanJson)
            isRelevant = parsed.isRelevant !== false
            relevanceReason = parsed.relevanceReason || ''
            qualityScore = typeof parsed.qualityScore === 'number' ? parsed.qualityScore : 0.5
            if (Array.isArray(parsed.qualityIssues)) {
              issues.push(...parsed.qualityIssues)
            }
          } catch {
            console.error('Failed to parse AI response:', aiText)
          }
        } else if (aiResponse.status === 429) {
          console.warn('AI rate limited, falling back to basic validation')
        } else if (aiResponse.status === 402) {
          console.warn('AI credits exhausted, falling back to basic validation')
        }
      } catch (e) {
        console.error('AI validation error:', e)
      }
    } else {
      // Fallback basic relevance check — applies to all content types
      if (courseTitle) {
        const contentLower = content.toLowerCase()
        const titleWords = courseTitle.toLowerCase().split(/\s+/)
        const hasRelevance = titleWords.some((w: string) => w.length > 3 && contentLower.includes(w))
        if (!hasRelevance && words.length < 50) {
          // For documents, only flag, don't reject — the extracted text may not contain exact course keywords
          if (!isPdfType) {
            isRelevant = false
            relevanceReason = 'Content may not be relevant to the course topic'
          }
        }
      }
      qualityScore = Math.max(0, Math.min(1,
        (Math.min(words.length, 200) / 200) * 0.4 +
        (content.includes('\n') ? 0.2 : 0) +
        (title.length >= 10 ? 0.2 : 0.1) +
        (issues.length === 0 ? 0.2 : 0)
      ))
      // Document contributions get a slight quality score boost in fallback
      if (isPdfType) qualityScore = Math.max(qualityScore, 0.4)
    }

    const isValid = issues.length === 0 && qualityScore >= 0.3

    const result = {
      isValid,
      issues,
      qualityScore: Math.round(qualityScore * 100) / 100,
      isRelevant,
      relevanceReason,
      validatedAt: new Date().toISOString(),
    }

    // Update the contribution status in the DB using service role (bypasses RLS)
    if (contributionId) {
      await updateContributionStatus(
        contributionId,
        isValid,
        isValid ? undefined : (issues.join('; ') || 'Did not pass quality checks'),
        result.qualityScore
      )
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Validation failed', details: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// Update contribution status using the service role key (bypasses RLS)
async function updateContributionStatus(
  contributionId: string,
  isValid: boolean,
  rejectionReason: string | undefined,
  qualityScore: number
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[validate-contribution] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { error } = await adminClient
    .from('contributions')
    .update({
      status: isValid ? 'ai_accepted' : 'ai_rejected',
      ai_rejection_reason: rejectionReason ?? null,
      accuracy_score: qualityScore,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contributionId)

  if (error) {
    console.error('[validate-contribution] Failed to update contribution status:', error.message)
  } else {
    console.log(`[validate-contribution] ${contributionId} → ${isValid ? 'ai_accepted' : 'ai_rejected'}`)
  }
}
