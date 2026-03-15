import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DataProviderContext } from "./context/DataProviderContext";
import { CalendarPage } from "./pages/CalendarPage";
import { SettingsPage } from "./pages/SettingsPage";
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
    <DataProviderContext>
      <DarkModeWatcher>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<CalendarPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </BrowserRouter>
      </DarkModeWatcher>
    </DataProviderContext>
  );
}
