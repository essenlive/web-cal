import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DataProviderContext, DevDataProviderContext } from "./context/DataProviderContext";
import { CalendarPage } from "./pages/CalendarPage";
import { SettingsPage } from "./pages/SettingsPage";
import { DevPage } from "./pages/DevPage";
import { useUIStore } from "./store";

function DarkModeWatcher({ children }: { children: React.ReactNode }) {
  const { darkMode } = useUIStore();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);
  return <>{children}</>;
}

export default function App() {
  return (
    <DarkModeWatcher>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DataProviderContext><CalendarPage /></DataProviderContext>} />
          <Route path="/settings" element={<DataProviderContext><SettingsPage /></DataProviderContext>} />
          <Route path="/dev" element={<DevDataProviderContext><DevPage /></DevDataProviderContext>} />
        </Routes>
      </BrowserRouter>
    </DarkModeWatcher>
  );
}
