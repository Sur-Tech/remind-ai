import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon, Repeat, Clock, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell } from "lucide-react";
import { cn, formatTime12Hour, formatTime24Hour } from "@/lib/utils";
import { z } from "zod";
import { toast } from "sonner";
import { AddressAutocomplete } from "./AddressAutocomplete";

const routineSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  description: z.string().trim().max(500, "Description must be less than 500 characters").optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  frequency: z.enum(['once', 'daily', 'weekly', 'monthly'], { errorMap: () => ({ message: "Invalid frequency" }) }),
  location: z.string().trim().max(200, "Location must be less than 200 characters").optional()
});

interface RoutineFormProps {
  onAddRoutine: (routine: {
    name: string;
    time: string;
    date: string;
    description?: string;
    frequency: string;
    location?: string;
  }) => void;
  onEditRoutine?: (routine: {
    id: string;
    name: string;
    time: string;
    date: string;
    description?: string;
    frequency: string;
    location?: string;
  }) => void;
  editingRoutine?: {
    id: string;
    name: string;
    time: string;
    date: string;
    description?: string;
    frequency?: string;
    location?: string;
  } | null;
  onCancelEdit?: () => void;
}

export const RoutineForm = ({ onAddRoutine, onEditRoutine, editingRoutine, onCancelEdit }: RoutineFormProps) => {
  const [name, setName] = useState("");
  const [time, setTime] = useState("");
  const [date, setDate] = useState<Date>();
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("once");
  const [location, setLocation] = useState("");

  // Update form when editingRoutine changes
  useEffect(() => {
    if (editingRoutine) {
      setName(editingRoutine.name);
      setTime(formatTime12Hour(editingRoutine.time));
      setDate(parseISO(editingRoutine.date));
      setDescription(editingRoutine.description || "");
      setFrequency(editingRoutine.frequency || "once");
      setLocation(editingRoutine.location || "");
    } else {
      setName("");
      setTime("");
      setDate(undefined);
      setDescription("");
      setFrequency("once");
      setLocation("");
    }
  }, [editingRoutine]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!date) {
      toast.error("Please select a date");
      return;
    }

    // Convert 12-hour time to 24-hour format for storage
    const time24 = formatTime24Hour(time);

    const formData = {
      name: name.trim(),
      time: time24,
      date: format(date, 'yyyy-MM-dd'),
      description: description.trim() || undefined,
      frequency,
      location: location.trim() || undefined,
    };

    // Validate input
    const validation = routineSchema.safeParse(formData);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }
    
    if (editingRoutine && onEditRoutine) {
      onEditRoutine({
        id: editingRoutine.id,
        ...formData,
      });
    } else {
      onAddRoutine(formData);
    }
    
    // Reset form
    setName("");
    setTime("");
    setDate(undefined);
    setDescription("");
    setFrequency("once");
    setLocation("");
  };

  const handleCancel = () => {
    setName("");
    setTime("");
    setDate(undefined);
    setDescription("");
    setFrequency("once");
    setLocation("");
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
            maxLength={100}
            className="border-input bg-background"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-foreground font-medium">
              Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time" className="text-foreground font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Time
            </Label>
            <Input
              id="time"
              type="text"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="e.g., 9:00 AM or 2:30 PM"
              required
              className="border-input bg-background"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="frequency" className="text-foreground font-medium flex items-center gap-2">
            <Repeat className="w-4 h-4 text-primary" />
            Frequency
          </Label>
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger className="border-input bg-background">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="once">Once</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location" className="text-foreground font-medium">
            Location (Optional)
          </Label>
          <AddressAutocomplete
            value={location}
            onChange={setLocation}
            placeholder="Start typing an address..."
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
            maxLength={500}
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
