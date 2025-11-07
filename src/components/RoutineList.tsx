import { RoutineCard } from "./RoutineCard";
import { CalendarClock } from "lucide-react";

interface Routine {
  id: string;
  name: string;
  time: string;
  description?: string;
}

interface RoutineListProps {
  routines: Routine[];
  onDeleteRoutine: (id: string) => void;
}

export const RoutineList = ({ routines, onDeleteRoutine }: RoutineListProps) => {
  if (routines.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/50 mb-4">
          <CalendarClock className="w-8 h-8 text-accent-foreground" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">No routines yet</h3>
        <p className="text-muted-foreground">Add your first routine to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-foreground mb-6">Your Routines</h2>
      <div className="space-y-3">
        {routines.map((routine) => (
          <RoutineCard
            key={routine.id}
            routine={routine}
            onDelete={onDeleteRoutine}
          />
        ))}
      </div>
    </div>
  );
};
