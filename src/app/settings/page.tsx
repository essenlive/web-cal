"use client";

import { DataProviderContext } from "../../context/DataProviderContext";
import { SettingsPage } from "../../views/SettingsPage";

export default function Page() {
  return (
    <DataProviderContext>
      <SettingsPage />
    </DataProviderContext>
  );
}
