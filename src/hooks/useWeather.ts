import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WeatherData {
  temperature: number;
  feelsLike: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  location: string;
  country: string;
}

export const useWeather = (location: string | undefined) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      if (!location || location.trim().length < 3) {
        setWeather(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('get-weather', {
          body: { location },
        });

        if (fnError) {
          throw new Error(fnError.message || 'Failed to fetch weather');
        }

        setWeather(data as WeatherData);
      } catch (err) {
        console.error("Weather fetch error:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch weather");
        setWeather(null);
      } finally {
        setLoading(false);
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(fetchWeather, 500);
    return () => clearTimeout(timeoutId);
  }, [location]);

  return { weather, loading, error };
};
