// lib/monitoring.ts
//
// Crash + error reporting for the mobile app (Sentry).
// Does nothing unless EXPO_PUBLIC_SENTRY_DSN is set, and is off in development
// builds (__DEV__), so local testing never pollutes the dashboard.
//
// PRIVACY: this app handles seniors' health and location data. Reports contain
// the error, stack trace, device/OS and the Firebase uid only. Screenshots and
// view hierarchy are NOT attached, phone numbers are redacted from messages, and
// console breadcrumbs are dropped.

import * as Sentry from "@sentry/react-native";

const PH_PHONE = /(\+?63|0)9\d{9}/g;
const redact = (text: string) => text.replace(PH_PHONE, "[phone]");

export function scrubEvent<T>(input: T): T {
  const event: any = input; // Sentry's event shape varies by version, so keep this loose
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  if (event.request) {
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
  }
  if (typeof event.message === "string") event.message = redact(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (typeof ex.value === "string") ex.value = redact(ex.value);
  }
  return event as T;
}

let started = false;

export function initMonitoring() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || started || __DEV__) return;
  started = true;
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    tracesSampleRate: 0.1, // 10% of sessions, keeps within the free quota
    maxBreadcrumbs: 30,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (b) => (b.category === "console" ? null : b),
  });
}

// Only the Firebase uid is attached to reports.
export function setMonitoringUser(uid: string | null) {
  if (!started) return;
  Sentry.setUser(uid ? { id: uid } : null);
}

export function captureAppError(err: unknown, tags: Record<string, string> = {}) {
  if (!started) return;
  Sentry.withScope((scope) => {
    scope.setTags(tags);
    Sentry.captureException(err);
  });
}

// Wraps the root component so crashes in any screen are reported.
export const wrapRoot = <T extends React.ComponentType<any>>(component: T): T =>
  (started ? Sentry.wrap(component) : component) as T;
