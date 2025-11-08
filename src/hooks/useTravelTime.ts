import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TravelTime {
  duration: string;
  durationValue: number;
  distance: string;
  distanceValue: number;
}

export const useTravelTime = (destination: string | null | undefined, origin: string = 'current location') => {
  const [travelTime, setTravelTime] = useState<TravelTime | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!destination) {
      setTravelTime(null);
      return;
    }

    const calculateTravelTime = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get user's current location if origin is 'current location'
        let actualOrigin = origin;
        
        if (origin === 'current location') {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          
          actualOrigin = `${position.coords.latitude},${position.coords.longitude}`;
        }

        const { data, error: functionError } = await supabase.functions.invoke('calculate-travel-time', {
          body: {
            origin: actualOrigin,
            destination,
          },
        });

        if (functionError) throw functionError;
        
        setTravelTime(data);
      } catch (err) {
        console.error('Error calculating travel time:', err);
        setError(err instanceof Error ? err.message : 'Failed to calculate travel time');
      } finally {
        setLoading(false);
      }
    };

    calculateTravelTime();
  }, [destination, origin]);

  return { travelTime, loading, error };
};
