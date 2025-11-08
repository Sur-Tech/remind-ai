import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RoutineForm } from "@/components/RoutineForm";
import { RoutineList } from "@/components/RoutineList";
import { RoutineCalendar } from "@/components/RoutineCalendar";
import { TodayEventsDialog } from "@/components/TodayEventsDialog";
import { CalendarConnection } from "@/components/CalendarConnection";
import { AIRecommendations } from "@/components/AIRecommendations";
import { ChatButton } from "@/components/ChatButton";
import { CalendarEventItem } from "@/components/CalendarEventItem";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Bell, BellOff, LogOut } from "lucide-react";
import { toast } from "sonner";

interface Routine {
  id: string;
  name: string;
  time: string;
  date: string;
  description?: string;
  frequency: string;
  location?: string;
  travelTimeMinutes?: number;
}

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  event_date: string;
  description?: string;
  location?: string;
}

const Index = () => {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [routinesWithTravel, setRoutinesWithTravel] = useState<Routine[]>([]);
  const { permission, requestPermission } = useNotifications(routinesWithTravel, calendarEvents);
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Check for new AI recommendations on mount
  useEffect(() => {
    const checkNewRecommendations = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('ai_recommendations')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        toast.success("🎯 New AI routine recommendations available!", {
          description: "Click 'Your Personalized Routine' to view them",
          duration: 5000,
        });
      }
    };

    if (user) {
      checkNewRecommendations();
    }
  }, [user]);

  // Fetch routines and calendar events from database
  useEffect(() => {
    if (user) {
      fetchRoutines();
      fetchCalendarEvents();
    }
  }, [user]);

  // Calculate travel times for routines with locations
  useEffect(() => {
    const calculateTravelTimes = async () => {
      const updatedRoutines = await Promise.all(
        routines.map(async (routine) => {
          if (!routine.location) {
            return routine;
          }

          try {
            // Get current position
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000,
              });
            });

            const origin = `${position.coords.latitude},${position.coords.longitude}`;

            // Calculate travel time
            const { data, error } = await supabase.functions.invoke('calculate-travel-time', {
              body: { origin, destination: routine.location },
            });

            if (!error && data) {
              return {
                ...routine,
                travelTimeMinutes: Math.ceil(data.durationValue / 60),
              };
            }
          } catch (error) {
            console.error('Error calculating travel time for routine:', error);
          }

          return routine;
        })
      );

      setRoutinesWithTravel(updatedRoutines);
    };

    if (routines.length > 0) {
      calculateTravelTimes();
    } else {
      setRoutinesWithTravel([]);
    }
  }, [routines]);

  const fetchRoutines = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("routines")
        .select("*")
        .order("date", { ascending: true })
        .order("time", { ascending: true });

      if (error) throw error;

      if (data) {
        setRoutines(data);
      }
    } catch (error) {
      console.error("Error fetching routines:", error);
      toast.error("Failed to load routines");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCalendarEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("event_date", new Date().toISOString().split('T')[0])
        .order("event_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      if (data) {
        setCalendarEvents(data);
      }
    } catch (error) {
      console.error("Error fetching calendar events:", error);
    }
  };

  const handleAddRoutine = async (routine: Omit<Routine, "id">) => {
    try {
      const { data, error } = await supabase
        .from("routines")
        .insert([
          {
            user_id: user?.id,
            name: routine.name,
            time: routine.time,
            date: routine.date,
            description: routine.description,
            location: routine.location,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setRoutines((prev) => [...prev, data]);
        toast.success("Routine added successfully!");
      }
    } catch (error) {
      console.error("Error adding routine:", error);
      toast.error("Failed to add routine");
    }
  };

  const handleEditRoutine = async (routine: Routine) => {
    try {
      const { error } = await supabase
        .from("routines")
        .update({
          name: routine.name,
          time: routine.time,
          date: routine.date,
          description: routine.description,
          location: routine.location,
        })
        .eq("id", routine.id);

      if (error) throw error;

      setRoutines((prev) => prev.map((r) => (r.id === routine.id ? routine : r)));
      setEditingRoutine(null);
      toast.success("Routine updated successfully!");
    } catch (error) {
      console.error("Error updating routine:", error);
      toast.error("Failed to update routine");
    }
  };

  const handleDeleteRoutine = async (id: string) => {
    try {
      const { error } = await supabase.from("routines").delete().eq("id", id);

      if (error) throw error;

      setRoutines((prev) => prev.filter((r) => r.id !== id));
      toast.success("Routine deleted");
    } catch (error) {
      console.error("Error deleting routine:", error);
      toast.error("Failed to delete routine");
    }
  };

  const handleStartEdit = (routine: Routine) => {
    setEditingRoutine(routine);
  };

  const handleCancelEdit = () => {
    setEditingRoutine(null);
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="flex gap-6 px-4 py-8">
        {/* Calendar Section */}
        <div className="w-80 flex-shrink-0">
          <RoutineCalendar routines={routines} calendarEvents={calendarEvents} />
        </div>

        {/* Main Content */}
        <div className="flex-1 max-w-3xl space-y-8">
          {/* Header */}
          <header className="text-center space-y-4 py-8">
            <div className="flex justify-between items-center mb-4">
              <TodayEventsDialog routines={routines} />
              <div className="flex gap-2">
                <AIRecommendations />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              </div>
            </div>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-primary mb-4">
              <Bell className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold text-foreground">Log Your Routine</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Stay on track with your daily routines. Set reminders and receive desktop notifications at the perfect time.
            </p>
            
            {/* Notification Permission */}
            {permission !== "granted" && (
              <Button
                onClick={requestPermission}
                className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {permission === "denied" ? (
                  <>
                    <BellOff className="w-4 h-4 mr-2" />
                    Notifications Blocked
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    Enable Notifications
                  </>
                )}
              </Button>
            )}
          </header>

          {/* Calendar Connection */}
          <CalendarConnection />

          {/* Calendar Events */}
          {calendarEvents.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Upcoming Calendar Events</h2>
              <div className="space-y-3">
                {calendarEvents.map((event) => (
                  <CalendarEventItem key={event.id} event={event} />
                ))}
              </div>
            </div>
          )}

          {/* Add Routine Form */}
          <RoutineForm 
            onAddRoutine={handleAddRoutine} 
            onEditRoutine={handleEditRoutine}
            editingRoutine={editingRoutine}
            onCancelEdit={handleCancelEdit}
          />

          {/* Routines List */}
          <RoutineList 
            routines={routines} 
            onDeleteRoutine={handleDeleteRoutine}
            onEditRoutine={handleStartEdit}
          />
        </div>
      </div>

      {/* AI Chatbot */}
      <ChatButton />
    </div>
  );
};

export default Index;
