// lib/polyfills.ts
// Must be imported at the very top of app/_layout.tsx

if (typeof AbortSignal.any === "undefined") {
  AbortSignal.any = function (signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason);
        return controller.signal;
      }
      signal.addEventListener("abort", () => controller.abort(signal.reason), {
        once: true,
      });
    }
    return controller.signal;
  };
}
