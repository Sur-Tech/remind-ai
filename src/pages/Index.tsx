import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RoutineForm } from "@/components/RoutineForm";
import { RoutineList } from "@/components/RoutineList";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/hooks/useAuth";
import { Bell, BellOff, LogOut } from "lucide-react";
import { toast } from "sonner";

interface Routine {
  id: string;
  name: string;
  time: string;
  description?: string;
}

const Index = () => {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const { permission, requestPermission } = useNotifications(routines);
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const stored = localStorage.getItem("routines");
    if (stored) {
      setRoutines(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("routines", JSON.stringify(routines));
  }, [routines]);

  const handleAddRoutine = (routine: Routine) => {
    setRoutines((prev) => [...prev, routine]);
    toast.success("Routine added successfully!");
  };

  const handleEditRoutine = (routine: Routine) => {
    setRoutines((prev) => prev.map((r) => (r.id === routine.id ? routine : r)));
    setEditingRoutine(null);
    toast.success("Routine updated successfully!");
  };

  const handleDeleteRoutine = (id: string) => {
    setRoutines((prev) => prev.filter((r) => r.id !== id));
    toast.success("Routine deleted");
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <header className="text-center space-y-4 py-8">
          <div className="flex justify-end mb-4">
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
  );
};

export default Index;
