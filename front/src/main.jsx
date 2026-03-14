import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { GoogleOAuthProvider } from "@react-oauth/google";
import { injectTheme } from "./theme.js";

const API = import.meta.env.VITE_BACKEND_URL || 'https://lightblue-gorilla-565179.hostingersite.com';

// Fallback used only if the fetch fails (server down, network error, etc.)
const THEME_FALLBACK = {
  TIMER_DEFAULTS: {
    bg:"#0f0f1a", box:"#1e1b4b", text:"#e0e7ff", accent:"#818cf8",
    title:"", font:"Orbitron", fontSize:36, borderRadius:12, transparent:false,
    showDays:true, showHours:true, showMinutes:true, showSeconds:true,
    visualStyle:"default", width:500, height:130,
  },
  TIMER_TEMPLATES: [
    { name:"Dark Pro", bg:"#0f0f1a", box:"#1e1b4b", text:"#e0e7ff", accent:"#818cf8" },
    { name:"Fire",     bg:"#1c0a00", box:"#7f1d1d", text:"#fef2f2", accent:"#f97316" },
    { name:"Ocean",    bg:"#0c1a2e", box:"#0c4a6e", text:"#e0f2fe", accent:"#38bdf8" },
    { name:"Forest",   bg:"#052e16", box:"#14532d", text:"#dcfce7", accent:"#4ade80" },
    { name:"Gold",     bg:"#1c1400", box:"#451a03", text:"#fef9c3", accent:"#facc15" },
    { name:"Rose",     bg:"#1a000f", box:"#4c0519", text:"#ffe4e6", accent:"#fb7185" },
  ],
  TIMEZONES: [
    "UTC","America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
    "Europe/London","Europe/Paris","Europe/Berlin","Asia/Dubai","Asia/Karachi",
    "Asia/Kolkata","Asia/Tokyo","Asia/Shanghai","Australia/Sydney","Pacific/Auckland",
  ],
  TIMER_FONTS: [
    "Orbitron","Space Mono","Oswald","Bebas Neue","Rajdhani",
    "Share Tech Mono","DM Serif Display","Playfair Display",
  ],
  STYLE_NAMES: { default:"Default", neon:"Neon", minimal:"Minimal", glass:"Glass", retro:"Retro", soft:"Soft" },
};

async function bootstrap() {
  // Inject app UI CSS variables immediately (no async needed — these never change)
  injectTheme();

  // Fetch timer theme from backend (single source of truth)
  try {
    const res = await fetch(`${API}/api/timer/theme`);
    if (res.ok) {
      window.__TIMER_THEME__ = await res.json();
    } else {
      window.__TIMER_THEME__ = THEME_FALLBACK;
    }
  } catch {
    window.__TIMER_THEME__ = THEME_FALLBACK;
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <GoogleOAuthProvider clientId="216065723502-irr9716596hmt5lm51ifdble7b8ieg4v.apps.googleusercontent.com">
        <App />
      </GoogleOAuthProvider>
    </StrictMode>
  );
}

bootstrap();