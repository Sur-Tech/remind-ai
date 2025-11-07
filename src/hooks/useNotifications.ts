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
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 1.5);
    
    // Add second note for harmony
    const oscillator2 = audioContext.createOscillator();
    oscillator2.connect(gainNode);
    oscillator2.frequency.setValueAtTime(659.25, audioContext.currentTime); // E5
    oscillator2.type = "sine";
    oscillator2.start(audioContext.currentTime + 0.1);
    oscillator2.stop(audioContext.currentTime + 1.5);
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
        toast.success("Notifications enabled! You'll receive reminders at the scheduled times.");
      } else {
        toast.error("Notifications denied. Please enable them in your browser settings.");
      }
    }
  };

  useEffect(() => {
    if (permission !== "granted" || (routines.length === 0 && calendarEvents.length === 0)) return;

    const checkNotifications = () => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;
      const currentDate = now.toISOString().split('T')[0];

      // Check routines
      routines.forEach((routine) => {
        const routineKey = `routine-${routine.id}-${currentDate}-${currentTime}`;
        
        if (routine.time === currentTime && !notifiedItems.has(routineKey)) {
          try {
            playNotificationSound();
            new Notification("⏰ Reminder Due Now", {
              body: `${routine.name}${routine.description ? '\n' + routine.description : ''}`,
              icon: "/favicon.ico",
              badge: "/favicon.ico",
              tag: routineKey,
              requireInteraction: true,
            });
            setNotifiedItems(prev => new Set(prev).add(routineKey));
            console.log("Notification sent for routine:", routine.name);
          } catch (error) {
            console.error("Failed to send notification:", error);
          }
        }
      });

      // Check calendar events (notify 5 minutes before)
      calendarEvents.forEach((event) => {
        const eventTime = new Date(event.start_time);
        const notifyTime = new Date(eventTime.getTime() - 5 * 60000);
        const eventKey = `event-${event.id}-${currentDate}`;
        
        const isNotifyTime = 
          now.getHours() === notifyTime.getHours() &&
          now.getMinutes() === notifyTime.getMinutes();

        if (isNotifyTime && !notifiedItems.has(eventKey)) {
          try {
            playNotificationSound();
            new Notification("📅 Upcoming Calendar Event", {
              body: `${event.title} starts in 5 minutes${event.description ? '\n' + event.description : ''}`,
              icon: "/favicon.ico",
              badge: "/favicon.ico",
              tag: eventKey,
              requireInteraction: true,
            });
            setNotifiedItems(prev => new Set(prev).add(eventKey));
            console.log("Notification sent for event:", event.title);
          } catch (error) {
            console.error("Failed to send notification:", error);
          }
        }
      });
    };

    // Check immediately
    checkNotifications();
    
    // Check every minute
    const interval = setInterval(checkNotifications, 60000);

    return () => clearInterval(interval);
  }, [routines, calendarEvents, permission, notifiedItems]);

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
