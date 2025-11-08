import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    console.log("Received chat request with messages:", messages);

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error('Authentication failed:', userError);
      throw new Error('Authentication required');
    }

    console.log('Authenticated user:', user.id);

    // Fetch user's routines
    const { data: routines, error: routinesError } = await supabaseClient
      .from('routines')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true });

    if (routinesError) {
      console.error('Error fetching routines:', routinesError);
    }

    // Fetch user's calendar events
    const { data: events, error: eventsError } = await supabaseClient
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .gte('event_date', new Date().toISOString().split('T')[0])
      .order('event_date', { ascending: true });

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
    }

    // Build context from user data
    const routineContext = routines?.map(r => 
      `- ${r.name} at ${r.time} on ${r.date}${r.description ? ': ' + r.description : ''}${r.location ? ' (Location: ' + r.location + ')' : ''}`
    ).join('\n') || 'No routines currently scheduled';

    const eventContext = events?.map(e => 
      `- ${e.title} on ${new Date(e.start_time).toLocaleDateString()} at ${new Date(e.start_time).toLocaleTimeString()}${e.description ? ': ' + e.description : ''}${e.location ? ' (Location: ' + e.location + ')' : ''}`
    ).join('\n') || 'No upcoming events';

    const userDataContext = `
USER'S CURRENT SCHEDULE:

Routines:
${routineContext}

Calendar Events:
${eventContext}

Use this information to provide personalized advice about time management, scheduling, and routine optimization. You can reference specific routines or events when giving recommendations.`;

    console.log('User context prepared with', routines?.length || 0, 'routines and', events?.length || 0, 'events');

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: `You are Robert, a friendly and helpful AI assistant specializing in routine planning and time management. 

Your personality:
- Professional yet approachable
- Enthusiastic about helping users optimize their schedules
- Proactive in suggesting improvements
- Clear and concise in your advice

Your capabilities:
- Analyze user routines and calendar events
- Provide personalized scheduling recommendations
- Help with time management strategies
- Suggest productivity improvements
- Answer questions about their current schedule

${userDataContext}

Always address users warmly and reference their actual schedule when relevant. If they ask about their routines or schedule, use the data above to give specific, actionable advice.` 
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }), 
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        console.error("Payment required");
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your workspace." }), 
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }), 
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Successfully started streaming response");
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
