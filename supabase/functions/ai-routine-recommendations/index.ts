import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      console.error('Authentication failed:', userError)
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch user's routines
    const { data: routines, error: routinesError } = await supabaseClient
      .from('routines')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })

    if (routinesError) {
      console.error('Database error fetching routines:', routinesError)
      throw new Error('Failed to load your routines')
    }

    // Fetch user's calendar events
    const { data: events, error: eventsError } = await supabaseClient
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .gte('event_date', new Date().toISOString().split('T')[0])
      .order('event_date', { ascending: true })

    if (eventsError) {
      console.error('Database error fetching events:', eventsError)
      throw new Error('Failed to load your calendar events')
    }

    console.log(`Processing recommendations for user data`)

    // Prepare context for AI
    const routineContext = routines?.map(r => 
      `- ${r.name} at ${r.time} on ${r.date}${r.description ? ': ' + r.description : ''}`
    ).join('\n') || 'No routines scheduled'

    const eventContext = events?.map(e => 
      `- ${e.title} on ${new Date(e.start_time).toLocaleString()}${e.description ? ': ' + e.description : ''}`
    ).join('\n') || 'No upcoming events'

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured')
    }

    // Call Lovable AI for recommendations
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a personal productivity assistant. Analyze the user\'s routines and calendar events to provide personalized, actionable recommendations. Focus on time management, balance, and productivity improvements. Keep recommendations concise and practical.'
          },
          {
            role: 'user',
            content: `Here are my scheduled routines:\n${routineContext}\n\nAnd my upcoming calendar events:\n${eventContext}\n\nBased on my schedule, please provide 3-5 personalized recommendations to improve my productivity, time management, or work-life balance. Format each recommendation as a bullet point with a brief explanation.`
          }
        ],
      }),
    })

    if (!aiResponse.ok) {
      console.error('AI service error:', aiResponse.status, await aiResponse.text())
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Too many requests. Please try again in a moment.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'Service temporarily unavailable. Please contact support.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      throw new Error('AI service unavailable')
    }

    const aiData = await aiResponse.json()
    const recommendations = aiData.choices?.[0]?.message?.content

    if (!recommendations) {
      throw new Error('No recommendations generated')
    }

    console.log('Generated recommendations successfully')

    return new Response(JSON.stringify({ 
      recommendations,
      routineCount: routines?.length || 0,
      eventCount: events?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Recommendation generation error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate recommendations'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
