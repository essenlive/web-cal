"use client";

import dynamic from "next/dynamic";
import { DataProviderContext } from "../../context/DataProviderContext";

// Same client-only rationale as src/app/debug/page.tsx: every store reads localStorage.
const DataPage = dynamic(() => import("../../views/DataPage").then((m) => m.DataPage), { ssr: false });

export default function Page() {
  return (
    <DataProviderContext>
      <DataPage />
    </DataProviderContext>
  );
}
