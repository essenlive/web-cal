"use client";

import dynamic from "next/dynamic";
import { DataProviderContext } from "../../context/DataProviderContext";

// Same client-only rationale as src/app/page.tsx: every store reads localStorage.
const DebugPage = dynamic(() => import("../../views/DebugPage").then((m) => m.DebugPage), { ssr: false });

export default function Page() {
  return (
    <DataProviderContext>
      <DebugPage />
    </DataProviderContext>
  );
}
