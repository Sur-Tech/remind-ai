// Service Worker for background notifications
const CACHE_NAME = 'routine-reminder-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATIONS') {
    const { routines, calendarEvents } = event.data;
    scheduleNotifications(routines, calendarEvents);
  }
});

// Store scheduled notifications
let scheduledNotifications = new Set();

function scheduleNotifications(routines, calendarEvents) {
  console.log('Scheduling notifications for', routines.length, 'routines and', calendarEvents.length, 'events');
  
  // Check notifications every minute
  setInterval(() => {
    checkAndSendNotifications(routines, calendarEvents);
  }, 60000);
  
  // Check immediately
  checkAndSendNotifications(routines, calendarEvents);
}

function checkAndSendNotifications(routines, calendarEvents) {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const currentDate = now.toISOString().split('T')[0];

  // Check routines
  routines.forEach((routine) => {
    const routineKey = `routine-${routine.id}-${currentDate}-${currentTime}`;
    
    if (routine.time === currentTime && !scheduledNotifications.has(routineKey)) {
      self.registration.showNotification("⏰ Reminder Due Now", {
        body: `${routine.name}${routine.description ? '\n' + routine.description : ''}`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: routineKey,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: {
          type: 'routine',
          id: routine.id
        }
      });
      scheduledNotifications.add(routineKey);
      console.log('Notification sent for routine:', routine.name);
    }
  });

  // Check calendar events (5 minutes before)
  calendarEvents.forEach((event) => {
    const eventTime = new Date(event.start_time);
    const notifyTime = new Date(eventTime.getTime() - 5 * 60000);
    const eventKey = `event-${event.id}-${currentDate}`;
    
    const isNotifyTime = 
      now.getHours() === notifyTime.getHours() &&
      now.getMinutes() === notifyTime.getMinutes();

    if (isNotifyTime && !scheduledNotifications.has(eventKey)) {
      self.registration.showNotification("📅 Upcoming Calendar Event", {
        body: `${event.title} starts in 5 minutes${event.description ? '\n' + event.description : ''}`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: eventKey,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: {
          type: 'event',
          id: event.id
        }
      });
      scheduledNotifications.add(eventKey);
      console.log('Notification sent for event:', event.title);
    }
  });

  // Clear old notifications at midnight
  const isMidday = now.getHours() === 0 && now.getMinutes() === 0;
  if (isMidday) {
    scheduledNotifications.clear();
  }
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Open or focus the app
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
