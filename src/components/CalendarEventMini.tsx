import { CalendarDays, Sparkles, MapPin, CloudRain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatTime12Hour } from "@/lib/utils";
import { useWeather } from "@/hooks/useWeather";

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  event_date: string;
  description?: string;
  location?: string;
}

interface CalendarEventMiniProps {
  event: CalendarEvent;
  isHoliday: boolean;
}

export const CalendarEventMini = ({ event, isHoliday }: CalendarEventMiniProps) => {
  const { weather } = useWeather(event.location);

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
    <div
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
            {formatTime12Hour(startTime)} - {formatTime12Hour(endTime)}
          </p>
          {event.location && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground truncate mt-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{event.location}</span>
              {weather && (
                <>
                  <span className="mx-1">•</span>
                  <CloudRain className="w-3 h-3 flex-shrink-0" />
                  <span>{weather.temperature}°C</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
