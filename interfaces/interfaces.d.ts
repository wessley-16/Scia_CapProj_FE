export interface Medicine {
  id: string;
  name: string;
  dosage: string;
  dosageUnit: "ml" | "mg" | "capsule";
  interval: number; // hours between doses
  lastTakenTime: number; // timestamp
  createdAt: number; // timestamp
}
