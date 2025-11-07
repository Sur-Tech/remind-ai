import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, Trash2 } from "lucide-react";

interface RoutineCardProps {
  routine: {
    id: string;
    name: string;
    time: string;
    description?: string;
  };
  onDelete: (id: string) => void;
}

export const RoutineCard = ({ routine, onDelete }: RoutineCardProps) => {
  return (
    <Card className="p-5 shadow-soft border-border/50 bg-card hover:shadow-card transition-smooth group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-smooth">
            {routine.name}
          </h3>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">{routine.time}</span>
          </div>
          {routine.description && (
            <p className="text-sm text-muted-foreground mt-2">{routine.description}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(routine.id)}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-smooth"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
};
