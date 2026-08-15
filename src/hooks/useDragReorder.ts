import { useRef, useState } from "react";

/**
 * Pointer Events (not HTML5 native drag-and-drop) so this works with touch as
 * well as mouse — native `draggable`/`ondragstart` never fires on touch
 * devices. `getDragProps(index)` wires one row: a `ref` to measure its
 * position, and `onHandlePointerDown` for its drag handle. While dragging,
 * the row closest to the pointer's Y position is the drop target; releasing
 * calls `reorder(id, toIndex)` if it moved.
 */
export function useDragReorder<T>(items: T[], getId: (item: T) => string, reorder: (id: string, toIndex: number) => void) {
  const rows = useRef(new Map<number, HTMLElement>());
  const drag = useRef<{ from: number } | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function closestIndex(clientY: number): number {
    let best = 0;
    let bestDist = Infinity;
    rows.current.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      const dist = Math.abs(clientY - (rect.top + rect.height / 2));
      if (dist < bestDist) { bestDist = dist; best = index; }
    });
    return best;
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag.current) return;
    setOverIndex(closestIndex(e.clientY));
  }

  function onPointerUp(e: PointerEvent) {
    if (drag.current) {
      const to = closestIndex(e.clientY);
      if (to !== drag.current.from) reorder(getId(items[drag.current.from]), to);
    }
    drag.current = null;
    setOverIndex(null);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }

  function getDragProps(index: number) {
    return {
      ref: (el: HTMLElement | null) => { if (el) rows.current.set(index, el); else rows.current.delete(index); },
      dragging: drag.current?.from === index,
      over: overIndex === index && drag.current?.from !== index,
      onHandlePointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        drag.current = { from: index };
        setOverIndex(index);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
      },
    };
  }

  return { getDragProps };
}
