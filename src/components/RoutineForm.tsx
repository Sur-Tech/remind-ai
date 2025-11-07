import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Bell } from "lucide-react";

interface RoutineFormProps {
  onAddRoutine: (routine: {
    id: string;
    name: string;
    time: string;
    description?: string;
  }) => void;
  onEditRoutine?: (routine: {
    id: string;
    name: string;
    time: string;
    description?: string;
  }) => void;
  editingRoutine?: {
    id: string;
    name: string;
    time: string;
    description?: string;
  } | null;
  onCancelEdit?: () => void;
}

export const RoutineForm = ({ onAddRoutine, onEditRoutine, editingRoutine, onCancelEdit }: RoutineFormProps) => {
  const [name, setName] = useState("");
  const [time, setTime] = useState("");
  const [description, setDescription] = useState("");

  // Update form when editingRoutine changes
  useEffect(() => {
    if (editingRoutine) {
      setName(editingRoutine.name);
      setTime(editingRoutine.time);
      setDescription(editingRoutine.description || "");
    } else {
      setName("");
      setTime("");
      setDescription("");
    }
  }, [editingRoutine]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && time) {
      if (editingRoutine && onEditRoutine) {
        onEditRoutine({
          id: editingRoutine.id,
          name,
          time,
          description: description || undefined,
        });
      } else {
        onAddRoutine({
          id: crypto.randomUUID(),
          name,
          time,
          description: description || undefined,
        });
      }
      setName("");
      setTime("");
      setDescription("");
    }
  };

  const handleCancel = () => {
    setName("");
    setTime("");
    setDescription("");
    onCancelEdit?.();
  };

  return (
    <Card className="p-6 shadow-card border-border/50 bg-card">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 rounded-lg bg-gradient-primary">
            <Bell className="w-5 h-5 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">
            {editingRoutine ? "Edit Routine" : "Add New Routine"}
          </h2>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name" className="text-foreground font-medium">
            Routine Name
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Morning meditation, Evening workout..."
            required
            className="border-input bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="time" className="text-foreground font-medium">
            Time
          </Label>
          <Input
            id="time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            className="border-input bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-foreground font-medium">
            Description (Optional)
          </Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any notes or details..."
            className="border-input bg-background resize-none"
            rows={3}
          />
        </div>

        <div className="flex gap-3">
          <Button
            type="submit"
            className="flex-1 bg-gradient-primary hover:opacity-90 transition-smooth text-primary-foreground font-medium"
          >
            {editingRoutine ? "Update Routine" : "Add Routine"}
          </Button>
          {editingRoutine && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="px-6"
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
};
