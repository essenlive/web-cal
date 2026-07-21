"use client";

import { DevDataProviderContext } from "../../context/DataProviderContext";
import { DevPage } from "../../views/DevPage";

export default function Page() {
  return (
    <DevDataProviderContext>
      <DevPage />
    </DevDataProviderContext>
  );
}
