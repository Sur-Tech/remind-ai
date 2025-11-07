import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const CalendarConnection = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionEmail, setConnectionEmail] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkConnection();
    
    // Listen for connection messages from popup
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'GOOGLE_CALENDAR_CONNECTED') {
        checkConnection();
        syncCalendar();
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to connect your calendar');
        return;
      }

      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

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
      toast.error('Failed to connect calendar');
    }
  };

  const syncCalendar = async () => {
    try {
      setIsSyncing(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('sync-google-calendar', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast.success(`Synced ${data.syncedEvents} events from Google Calendar`);
      
      // Trigger a page refresh to show new events
      window.location.reload();
    } catch (error) {
      console.error('Error syncing calendar:', error);
      toast.error('Failed to sync calendar');
    } finally {
      setIsSyncing(false);
    }
  };

  const disconnectCalendar = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('calendar_connections')
        .delete()
        .eq('user_id', user.id)
        .eq('provider', 'google');

      if (error) throw error;

      setIsConnected(false);
      setConnectionEmail(null);
      toast.success('Calendar disconnected');
      
      // Refresh to remove synced events
      window.location.reload();
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
      toast.error('Failed to disconnect calendar');
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
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={syncCalendar}
                disabled={isSyncing}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={disconnectCalendar}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Disconnect
              </Button>
            </>
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