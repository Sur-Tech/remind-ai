import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, Trash2, Pencil, Calendar, MapPin, Car, Navigation, ChevronDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useTravelTime } from "@/hooks/useTravelTime";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface RoutineCardProps {
  routine: {
    id: string;
    name: string;
    time: string;
    date: string;
    description?: string;
    location?: string;
  };
  onDelete: (id: string) => void;
  onEdit: (routine: {
    id: string;
    name: string;
    time: string;
    date: string;
    description?: string;
    location?: string;
  }) => void;
}

export const RoutineCard = ({ routine, onDelete, onEdit }: RoutineCardProps) => {
  const { travelTime, loading, error } = useTravelTime(routine.location);
  const [showDirections, setShowDirections] = useState(false);

  return (
    <Card className="p-5 shadow-soft border-border/50 bg-card hover:shadow-card transition-smooth group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-smooth">
            {routine.name}
          </h3>
          <div className="flex items-center gap-4 text-muted-foreground flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">
                {format(parseISO(routine.date), "MMM d, yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">{routine.time}</span>
            </div>
            {routine.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span className="text-sm font-medium">{routine.location}</span>
              </div>
            )}
            {travelTime && (
              <div className="flex items-center gap-2 text-primary">
                <Car className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {travelTime.duration} drive ({travelTime.distance})
                </span>
              </div>
            )}
            {loading && routine.location && (
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 animate-pulse" />
                <span className="text-sm font-medium">Calculating...</span>
              </div>
            )}
          </div>
          {routine.description && (
            <p className="text-sm text-muted-foreground mt-2">{routine.description}</p>
          )}
          {travelTime?.directions && travelTime.directions.length > 0 && (
            <Collapsible open={showDirections} onOpenChange={setShowDirections} className="mt-3">
              <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-smooth">
                <Navigation className="w-4 h-4" />
                <span>Directions ({travelTime.directions.length} steps)</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showDirections ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-2">
                {travelTime.directions.map((step, index) => (
                  <div key={index} className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{step.instruction}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {step.distance} • {step.duration}
                      </p>
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(routine)}
            className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-smooth"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(routine.id)}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-smooth"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
