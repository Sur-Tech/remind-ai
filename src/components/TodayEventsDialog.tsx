import { format, isToday, parseISO, startOfDay, isSameDay } from "date-fns";
import { Calendar, Clock, FileText, MapPin, Car } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTravelTime } from "@/hooks/useTravelTime";
import { formatTime12Hour } from "@/lib/utils";

interface Routine {
  id: string;
  name: string;
  time: string;
  date: string;
  description?: string;
  location?: string;
}

interface TodayEventsDialogProps {
  routines: Routine[];
}

const EventItem = ({ routine }: { routine: Routine }) => {
  const { travelTime, loading } = useTravelTime(routine.location);

  return (
    <div className="p-4 rounded-lg border border-border/50 bg-card hover:bg-accent/10 transition-smooth">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-foreground flex-1">
            {routine.name}
          </h3>
          <Badge variant="secondary" className="flex items-center gap-1 font-mono">
            <Clock className="w-3 h-3" />
            {formatTime12Hour(routine.time)}
          </Badge>
        </div>
        
        {routine.location && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p className="flex-1">{routine.location}</p>
          </div>
        )}

        {travelTime && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <Car className="w-4 h-4" />
            <span>{travelTime.duration} drive ({travelTime.distance})</span>
          </div>
        )}

        {loading && routine.location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Car className="w-4 h-4 animate-pulse" />
            <span>Calculating travel time...</span>
          </div>
        )}
        
        {routine.description && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p className="flex-1">{routine.description}</p>
          </div>
        )}
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/30">
          <Calendar className="w-3 h-3" />
          <span>Scheduled for {format(new Date(routine.date), "PPP")}</span>
        </div>
      </div>
    </div>
  );
};

export const TodayEventsDialog = ({ routines }: TodayEventsDialogProps) => {
  const todayRoutines = routines.filter((routine) => {
    const routineDate = parseISO(routine.date);
    return isSameDay(routineDate, new Date());
  }).sort((a, b) => a.time.localeCompare(b.time));

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 relative hover:border-primary transition-smooth"
        >
          <Calendar className="w-4 h-4" />
          Today's Events
          {todayRoutines.length > 0 && (
            <Badge
              variant="default"
              className="ml-1 bg-primary text-primary-foreground"
            >
              {todayRoutines.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <div className="p-2 rounded-lg bg-gradient-primary">
              <Calendar className="w-5 h-5 text-primary-foreground" />
            </div>
            Today's Events
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
          </div>

          {todayRoutines.length > 0 ? (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {todayRoutines.map((routine) => (
                <EventItem key={routine.id} routine={routine} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/50 mb-4">
                <Calendar className="w-8 h-8 text-accent-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No events today
              </h3>
              <p className="text-sm text-muted-foreground">
                You have no routines scheduled for today.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
