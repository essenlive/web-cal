import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement scrollIntoView (used by cmdk to keep the active
// item in view) — stub it so it's a no-op instead of a "not implemented" warning.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom doesn't implement ResizeObserver, which cmdk uses to track list height.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
