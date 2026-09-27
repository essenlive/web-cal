"use client";

import dynamic from "next/dynamic";
import { DataProviderContext } from "../../context/DataProviderContext";

// Same client-only rationale as src/app/debug/page.tsx: every store reads localStorage.
const StatsPage = dynamic(() => import("../../views/StatsPage").then((m) => m.StatsPage), { ssr: false });

export default function Page() {
  return (
    <DataProviderContext>
      <StatsPage />
    </DataProviderContext>
  );
}
