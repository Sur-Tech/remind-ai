import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const [locationPermission, setLocationPermission] = useState<PermissionState | null>(null);

  // Check location permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setLocationPermission(result.state);
        
        result.addEventListener('change', () => {
          setLocationPermission(result.state);
        });
      } catch (err) {
        console.error('Error checking location permission:', err);
      }
    };

    checkPermission();
  }, []);

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
          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(
                resolve,
                (err) => {
                  if (err.code === 1) {
                    toast.error('Location access denied. Please enable location permissions in your browser settings.');
                  } else if (err.code === 2) {
                    toast.error('Location unavailable. Please check your device settings.');
                  } else {
                    toast.error('Unable to get your location. Please try again.');
                  }
                  reject(err);
                },
                {
                  enableHighAccuracy: true,
                  timeout: 10000,
                  maximumAge: 300000, // 5 minutes cache
                }
              );
            });
            
            actualOrigin = `${position.coords.latitude},${position.coords.longitude}`;
          } catch (locationError) {
            console.error('Location error:', locationError);
            setLoading(false);
            return;
          }
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

  return { travelTime, loading, error, locationPermission };
};
