const API = import.meta.env.VITE_BACKEND_URL || 'https://lightblue-gorilla-565179.hostingersite.com';

export { API };

export const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
});

export async function apiFetch(url, options = {}) {
  let res = await fetch(url, { ...options, headers: authHeaders() });
  if (res.status === 401) {
    const refresh = await fetch(`${API}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (refresh.ok) {
      const { accessToken } = await refresh.json();
      localStorage.setItem("accessToken", accessToken);
      res = await fetch(url, { ...options, headers: authHeaders() });
    } else {
      localStorage.removeItem("accessToken");
      window.location.href = "/login";
    }
  }
  return res;
}