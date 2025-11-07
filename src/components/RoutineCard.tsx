import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, Trash2, Pencil } from "lucide-react";

interface RoutineCardProps {
  routine: {
    id: string;
    name: string;
    time: string;
    description?: string;
  };
  onDelete: (id: string) => void;
  onEdit: (routine: {
    id: string;
    name: string;
    time: string;
    description?: string;
  }) => void;
}

export const RoutineCard = ({ routine, onDelete, onEdit }: RoutineCardProps) => {
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
