import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
      console.error('Auth error:', userError)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get calendar connection
    const { data: connection, error: connError } = await supabaseClient
      .from('calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single()

    if (connError || !connection) {
      console.error('No calendar connection found:', connError)
      return new Response(JSON.stringify({ error: 'No calendar connection found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if token needs refresh
    let accessToken = connection.access_token
    if (new Date(connection.token_expiry!) < new Date()) {
      console.log('Refreshing access token...')
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: connection.refresh_token!,
          client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
          grant_type: 'refresh_token',
        }),
      })

      const refreshData = await refreshResponse.json()
      if (refreshData.error) {
        throw new Error(`Token refresh failed: ${refreshData.error}`)
      }

      accessToken = refreshData.access_token
      const newExpiry = new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString()

      // Update stored token
      await supabaseClient
        .from('calendar_connections')
        .update({
          access_token: accessToken,
          token_expiry: newExpiry,
        })
        .eq('id', connection.id)
    }

    // Fetch calendar events (next 30 days)
    const timeMin = new Date().toISOString()
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const eventsResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&` +
      `timeMax=${encodeURIComponent(timeMax)}&` +
      `singleEvents=true&` +
      `orderBy=startTime`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    const eventsData = await eventsResponse.json()
    console.log(`Fetched ${eventsData.items?.length || 0} events`)

    if (eventsData.error) {
      throw new Error(`Failed to fetch events: ${eventsData.error.message}`)
    }

    // Store events in database
    const events = eventsData.items || []
    const serviceRoleClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    for (const event of events) {
      if (!event.start?.dateTime && !event.start?.date) continue

      const startTime = event.start.dateTime || event.start.date
      const endTime = event.end?.dateTime || event.end?.date || startTime
      const eventDate = startTime.split('T')[0]

      await serviceRoleClient
        .from('calendar_events')
        .upsert({
          user_id: user.id,
          calendar_connection_id: connection.id,
          external_event_id: event.id,
          title: event.summary || 'Untitled Event',
          description: event.description,
          location: event.location,
          start_time: startTime,
          end_time: endTime,
          event_date: eventDate,
        }, {
          onConflict: 'external_event_id,calendar_connection_id'
        })
    }

    console.log(`Synced ${events.length} events for user:`, user.id)

    return new Response(JSON.stringify({ 
      success: true, 
      syncedEvents: events.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in sync-google-calendar:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})