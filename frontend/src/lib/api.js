import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Optionally redirect on auth fail
    }
    return Promise.reject(err);
  }
);

// Stock image URL from Unsplash source service (no key needed)
export function unsplashImg(query, w = 800, h = 600) {
  const q = encodeURIComponent(query || "travel");
  return `https://source.unsplash.com/${w}x${h}/?${q}`;
}

export function googleMapsUrl(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function photoUrl(photoId) {
  const token = localStorage.getItem("token");
  return `${API}/photos/${photoId}/download?auth=${encodeURIComponent(token || "")}`;
}
