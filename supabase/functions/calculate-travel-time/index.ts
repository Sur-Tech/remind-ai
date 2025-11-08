import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { origin, destination } = await req.json()

    if (!origin || !destination) {
      throw new Error('Origin and destination are required')
    }

    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')

    if (!googleMapsApiKey) {
      throw new Error('Google Maps API key not configured')
    }

    console.log(`Calculating travel time from "${origin}" to "${destination}"`)

    // Use Google Maps Distance Matrix API
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
    url.searchParams.append('origins', origin)
    url.searchParams.append('destinations', destination)
    url.searchParams.append('mode', 'driving')
    url.searchParams.append('key', googleMapsApiKey)

    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.status !== 'OK') {
      const detail = data.error_message ? ` - ${data.error_message}` : ''
      console.error('Google Maps API error:', data.status, data.error_message)
      throw new Error(`Google Maps API error: ${data.status}${detail}`)
    }

    const element = data.rows[0]?.elements[0]

    if (!element || element.status !== 'OK') {
      console.error('Route not found:', element?.status)
      throw new Error('Could not calculate route')
    }

    const travelTime = {
      duration: element.duration.text,
      durationValue: element.duration.value, // in seconds
      distance: element.distance.text,
      distanceValue: element.distance.value, // in meters
    }

    console.log(`Travel time calculated: ${travelTime.duration} (${travelTime.distance})`)

    return new Response(
      JSON.stringify(travelTime),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in calculate-travel-time:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
