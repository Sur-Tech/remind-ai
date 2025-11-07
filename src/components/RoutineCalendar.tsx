import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay } from "date-fns";
import { Clock, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

interface Routine {
  id: string;
  name: string;
  time: string;
  date: string;
  description?: string;
}

interface RoutineCalendarProps {
  routines: Routine[];
}

export const RoutineCalendar = ({ routines }: RoutineCalendarProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Get routines for the selected date
  const routinesForSelectedDate = routines.filter((routine) => {
    if (!selectedDate) return false;
    const routineDate = new Date(routine.date);
    return isSameDay(routineDate, selectedDate);
  });

  // Get dates that have routines
  const datesWithRoutines = routines.map((routine) => new Date(routine.date));

  return (
    <Card className="p-6 shadow-card border-border/50 bg-card sticky top-8">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-primary">
            <CalendarDays className="w-5 h-5 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Calendar</h2>
        </div>

        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          className="rounded-md border border-border p-3 pointer-events-auto"
          modifiers={{
            hasRoutine: datesWithRoutines,
          }}
          modifiersClassNames={{
            hasRoutine: "bg-primary/20 font-bold",
          }}
        />

        {selectedDate && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {format(selectedDate, "MMMM d, yyyy")}
            </h3>
            
            {routinesForSelectedDate.length > 0 ? (
              <div className="space-y-2">
                {routinesForSelectedDate.map((routine) => (
                  <div
                    key={routine.id}
                    className="p-3 rounded-lg bg-accent/10 border border-border/50 hover:bg-accent/20 transition-smooth"
                  >
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {routine.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {routine.time}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No routines scheduled
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
