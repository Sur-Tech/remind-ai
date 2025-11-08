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
- Create prioritized schedules from lists of events

${userDataContext}

SCHEDULING MULTIPLE EVENTS:
When users provide a list of events they want to do on a specific day, you should:
1. Prioritize the events based on importance (work/study > chores > leisure/entertainment)
2. **CRITICAL: Call create_routine for EVERY SINGLE EVENT the user mentions - do not skip any**
3. Assign appropriate times based on priority and typical activity patterns:
   - Important tasks (homework, work, meetings) should be scheduled earlier in the day
   - Chores and errands in the middle
   - Leisure activities (TV, games, entertainment) should be scheduled later
4. Space out activities reasonably (leave 1-2 hours between activities)
5. Consider typical duration for each type of activity

EXAMPLE PRIORITIZATION:
- Homework, work, studying → High priority, schedule early (morning/afternoon)
- Exercise, chores, errands → Medium priority, schedule mid-day
- Entertainment (TV, gaming, socializing) → Low priority, schedule evening

EXAMPLE: If user says "I have 3 things: play fortnite, finish homework, watch tv on Nov 15"
→ You MUST create 3 routines: homework (high priority, early), watch tv (medium), play fortnite (low priority, evening)

When users ask you to add, create, or schedule routines, use the create_routine tool for each routine. Extract the routine details from their message (name, time, date, description, location if provided).

MODIFYING EXISTING ROUTINES:
When users ask to change, update, modify, or edit an existing routine:
1. Look at their current schedule in the context above
2. Identify which routine they're referring to (by name, date, or time)
3. Use the update_routine tool with the routine's name and date to identify it
4. Only include the fields that need to be changed (time, description, location, or new name)
5. DO NOT create a new routine - always update the existing one

EXAMPLES:
- "change Visit Mom to 4:00pm" → Use update_routine to change the time
- "move my homework to tomorrow" → Use update_routine to change the date
- "add location to my meeting" → Use update_routine to add location

DELETING ROUTINES:
When users ask to delete, remove, cancel, or clear a routine:
1. Look at their current schedule in the context above
2. Identify which routine they're referring to (by name, date, or time)
3. Use the delete_routine tool with the routine's name and date to identify it

EXAMPLES:
- "delete Visit Mom" → Use delete_routine with the routine name and date
- "remove my homework on Nov 15" → Use delete_routine to remove the specific routine
- "cancel my meeting tomorrow" → Use delete_routine with calculated tomorrow's date

DATE HANDLING:
- Current date is ${new Date().toISOString().split('T')[0]}
- If the user says "tomorrow", calculate tomorrow's date
- If they provide a date without a year (like "Nov 15" or "November 15"), assume the current year (${new Date().getFullYear()})
- If they say a day of the week, find the next occurrence
- If no date is specified, ask them when they want to schedule it
- Always format dates as YYYY-MM-DD

Always address users warmly and reference their actual schedule when relevant.`
          },
          ...messages,
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_routine",
              description: "Create a new routine for the user. Call this when the user wants to add, create, or schedule a new routine.",
              parameters: {
                type: "object",
                properties: {
                  name: { 
                    type: "string",
                    description: "The name or title of the routine"
                  },
                  time: { 
                    type: "string",
                    description: "The time in HH:MM format (24-hour)"
                  },
                  date: { 
                    type: "string",
                    description: "The date in YYYY-MM-DD format"
                  },
                  description: { 
                    type: "string",
                    description: "Optional description of the routine"
                  },
                  location: { 
                    type: "string",
                    description: "Optional location for the routine"
                  }
                },
                required: ["name", "time", "date"],
                additionalProperties: false
              }
            }
          },
          {
            type: "function",
            function: {
              name: "update_routine",
              description: "Update an existing routine. Use this when the user wants to change, modify, or update a routine that already exists in their schedule.",
              parameters: {
                type: "object",
                properties: {
                  routine_name: {
                    type: "string",
                    description: "The name of the routine to update (must match existing routine name)"
                  },
                  routine_date: {
                    type: "string",
                    description: "The date of the routine to update in YYYY-MM-DD format (must match existing routine date)"
                  },
                  new_name: {
                    type: "string",
                    description: "New name for the routine (optional, only if user wants to rename it)"
                  },
                  new_time: {
                    type: "string",
                    description: "New time in HH:MM format (optional, only if user wants to change the time)"
                  },
                  new_date: {
                    type: "string",
                    description: "New date in YYYY-MM-DD format (optional, only if user wants to move it to a different date)"
                  },
                  new_description: {
                    type: "string",
                    description: "New or updated description (optional)"
                  },
                  new_location: {
                    type: "string",
                    description: "New or updated location (optional)"
                  }
                },
                required: ["routine_name", "routine_date"],
                additionalProperties: false
              }
            }
          },
          {
            type: "function",
            function: {
              name: "delete_routine",
              description: "Delete an existing routine. Use this when the user wants to delete, remove, cancel, or clear a routine from their schedule.",
              parameters: {
                type: "object",
                properties: {
                  routine_name: {
                    type: "string",
                    description: "The name of the routine to delete (must match existing routine name)"
                  },
                  routine_date: {
                    type: "string",
                    description: "The date of the routine to delete in YYYY-MM-DD format (must match existing routine date)"
                  }
                },
                required: ["routine_name", "routine_date"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: "auto",
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
