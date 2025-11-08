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

    // Extract city name from full address if possible
    // OpenWeather geocoding works better with city names
    let searchLocation = location;
    
    // Try to extract city from address (e.g., "205 Hobart Avenue, Short Hills, NJ" -> "Short Hills, NJ")
    const addressParts = location.split(',').map((part: string) => part.trim());
    if (addressParts.length >= 2) {
      // Use the second-to-last and last parts (typically city and state/country)
      searchLocation = addressParts.slice(-2).join(', ');
    }

    console.log(`Geocoding location: "${searchLocation}" (original: "${location}")`);

    // First, geocode the location to get coordinates
    const geocodeUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(searchLocation)}&limit=1&appid=${apiKey}`;
    const geocodeResponse = await fetch(geocodeUrl);
    
    console.log(`Geocode API status: ${geocodeResponse.status}`);
    
    if (!geocodeResponse.ok) {
      const errorText = await geocodeResponse.text();
      console.error(`Geocode API error: ${errorText}`);
      throw new Error(`Geocoding failed with status ${geocodeResponse.status}`);
    }

    const geocodeData = await geocodeResponse.json();
    console.log(`Geocode response:`, JSON.stringify(geocodeData));
    
    if (!geocodeData || geocodeData.length === 0) {
      console.error(`No geocoding results for: "${searchLocation}"`);
      return new Response(
        JSON.stringify({ error: 'Location not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { lat, lon, name, country } = geocodeData[0];
    console.log(`Geocoded to: ${name}, ${country} (${lat}, ${lon})`);

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
      location: name,
      country: country,
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
