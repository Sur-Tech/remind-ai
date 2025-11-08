import { MapPin, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { WeatherDisplay } from "./WeatherDisplay";
import { useWeather } from "@/hooks/useWeather";
import { formatTime12Hour } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  event_date: string;
  description?: string;
  location?: string;
}

interface CalendarEventItemProps {
  event: CalendarEvent;
}

export const CalendarEventItem = ({ event }: CalendarEventItemProps) => {
  const { weather, loading: weatherLoading, error: weatherError } = useWeather(event.location);

  // Extract time from ISO timestamp
  const getTimeFromISO = (isoString: string) => {
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const startTime = getTimeFromISO(event.start_time);
  const endTime = getTimeFromISO(event.end_time);

  return (
    <Card className="p-4 border-border hover:shadow-md transition-shadow">
      <div className="space-y-3">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground text-lg">{event.title}</h3>
            {event.description && (
              <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-sm font-medium text-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(event.start_time).toLocaleDateString()}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatTime12Hour(startTime)} - {formatTime12Hour(endTime)}
            </div>
          </div>
        </div>

        {event.location && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="flex-1">{event.location}</p>
            </div>
            
            <WeatherDisplay 
              weather={weather} 
              loading={weatherLoading} 
              error={weatherError} 
            />
          </div>
        )}
      </div>
    </Card>
  );
};
