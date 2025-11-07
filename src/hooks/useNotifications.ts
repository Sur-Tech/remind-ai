import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Routine {
  id: string;
  name: string;
  time: string;
  description?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  description?: string;
}

export const useNotifications = (routines: Routine[], calendarEvents: CalendarEvent[] = []) => {
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if ("Notification" in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        toast.success("Notifications enabled! You'll receive reminders at the scheduled times.");
      } else {
        toast.error("Notifications denied. Please enable them in your browser settings.");
      }
    }
  };

  useEffect(() => {
    if (permission !== "granted" || (routines.length === 0 && calendarEvents.length === 0)) return;

    const checkRoutines = () => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;

      // Check routines
      routines.forEach((routine) => {
        if (routine.time === currentTime) {
          new Notification("⏰ Routine Reminder", {
            body: routine.description || `Time for: ${routine.name}`,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
          });
        }
      });

      // Check calendar events (notify 5 minutes before)
      calendarEvents.forEach((event) => {
        const eventTime = new Date(event.start_time);
        const notifyTime = new Date(eventTime.getTime() - 5 * 60000); // 5 minutes before
        
        if (
          now.getHours() === notifyTime.getHours() &&
          now.getMinutes() === notifyTime.getMinutes()
        ) {
          new Notification("📅 Upcoming Calendar Event", {
            body: `${event.title} starts in 5 minutes${event.description ? '\n' + event.description : ''}`,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
          });
        }
      });
    };

    // Check every minute
    const interval = setInterval(checkRoutines, 60000);
    
    // Also check immediately
    checkRoutines();

    return () => clearInterval(interval);
  }, [routines, calendarEvents, permission]);

  return { permission, requestPermission };
};
