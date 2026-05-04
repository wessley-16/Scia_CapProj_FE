export interface Medicine {
  id: string;
  name: string;
  description?: string;
  dosage: string;
  dosageUnit: string;
  interval: number;
  notificationTimes?: { hour: number; minute: number }[];
  notificationId?: string;
  notificationIds?: string[];
  startDate?: string;
  endDate?: string | null;
  startTime: number;
  lastTakenTime: number;
  createdAt: number;
}
