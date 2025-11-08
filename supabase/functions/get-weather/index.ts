import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { location } = await req.json();
    
    if (!location) {
      return new Response(
        JSON.stringify({ error: 'Location is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('OPENWEATHER_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Weather API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare variables
    let lat: number | undefined;
    let lon: number | undefined;
    let resolvedName = '';
    let resolvedCountry = '';

    // If user passed coordinates like "40.7,-74.3", use them directly
    const coordMatch = String(location).match(/^\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coordMatch) {
      lat = parseFloat(coordMatch[1]);
      lon = parseFloat(coordMatch[2]);
      resolvedName = 'Selected location';
      resolvedCountry = '';
      console.log(`Parsed coordinates directly: (${lat}, ${lon})`);
    } else {
      // Try Google Geocoding first (more tolerant with full addresses)
      const googleKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
      if (googleKey) {
        const googleGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${googleKey}`;
        console.log(`Google Geocoding URL: ${googleGeocodeUrl}`);
        const ggRes = await fetch(googleGeocodeUrl);
        const ggJson = await ggRes.json();
        console.log(`Google Geocoding status: ${ggRes.status}, results: ${ggJson.results?.length ?? 0}`);
        if (ggRes.ok && ggJson.status === 'OK' && ggJson.results && ggJson.results.length > 0) {
          const best = ggJson.results[0];
          lat = best.geometry.location.lat;
          lon = best.geometry.location.lng;
          // Try to extract city and country from address components
          const comps: Array<{ long_name: string; short_name: string; types: string[] }> = best.address_components || [];
          const cityComp = comps.find(c => c.types.includes('locality') || c.types.includes('sublocality') || c.types.includes('postal_town'));
          const countryComp = comps.find(c => c.types.includes('country'));
          resolvedName = cityComp?.long_name || best.formatted_address || 'Selected location';
          resolvedCountry = countryComp?.short_name || '';
          console.log(`Google geocoded: ${resolvedName}, ${resolvedCountry} (${lat}, ${lon})`);
        }
      }

      // If Google didn't resolve, fall back to OpenWeather's geocoding using a simplified query
      if (lat === undefined || lon === undefined) {
        // Extract city/state from address (e.g., "205 Hobart Avenue, Short Hills, NJ" -> "Short Hills, NJ")
        let searchLocation = String(location);
        const addressParts = searchLocation.split(',').map((part: string) => part.trim());
        if (addressParts.length >= 2) {
          searchLocation = addressParts.slice(-2).join(', ');
        }
        console.log(`Falling back to OpenWeather geocoding for: "${searchLocation}"`);
        const geocodeUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(searchLocation)}&limit=1&appid=${apiKey}`;
        const geocodeResponse = await fetch(geocodeUrl);
        console.log(`OpenWeather Geocode API status: ${geocodeResponse.status}`);
        if (!geocodeResponse.ok) {
          const errorText = await geocodeResponse.text();
          console.error(`OpenWeather Geocode API error: ${errorText}`);
          throw new Error(`Geocoding failed with status ${geocodeResponse.status}`);
        }
        const geocodeData = await geocodeResponse.json();
        console.log(`OpenWeather Geocode response:`, JSON.stringify(geocodeData));
        if (!geocodeData || geocodeData.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Location not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        lat = geocodeData[0].lat;
        lon = geocodeData[0].lon;
        resolvedName = geocodeData[0].name || 'Selected location';
        resolvedCountry = geocodeData[0].country || '';
      }
    }

    if (lat === undefined || lon === undefined) {
      return new Response(
        JSON.stringify({ error: 'Unable to resolve coordinates for the provided location' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // Fetch weather data using coordinates
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    console.log(`Fetching weather from: ${weatherUrl}`);
    
    const weatherResponse = await fetch(weatherUrl);

    if (!weatherResponse.ok) {
      const errorText = await weatherResponse.text();
      console.error(`Weather API error: ${errorText}`);
      throw new Error(`Weather API failed with status ${weatherResponse.status}`);
    }

    const weatherData = await weatherResponse.json();
    console.log(`Weather data received for: ${weatherData.name}`);

    const result = {
      temperature: Math.round(weatherData.main.temp),
      feelsLike: Math.round(weatherData.main.feels_like),
      description: weatherData.weather[0].description,
      icon: weatherData.weather[0].icon,
      humidity: weatherData.main.humidity,
      windSpeed: weatherData.wind.speed,
      location: resolvedName,
      country: resolvedCountry,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching weather:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
