import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WeatherData {
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
}

export const useWeatherRecommendation = (
  weather: WeatherData | null,
  routineName: string,
  time: string
) => {
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRecommendation = async () => {
      if (!weather) {
        setRecommendation(null);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('weather-recommendation', {
          body: { weather, routineName, time },
        });

        if (error) {
          console.error("Recommendation fetch error:", error);
          setRecommendation(null);
        } else if (data?.recommendation) {
          setRecommendation(data.recommendation);
        }
      } catch (err) {
        console.error("Recommendation error:", err);
        setRecommendation(null);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchRecommendation, 1000);
    return () => clearTimeout(timeoutId);
  }, [weather, routineName, time]);

  return { recommendation, loading };
};
