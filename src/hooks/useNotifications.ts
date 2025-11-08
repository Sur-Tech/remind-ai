import { useEffect, useState } from "react";
import { toast as sonnerToast } from "sonner";

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

// Create a pleasant notification sound using Web Audio API
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Create a pleasant chime sound (C major chord)
    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
    oscillator.type = "sine";
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 2.0);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 2.0);
    
    // Add second note for harmony
    const oscillator2 = audioContext.createOscillator();
    oscillator2.connect(gainNode);
    oscillator2.frequency.setValueAtTime(659.25, audioContext.currentTime); // E5
    oscillator2.type = "sine";
    oscillator2.start(audioContext.currentTime + 0.1);
    oscillator2.stop(audioContext.currentTime + 2.0);
  } catch (error) {
    console.error("Failed to play notification sound:", error);
  }
};

export const useNotifications = (routines: Routine[], calendarEvents: CalendarEvent[] = []) => {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [notifiedItems, setNotifiedItems] = useState<Set<string>>(new Set());

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
        sonnerToast.success("Notifications enabled! You'll receive reminders at the scheduled times.");
      } else {
        sonnerToast.error("Notifications denied. Please enable them in your browser settings.");
      }
    }
  };

  // Check for notifications every minute
  useEffect(() => {
    if (permission !== "granted") return;

    const checkNotifications = () => {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      const currentDate = now.toISOString().split("T")[0];

      // Check routines
      routines.forEach((routine) => {
        const routineKey = `routine-${routine.id}-${currentDate}`;
        
        if (routine.time === currentTime && !notifiedItems.has(routineKey)) {
          playNotificationSound();
          new Notification("Routine Reminder", {
            body: `Time for: ${routine.name}${routine.description ? `\n${routine.description}` : ""}`,
            icon: "/favicon.ico",
            tag: routineKey,
          });
          
          sonnerToast.info(`Routine: ${routine.name}`, {
            description: routine.description || "It's time for your routine!",
          });
          
          setNotifiedItems((prev) => new Set(prev).add(routineKey));
        }
      });

      // Check calendar events
      calendarEvents.forEach((event) => {
        const eventTime = new Date(event.start_time);
        const eventTimeString = `${eventTime.getHours().toString().padStart(2, "0")}:${eventTime.getMinutes().toString().padStart(2, "0")}`;
        const eventDate = eventTime.toISOString().split("T")[0];
        const eventKey = `event-${event.id}-${eventDate}`;
        
        if (eventTimeString === currentTime && eventDate === currentDate && !notifiedItems.has(eventKey)) {
          playNotificationSound();
          new Notification("Calendar Event", {
            body: `${event.title}${event.description ? `\n${event.description}` : ""}`,
            icon: "/favicon.ico",
            tag: eventKey,
          });
          
          sonnerToast.info(`Event: ${event.title}`, {
            description: event.description || "Your event is starting now!",
          });
          
          setNotifiedItems((prev) => new Set(prev).add(eventKey));
        }
      });
    };

    // Check immediately and then every minute
    checkNotifications();
    const interval = setInterval(checkNotifications, 60000);

    return () => clearInterval(interval);
  }, [permission, routines, calendarEvents, notifiedItems]);

  // Clear notified items at midnight
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0);
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();

    const timeout = setTimeout(() => {
      setNotifiedItems(new Set());
    }, timeUntilMidnight);

    return () => clearTimeout(timeout);
  }, []);

  return { permission, requestPermission };
};
