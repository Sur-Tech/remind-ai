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
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') // user_id
    const error = url.searchParams.get('error')

    if (error) {
      console.error('OAuth error:', error)
      return new Response(
        `<html><body><script>window.close()</script><p>Authorization cancelled</p></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Exchange code for tokens
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-callback`

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenResponse.json()
    console.log('Token exchange successful for user:', state)

    if (tokens.error) {
      throw new Error(`Token exchange failed: ${tokens.error}`)
    }

    // Get user email from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const userInfo = await userInfoResponse.json()

    // Calculate token expiry
    const tokenExpiry = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString()

    // Store connection in database
    const { error: dbError } = await supabaseClient
      .from('calendar_connections')
      .upsert({
        user_id: state,
        provider: 'google',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: tokenExpiry,
        email: userInfo.email,
      })

    if (dbError) {
      console.error('Database error:', dbError)
      throw dbError
    }

    console.log('Calendar connection saved for user:', state)

    // Return success page that closes the popup
    return new Response(
      `<html>
        <body>
          <script>
            window.opener.postMessage({ type: 'GOOGLE_CALENDAR_CONNECTED' }, '*');
            setTimeout(() => window.close(), 1000);
          </script>
          <p>Calendar connected successfully! This window will close automatically.</p>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  } catch (error) {
    console.error('Error in google-calendar-callback:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      `<html><body><p>Error: ${message}</p></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }
})