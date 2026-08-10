"use client";

import dynamic from "next/dynamic";
import { DevDataProviderContext } from "../../context/DataProviderContext";

// Same persisted-store SSR/hydration mismatch as the main page — see src/app/page.tsx.
const DevPage = dynamic(() => import("../../views/DevPage").then((m) => m.DevPage), { ssr: false });

export default function Page() {
  return (
    <DevDataProviderContext>
      <DevPage />
    </DevDataProviderContext>
  );
}
