import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting routine recommendations generation for all users...');

    // Get all users who have routines
    const { data: users, error: usersError } = await supabase
      .from('routines')
      .select('user_id')
      .not('user_id', 'is', null);

    if (usersError) {
      console.error('Database query error:', usersError);
      throw new Error('Failed to fetch user data');
    }

    // Get unique user IDs
    const uniqueUserIds = [...new Set(users?.map(u => u.user_id) || [])];
    console.log(`Found ${uniqueUserIds.length} users with routines`);

    let successCount = 0;
    let failureCount = 0;

    // Generate recommendations for each user
    for (const userId of uniqueUserIds) {
      try {
        console.log(`Processing user recommendations`);

        // Get user's routines
        const { data: routines, error: routinesError } = await supabase
          .from('routines')
          .select('*')
          .eq('user_id', userId);

        if (routinesError) throw routinesError;

        // Get user's calendar events
        const { data: calendarEvents, error: eventsError } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('user_id', userId);

        if (eventsError) throw eventsError;

        const routineCount = routines?.length || 0;
        const eventCount = calendarEvents?.length || 0;

        // Create context for AI
        const routinesSummary = routines?.map((r: any) => 
          `- ${r.name} at ${r.time} (${r.frequency || 'once'}) on ${r.date}${r.description ? ': ' + r.description : ''}`
        ).join('\n') || 'No routines yet.';

        const eventsSummary = calendarEvents?.map((e: any) => 
          `- ${e.title} at ${new Date(e.start_time).toLocaleString()}${e.description ? ': ' + e.description : ''}`
        ).join('\n') || 'No calendar events.';

        const prompt = `You are a personal productivity coach analyzing someone's routine and schedule. Based on the following information, provide personalized recommendations to improve their daily routine, productivity, and work-life balance.

Current Routines (${routineCount}):
${routinesSummary}

Calendar Events (${eventCount}):
${eventsSummary}

Please provide 3-5 specific, actionable recommendations focusing on:
1. Time management and scheduling optimization
2. Balance between work/commitments and personal time
3. Healthy habits and wellness
4. Productivity improvements
5. Any patterns you notice that could be improved

Keep recommendations positive, encouraging, and specific to their schedule.`;

        // Call Lovable AI
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are a helpful personal productivity coach.' },
              { role: 'user', content: prompt }
            ],
          }),
        });

        if (!aiResponse.ok) {
          console.error('AI service error:', aiResponse.status, await aiResponse.text());
          failureCount++;
          continue;
        }

        const aiData = await aiResponse.json();
        const recommendations = aiData.choices[0].message.content;

        // Store recommendations in database
        const { error: insertError } = await supabase
          .from('ai_recommendations')
          .insert({
            user_id: userId,
            recommendations: recommendations,
            routine_count: routineCount,
            event_count: eventCount,
            read: false
          });

        if (insertError) {
          console.error('Failed to store recommendations:', insertError);
          failureCount++;
        } else {
          console.log('Successfully generated recommendations');
          successCount++;
        }

      } catch (error) {
        console.error('Error processing recommendations:', error);
        failureCount++;
      }
    }

    const result = {
      success: true,
      message: `Generated recommendations for ${successCount} users (${failureCount} failures)`,
      successCount,
      failureCount,
      totalUsers: uniqueUserIds.length
    };

    console.log('Recommendations generation complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Function execution error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate recommendations',
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
