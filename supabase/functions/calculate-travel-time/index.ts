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

    console.log(`Calculating travel time and directions from "${origin}" to "${destination}"`)

    // Use Google Maps Directions API to get both travel time and turn-by-turn directions
    const url = new URL('https://maps.googleapis.com/maps/api/directions/json')
    url.searchParams.append('origin', origin)
    url.searchParams.append('destination', destination)
    url.searchParams.append('mode', 'driving')
    url.searchParams.append('key', googleMapsApiKey)

    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.status !== 'OK') {
      const detail = data.error_message ? ` - ${data.error_message}` : ''
      console.error('Google Maps API error:', data.status, data.error_message)
      throw new Error(`Google Maps API error: ${data.status}${detail}`)
    }

    const route = data.routes[0]
    if (!route) {
      console.error('No route found')
      throw new Error('Could not find a route')
    }

    const leg = route.legs[0]
    
    // Extract turn-by-turn directions
    const directions = leg.steps.map((step: any) => ({
      instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
      distance: step.distance.text,
      duration: step.duration.text,
    }))

    const travelData = {
      duration: leg.duration.text,
      durationValue: leg.duration.value, // in seconds
      distance: leg.distance.text,
      distanceValue: leg.distance.value, // in meters
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      directions: directions,
    }

    console.log(`Travel time calculated: ${travelData.duration} (${travelData.distance}), ${directions.length} steps`)

    return new Response(
      JSON.stringify(travelData),
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
