import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RoutineForm } from "@/components/RoutineForm";
import { RoutineList } from "@/components/RoutineList";
import { RoutineCalendar } from "@/components/RoutineCalendar";
import { TodayEventsDialog } from "@/components/TodayEventsDialog";
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
}

const Index = () => {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { permission, requestPermission } = useNotifications(routines);
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Fetch routines from database
  useEffect(() => {
    if (user) {
      fetchRoutines();
    }
  }, [user]);

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
          <RoutineCalendar routines={routines} />
        </div>

        {/* Main Content */}
        <div className="flex-1 max-w-3xl space-y-8">
          {/* Header */}
          <header className="text-center space-y-4 py-8">
            <div className="flex justify-between items-center mb-4">
              <TodayEventsDialog routines={routines} />
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
    </div>
  );
};

export default Index;
