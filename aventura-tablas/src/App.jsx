import React, { useEffect, useRef } from "react";
import { Toaster } from "react-hot-toast";
import { useGameStore } from "./utils/store";

// Pages
import LoginPage from "./pages/LoginPage";
import AvatarPage from "./pages/AvatarPage";
import MapaPage from "./pages/MapaPage";
import JuegoPage from "./pages/JuegoPage";
import BossPage from "./pages/BossPage";
import MundoCompletePage from "./pages/MundoCompletePage";
import TiendaPage from "./pages/TiendaPage";
import AdminPage from "./pages/AdminPage";
import SupremoPage from "./pages/SupremoPage";
import IntroPage from "./pages/IntroPage";
import EstudioTablaPage from "./pages/EstudioTablaPage";
import DashboardPage from "./pages/DashboardPage";

import "./App.css";

function App() {
  const pagina = useGameStore((s) => s.pagina);
  const modoDemo = useGameStore((s) => s.modoDemo);
  const demoInicio = useGameStore((s) => s.demoInicio);
  const cerrarSesion = useGameStore((s) => s.cerrarSesion);
  const timerRef = useRef(null);

  // Timer del demo
  useEffect(() => {
    if (modoDemo && demoInicio) {
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - demoInicio) / 1000;
        if (elapsed >= 180) {
          clearInterval(timerRef.current);
          cerrarSesion();
        }
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [modoDemo, demoInicio, cerrarSesion]);

  const renderPagina = () => {
    switch (pagina) {
      case "login":            return <LoginPage />;
      case "seleccion_avatar": return <AvatarPage />;
      case "mapa":             return <MapaPage />;
      case "juego":            return <JuegoPage />;
      case "boss":             return <BossPage />;
      case "mundo_completo":   return <MundoCompletePage />;
      case "tienda":           return <TiendaPage />;
      case "admin":            return <AdminPage />;
      case "supremo":          return <SupremoPage />;
      case "intro":            return <IntroPage />;
      case "estudio_tabla":    return <EstudioTablaPage />;
      case "dashboard":        return <DashboardPage />;
      default:                 return <LoginPage />;
    }
  };

  return (
    <div className="app-root">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "rgba(10,14,39,0.95)",
            color: "#fff",
            border: "1px solid rgba(0,245,255,0.4)",
            borderRadius: "12px",
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: "16px",
          },
          success: { iconTheme: { primary: "#00f5ff", secondary: "#0a0e27" } },
          error: { iconTheme: { primary: "#ff006e", secondary: "#0a0e27" } },
        }}
      />
      {renderPagina()}
    </div>
  );
}

export default App;
