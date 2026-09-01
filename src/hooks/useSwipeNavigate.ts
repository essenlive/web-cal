import type { PointerEvent } from "react";
import { useRef } from "react";
import { useUIStore } from "../store";
import { stepDate } from "../lib/utils";

const THRESHOLD = 50;

/**
 * Touch-only left/right swipe → steps the current view's date, same as the
 * header's chevron buttons. Pointer Events (not touch events), matching
 * useDragReorder; gated to pointerType === "touch" so mouse drags aren't
 * hijacked as swipes.
 */
export function useSwipeNavigate() {
  const start = useRef<{ x: number; y: number } | null>(null);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    start.current = e.pointerType === "touch" ? { x: e.clientX, y: e.clientY } : null;
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) < THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;

    const { view, currentDate, setCurrentDate } = useUIStore.getState();
    setCurrentDate(stepDate(view, currentDate, dx < 0 ? 1 : -1));
  }

  function onPointerCancel() {
    start.current = null;
  }

  return { onPointerDown, onPointerUp, onPointerCancel };
}
