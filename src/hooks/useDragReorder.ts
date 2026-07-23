import { useState } from "react";

/**
 * Native HTML5 drag-and-drop reorder for a flat list — no external library.
 * Extracted from the rules list (the first place this pattern was needed);
 * `getDragProps(index)` wires one row's drag handlers, calling `reorder(id, toIndex)`
 * (the store action) on drop.
 */
export function useDragReorder<T>(items: T[], getId: (item: T) => string, reorder: (id: string, toIndex: number) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function getDragProps(index: number) {
    return {
      draggable: true,
      onDragStart: () => setDragIndex(index),
      onDragOver: (e: React.DragEvent) => e.preventDefault(),
      onDrop: () => {
        if (dragIndex !== null && dragIndex !== index) reorder(getId(items[dragIndex]), index);
        setDragIndex(null);
      },
    };
  }

  return { getDragProps };
}
