export interface Medicine {
  id: string;
  name: string;
  description?: string; // Purpose of the medicine
  dosage: string;
  dosageUnit: string; // Changed to string to allow more flexibility
  interval: number; // hours between doses (used for interval-based)
  notificationTimes?: { hour: number; minute: number }[]; // For fixed time schedules
  startDate?: string; // ISO Date string
  endDate?: string | null; // ISO Date string or null for maintenance
  startTime: number; // When the schedule starts (timestamp)
  lastTakenTime: number; // timestamp
  notificationIds?: string[]; // IDs for cancelling notifications (array for multiple times)
  createdAt: number; // timestamp
}
