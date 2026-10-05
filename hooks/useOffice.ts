// hooks/useOffice.ts
// Live OSCA office settings (hours + Open / On break / Closed) for the pickup screens.
import { useEffect, useState } from "react";
import { mergeOffice, OfficeSettings, subscribeToOffice } from "@/lib/pickup";

export function useOffice(): OfficeSettings {
  const [office, setOffice] = useState<OfficeSettings>(() => mergeOffice(null));
  useEffect(() => subscribeToOffice(setOffice), []);
  return office;
}
