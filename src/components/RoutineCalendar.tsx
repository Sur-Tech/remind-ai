import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, parseISO } from "date-fns";
import { Clock, CalendarDays, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatTime12Hour } from "@/lib/utils";

interface Routine {
  id: string;
  name: string;
  time: string;
  date: string;
  description?: string;
  frequency?: string;
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

interface RoutineCalendarProps {
  routines: Routine[];
  calendarEvents: CalendarEvent[];
}

export const RoutineCalendar = ({ routines, calendarEvents }: RoutineCalendarProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Detect if event is a holiday or major event
  const isHolidayEvent = (title: string) => {
    const holidayKeywords = [
      'holiday', 'christmas', 'thanksgiving', 'easter', 'new year',
      'birthday', 'anniversary', 'memorial', 'independence', 'labor day',
      'veterans', 'hanukkah', 'diwali', 'ramadan', 'eid', 'passover',
      'valentine', 'mother', 'father', 'halloween', 'fourth of july'
    ];
    const lowerTitle = title.toLowerCase();
    return holidayKeywords.some(keyword => lowerTitle.includes(keyword));
  };

  // Get routines for the selected date
  const routinesForSelectedDate = routines.filter((routine) => {
    if (!selectedDate) return false;
    const routineDate = parseISO(routine.date);
    return isSameDay(routineDate, selectedDate);
  });

  // Get calendar events for the selected date
  const eventsForSelectedDate = calendarEvents.filter((event) => {
    if (!selectedDate) return false;
    const eventDate = parseISO(event.event_date);
    return isSameDay(eventDate, selectedDate);
  });

  // Get dates that have routines or events
  const datesWithRoutines = routines.map((routine) => parseISO(routine.date));
  const datesWithEvents = calendarEvents.map((event) => parseISO(event.event_date));
  const datesWithHolidays = calendarEvents
    .filter(event => isHolidayEvent(event.title))
    .map(event => parseISO(event.event_date));
  const allDatesWithActivity = [...datesWithRoutines, ...datesWithEvents];

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
            hasActivity: allDatesWithActivity,
            hasHoliday: datesWithHolidays,
          }}
          modifiersClassNames={{
            hasActivity: "bg-primary/20 font-bold",
            hasHoliday: "bg-gradient-to-br from-amber-500/30 to-orange-500/30 font-bold text-foreground",
          }}
        />

        {selectedDate && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {format(selectedDate, "MMMM d, yyyy")}
            </h3>
            
            {routinesForSelectedDate.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">Routines</p>
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
                          {formatTime12Hour(routine.time)}
                        </p>
                        {routine.frequency && routine.frequency !== "once" && (
                          <p className="text-xs text-muted-foreground capitalize">
                            {routine.frequency}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {eventsForSelectedDate.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">Events</p>
                {eventsForSelectedDate.map((event) => {
                  const isHoliday = isHolidayEvent(event.title);
                  return (
                    <div
                      key={event.id}
                      className={cn(
                        "p-3 rounded-lg border transition-smooth",
                        isHoliday
                          ? "bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/30 hover:from-amber-500/30 hover:to-orange-500/30"
                          : "bg-primary/10 border-primary/20 hover:bg-primary/20"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {isHoliday ? (
                          <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        ) : (
                          <CalendarDays className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">
                              {event.title}
                            </p>
                            {isHoliday && (
                              <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30">
                                Holiday
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            {' - '}
                            {new Date(event.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </p>
                          {event.location && (
                            <p className="text-xs text-muted-foreground truncate">
                              📍 {event.location}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {routinesForSelectedDate.length === 0 && eventsForSelectedDate.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No routines or events scheduled
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
