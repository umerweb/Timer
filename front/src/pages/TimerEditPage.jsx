import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import EditorScreen from "../components/EditorScreen";
import { API, apiFetch } from "../utils/api";

// ─── TimerEditPage ─────────────────────────────────────────────────────────────
// Mounted at /timer/:id
// id === "new"  → create flow (initialTimer = null)
// id === number → edit flow   (initialTimer = fetched timer)
// ─────────────────────────────────────────────────────────────────────────────
export default function TimerEditPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const isNew    = id === "new";

  const [user,         setUser]         = useState(null);
  const [timer,        setTimer]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [serverOnline, setServerOnline] = useState(null);

  // ── Auth check ───────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { navigate("/login"); return; }
    try {
      setUser(jwtDecode(token));
    } catch {
      localStorage.removeItem("accessToken");
      navigate("/login");
    }
  }, [navigate]);

  // ── Server health check ──────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/health`)
      .then((r) => setServerOnline(r.ok))
      .catch(() => setServerOnline(false));
  }, []);

  // ── Fetch timer data (skip for new) ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    if (isNew) {
      setLoading(false);
      return;
    }

    apiFetch(`${API}/api/timers/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Timer not found");
        return r.json();
      })
      .then((data) => {
        setTimer(data);
        setLoading(false);
      })
      .catch(() => {
        // Timer not found or no permission → send back to dashboard
        navigate("/dashboard");
      });
  }, [user, id, isNew, navigate]);

  // ── onSaved handler ───────────────────────────────────────────────────────
  // Updates local timer state so the editor has fresh data (e.g. updatedAt),
  // and silently moves the URL from /timer/new → /timer/123 without remounting.
  const handleSaved = (saved) => {
    setTimer(saved);
    if (isNew || String(saved.id) !== String(id)) {
      navigate(`/timer/${saved.id}`, { replace: true });
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (!user || loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--color-bg)] font-[var(--font-sans)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg text-xl bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] flex items-center justify-center animate-pulse">
            ⏳
          </div>
          <div className="text-[var(--color-muted)] text-sm">Loading timer…</div>
        </div>
      </div>
    );
  }

  // ── Render editor ────────────────────────────────────────────────────────
  return (
    <EditorScreen
      user={user}
      serverOnline={serverOnline}
      initialTimer={isNew ? null : timer}
      onSaved={handleSaved}
      onBack={() => navigate("/dashboard")}
      onLogout={() => {
        localStorage.removeItem("accessToken");
        navigate("/login");
      }}
    />
  );
}