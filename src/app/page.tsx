"use client";

import { DataProviderContext } from "../context/DataProviderContext";
import { CalendarPage } from "../views/CalendarPage";

export default function Page() {
  return (
    <DataProviderContext>
      <CalendarPage />
    </DataProviderContext>
  );
}
