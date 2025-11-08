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
    const { location, datetime } = await req.json();
    
    if (!location) {
      return new Response(
        JSON.stringify({ error: 'Location is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const googleKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!googleKey) {
      return new Response(
        JSON.stringify({ error: 'Google Maps API key not configured' }),
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
      // Use Google Geocoding (more tolerant with full addresses)
      const googleGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${googleKey}`;
      console.log(`Google Geocoding for: "${location}"`);
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
      } else {
        return new Response(
          JSON.stringify({ error: 'Location not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (lat === undefined || lon === undefined) {
      return new Response(
        JSON.stringify({ error: 'Unable to resolve coordinates for the provided location' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // Fetch weather data from Open-Meteo
    // If datetime is provided, fetch forecast data; otherwise, fetch current weather
    let weatherUrl: string;
    let result: any;
    
    if (datetime) {
      // Forecast mode - get hourly data for the next 7 days
      weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=celsius&wind_speed_unit=ms&timezone=auto`;
      console.log(`Fetching forecast from Open-Meteo: ${weatherUrl}`);
      
      const weatherResponse = await fetch(weatherUrl);
      if (!weatherResponse.ok) {
        const errorText = await weatherResponse.text();
        console.error(`Open-Meteo API error: ${errorText}`);
        throw new Error(`Weather API failed with status ${weatherResponse.status}`);
      }

      const weatherData = await weatherResponse.json();
      
      // Parse the requested datetime
      const requestedDate = new Date(datetime);
      const requestedHour = requestedDate.getHours();
      
      // Find the closest matching time in the forecast
      const timeIndex = weatherData.hourly.time.findIndex((time: string) => {
        const forecastDate = new Date(time);
        return forecastDate.getDate() === requestedDate.getDate() &&
               forecastDate.getMonth() === requestedDate.getMonth() &&
               forecastDate.getFullYear() === requestedDate.getFullYear() &&
               forecastDate.getHours() === requestedHour;
      });

      if (timeIndex === -1) {
        return new Response(
          JSON.stringify({ error: 'Forecast not available for the requested time' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Map weather code to description
      const getWeatherInfo = (code: number) => {
        const weatherCodes: Record<number, { description: string; icon: string }> = {
          0: { description: 'clear sky', icon: '01d' },
          1: { description: 'mainly clear', icon: '02d' },
          2: { description: 'partly cloudy', icon: '03d' },
          3: { description: 'overcast', icon: '04d' },
          45: { description: 'foggy', icon: '50d' },
          48: { description: 'depositing rime fog', icon: '50d' },
          51: { description: 'light drizzle', icon: '09d' },
          53: { description: 'moderate drizzle', icon: '09d' },
          55: { description: 'dense drizzle', icon: '09d' },
          61: { description: 'slight rain', icon: '10d' },
          63: { description: 'moderate rain', icon: '10d' },
          65: { description: 'heavy rain', icon: '10d' },
          71: { description: 'slight snow', icon: '13d' },
          73: { description: 'moderate snow', icon: '13d' },
          75: { description: 'heavy snow', icon: '13d' },
          77: { description: 'snow grains', icon: '13d' },
          80: { description: 'slight rain showers', icon: '09d' },
          81: { description: 'moderate rain showers', icon: '09d' },
          82: { description: 'violent rain showers', icon: '09d' },
          85: { description: 'slight snow showers', icon: '13d' },
          86: { description: 'heavy snow showers', icon: '13d' },
          95: { description: 'thunderstorm', icon: '11d' },
          96: { description: 'thunderstorm with slight hail', icon: '11d' },
          99: { description: 'thunderstorm with heavy hail', icon: '11d' },
        };
        return weatherCodes[code] || { description: 'unknown', icon: '01d' };
      };

      const weatherInfo = getWeatherInfo(weatherData.hourly.weather_code[timeIndex]);
      const tempCelsius = weatherData.hourly.temperature_2m[timeIndex];
      
      result = {
        temperature: Math.round((tempCelsius * 9/5) + 32), // Convert to Fahrenheit
        feelsLike: Math.round((tempCelsius * 9/5) + 32), // Convert to Fahrenheit
        description: weatherInfo.description,
        icon: weatherInfo.icon,
        humidity: weatherData.hourly.relative_humidity_2m[timeIndex],
        windSpeed: Math.round(weatherData.hourly.wind_speed_10m[timeIndex] * 2.237), // Convert m/s to mph
        location: resolvedName,
        country: resolvedCountry,
        datetime: weatherData.hourly.time[timeIndex],
      };
    } else {
      // Current weather mode
      weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=celsius&wind_speed_unit=ms`;
      console.log(`Fetching current weather from Open-Meteo: ${weatherUrl}`);
      
      const weatherResponse = await fetch(weatherUrl);
      if (!weatherResponse.ok) {
        const errorText = await weatherResponse.text();
        console.error(`Open-Meteo API error: ${errorText}`);
        throw new Error(`Weather API failed with status ${weatherResponse.status}`);
      }

      const weatherData = await weatherResponse.json();
      console.log(`Weather data received from Open-Meteo`);

      // Map Open-Meteo weather codes to descriptions and icons
      const getWeatherInfo = (code: number) => {
        const weatherCodes: Record<number, { description: string; icon: string }> = {
          0: { description: 'clear sky', icon: '01d' },
          1: { description: 'mainly clear', icon: '02d' },
          2: { description: 'partly cloudy', icon: '03d' },
          3: { description: 'overcast', icon: '04d' },
          45: { description: 'foggy', icon: '50d' },
          48: { description: 'depositing rime fog', icon: '50d' },
          51: { description: 'light drizzle', icon: '09d' },
          53: { description: 'moderate drizzle', icon: '09d' },
          55: { description: 'dense drizzle', icon: '09d' },
          61: { description: 'slight rain', icon: '10d' },
          63: { description: 'moderate rain', icon: '10d' },
          65: { description: 'heavy rain', icon: '10d' },
          71: { description: 'slight snow', icon: '13d' },
          73: { description: 'moderate snow', icon: '13d' },
          75: { description: 'heavy snow', icon: '13d' },
          77: { description: 'snow grains', icon: '13d' },
          80: { description: 'slight rain showers', icon: '09d' },
          81: { description: 'moderate rain showers', icon: '09d' },
          82: { description: 'violent rain showers', icon: '09d' },
          85: { description: 'slight snow showers', icon: '13d' },
          86: { description: 'heavy snow showers', icon: '13d' },
          95: { description: 'thunderstorm', icon: '11d' },
          96: { description: 'thunderstorm with slight hail', icon: '11d' },
          99: { description: 'thunderstorm with heavy hail', icon: '11d' },
        };
        return weatherCodes[code] || { description: 'unknown', icon: '01d' };
      };

      const weatherInfo = getWeatherInfo(weatherData.current.weather_code);

      result = {
        temperature: Math.round((weatherData.current.temperature_2m * 9/5) + 32), // Convert to Fahrenheit
        feelsLike: Math.round((weatherData.current.temperature_2m * 9/5) + 32), // Convert to Fahrenheit
        description: weatherInfo.description,
        icon: weatherInfo.icon,
        humidity: weatherData.current.relative_humidity_2m,
        windSpeed: Math.round(weatherData.current.wind_speed_10m * 2.237), // Convert m/s to mph
        location: resolvedName,
        country: resolvedCountry,
      };
    }

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
