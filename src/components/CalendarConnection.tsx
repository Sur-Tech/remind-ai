import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "lucide-react";
import { toast } from "sonner";

export const CalendarConnection = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionEmail, setConnectionEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkConnection();
    
    // Listen for connection messages from popup
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'GOOGLE_CALENDAR_CONNECTED') {
        checkConnection();
        toast.success('Google Calendar connected successfully!');
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const checkConnection = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('calendar_connections')
        .select('email')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking connection:', error);
        return;
      }

      setIsConnected(!!data);
      setConnectionEmail(data?.email || null);
    } catch (error) {
      console.error('Error checking connection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const connectCalendar = async () => {
    try {
      console.log('Starting Google Calendar connection...');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to connect your calendar');
        return;
      }

      console.log('Calling google-calendar-auth edge function...');
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (!data?.authUrl) {
        console.error('No authUrl returned from edge function');
        toast.error('Failed to get authorization URL');
        return;
      }

      console.log('Opening OAuth popup with URL:', data.authUrl);
      // Open OAuth popup
      const popup = window.open(
        data.authUrl,
        'Google Calendar Auth',
        'width=600,height=700,left=100,top=100'
      );

      if (!popup) {
        toast.error('Please allow popups to connect your calendar');
      }
    } catch (error) {
      console.error('Error connecting calendar:', error);
      toast.error('Failed to connect calendar. Check console for details.');
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Google Calendar</h3>
            {isConnected && connectionEmail && (
              <p className="text-sm text-muted-foreground">{connectionEmail}</p>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          {isConnected ? (
            <p className="text-sm text-muted-foreground">Connected</p>
          ) : (
            <Button onClick={connectCalendar} size="sm">
              Connect
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};