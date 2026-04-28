const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { title, content, contentType, courseTitle, courseCode } = await req.json()

    if (!title || !content) {
      return new Response(JSON.stringify({ error: 'Missing title or content' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const issues: string[] = []

    // Basic length checks
    if (content.length < 50) issues.push('Content is too short (minimum 50 characters)')
    if (title.length < 5) issues.push('Title is too short (minimum 5 characters)')
    if (title.length > 200) issues.push('Title is too long (maximum 200 characters)')

    const words = content.split(/\s+/).filter(Boolean)
    if (words.length < 20) issues.push('Content has too few words (minimum 20 words)')
    if (/(.)\1{10,}/.test(content)) issues.push('Content contains repeated characters (possible spam)')

    // If basic checks fail, return early
    if (issues.length > 0) {
      return new Response(JSON.stringify({
        isValid: false,
        issues,
        qualityScore: 0,
        isRelevant: false,
        relevanceReason: 'Failed basic quality checks',
        validatedAt: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use Lovable AI for relevance and quality checking
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    let isRelevant = true
    let relevanceReason = ''
    let qualityScore = 0.5

    if (LOVABLE_API_KEY && courseTitle) {
      try {
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
                content: `You are an academic content validator for a university Cybersecurity department. You must evaluate student contributions for quality and relevance to the specified course. Be strict but fair.`,
              },
              {
                role: 'user',
                content: `Evaluate this contribution for the course "${courseCode} — ${courseTitle}".

Content Type: ${contentType}
Title: "${title}"
Content:
"""
${content.slice(0, 3000)}
"""

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "isRelevant": true/false,
  "relevanceReason": "brief explanation of why it is or isn't relevant to this specific course",
  "qualityScore": 0.0 to 1.0,
  "qualityIssues": ["list of any quality issues found, empty array if none"],
  "summary": "one-sentence summary of the content"
}`,
              },
            ],
          }),
        })

        if (aiResponse.ok) {
          const aiData = await aiResponse.json()
          const aiText = aiData.choices?.[0]?.message?.content || ''
          
          // Parse JSON from AI response, handling possible markdown wrapping
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
      // Fallback: basic relevance check
      if (courseTitle && contentType === 'written') {
        const contentLower = content.toLowerCase()
        const titleWords = courseTitle.toLowerCase().split(/\s+/)
        const hasRelevance = titleWords.some((w: string) => w.length > 3 && contentLower.includes(w))
        if (!hasRelevance && words.length < 50) {
          isRelevant = false
          relevanceReason = 'Content may not be relevant to the course topic'
        }
      }
      qualityScore = Math.max(0, Math.min(1,
        (Math.min(words.length, 200) / 200) * 0.4 +
        (content.includes('\n') ? 0.2 : 0) +
        (title.length >= 10 ? 0.2 : 0.1) +
        (issues.length === 0 ? 0.2 : 0)
      ))
    }

    const isValid = issues.length === 0 && qualityScore >= 0.3

    return new Response(JSON.stringify({
      isValid,
      issues,
      qualityScore: Math.round(qualityScore * 100) / 100,
      isRelevant,
      relevanceReason,
      validatedAt: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Validation failed', details: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
