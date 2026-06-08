import { z } from "zod";

export const applianceClassSchema = z.enum([
  "washer",
  "dryer",
  "refrigerator",
  "range",
  "stove",
  "oven",
  "freezer",
  "dishwasher",
  "combo",
  "unknown"
]);

export type ApplianceClass = z.infer<typeof applianceClassSchema>;

export interface Identity {
  brand: string | null;
  model: string | null;
  serial: string | null;
  productType: string | null;
  applianceClass?: ApplianceClass;
  alternates: string[];
  confidence: number;
}
