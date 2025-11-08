import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import webPush from 'https://esm.sh/web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get routines starting in the next 30 minutes
    const now = new Date()
    const thirtyMinutesLater = new Date(now.getTime() + 30 * 60000)
    
    const today = now.toISOString().split('T')[0]
    const timeNow = now.toTimeString().substring(0, 5)
    const timeThirtyMin = thirtyMinutesLater.toTimeString().substring(0, 5)

    console.log(`Checking for routines between ${timeNow} and ${timeThirtyMin} on ${today}`)

    const { data: routines, error: routinesError } = await supabaseClient
      .from('routines')
      .select('id, name, time, user_id, date')
      .eq('date', today)
      .gte('time', timeNow)
      .lte('time', timeThirtyMin)

    if (routinesError) {
      console.error('Error fetching routines:', routinesError)
      throw routinesError
    }

    console.log(`Found ${routines?.length || 0} upcoming routines`)

    if (!routines || routines.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No upcoming routines found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get unique user IDs
    const userIds = [...new Set(routines.map(r => r.user_id))]

    // Get push subscriptions for these users
    const { data: subscriptions, error: subsError } = await supabaseClient
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds)

    if (subsError) {
      console.error('Error fetching subscriptions:', subsError)
      throw subsError
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions`)

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys not configured')
    }

    // Configure web-push with VAPID keys
    webPush.setVapidDetails(
      'mailto:noreply@routinereminder.app',
      vapidPublicKey,
      vapidPrivateKey
    )

    // Send notifications
    const notificationPromises = []

    for (const routine of routines) {
      const userSubscriptions = subscriptions.filter(s => s.user_id === routine.user_id)
      
      for (const sub of userSubscriptions) {
        const payload = JSON.stringify({
          title: 'Routine Reminder',
          body: `"${routine.name}" starts at ${routine.time}`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          data: { routineId: routine.id }
        })

        const notificationPromise = webPush
          .sendNotification(sub.subscription, payload)
          .then(() => {
            console.log(`Notification sent for routine ${routine.id}`)
          })
          .catch(async (error) => {
            console.error(`Failed to send notification for routine ${routine.id}:`, error)
            
            // If subscription is invalid (410 Gone), remove it from database
            if (error.statusCode === 410) {
              console.log(`Removing invalid subscription for user ${sub.user_id}`)
              await supabaseClient
                .from('push_subscriptions')
                .delete()
                .eq('id', sub.id)
            }
          })

        notificationPromises.push(notificationPromise)
      }
    }

    await Promise.all(notificationPromises)

    console.log(`Sent ${notificationPromises.length} notifications`)

    return new Response(
      JSON.stringify({ 
        message: 'Notifications sent successfully',
        count: notificationPromises.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in send-push-notifications:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
