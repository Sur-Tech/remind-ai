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
  const [serviceWorkerRegistration, setServiceWorkerRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator && 'Notification' in window) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
          setServiceWorkerRegistration(registration);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
      
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

  // Send routines and events to service worker
  useEffect(() => {
    if (permission !== "granted" || !serviceWorkerRegistration) return;
    if (routines.length === 0 && calendarEvents.length === 0) return;

    // Send data to service worker
    navigator.serviceWorker.controller?.postMessage({
      type: 'SCHEDULE_NOTIFICATIONS',
      routines,
      calendarEvents
    });

    console.log('Sent notification schedule to service worker');
  }, [routines, calendarEvents, permission, serviceWorkerRegistration]);

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
