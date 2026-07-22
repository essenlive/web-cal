"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "../../store";

/**
 * `/settings` is kept as a working bookmark/link (spec FR-007), but preferences
 * now live in the calendar page's settings drawer rather than a standalone page.
 */
export default function Page() {
  const router = useRouter();
  const openDrawer = useUIStore((s) => s.openDrawer);

  useEffect(() => {
    openDrawer("preferences");
    router.replace("/");
  }, [openDrawer, router]);

  return null;
}
