/**
 * env.ts — Single source of truth for all runtime configuration.
 *
 * Reads Vite VITE_* env variables (set in root .env file).
 * All values fall back to safe defaults so the app runs with no .env present.
 * Import this instead of scattering import.meta.env.* across the codebase.
 */

const DEFAULT_PROD_BACKEND = 'https://velo-ai-u5tz.onrender.com';

export const apiUrl = (endpoint: string): string => {
  const backend = import.meta.env.VITE_BACKEND_URL?.trim();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // If running locally in browser (localhost / 127.0.0.1), use relative path so Vite proxy handles it
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      return cleanEndpoint;
    }
  }

  // If backend URL is explicitly set and not localhost
  if (backend && !backend.includes('localhost') && !backend.includes('127.0.0.1')) {
    return `${backend.replace(/\/+$/, '')}${cleanEndpoint}`;
  }

  // In production cloud environments (e.g. Vercel or external host), point directly to the live Render backend
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal) {
      return `${DEFAULT_PROD_BACKEND}${cleanEndpoint}`;
    }
  }

  return cleanEndpoint;
};

export const ENV = {
  // ── Backend ──────────────────────────────────────────────────────────────
  /** FastAPI base URL – point to ngrok for Bolna or localhost for local dev */
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000',

  /** Default Bolna session ID – matches the FastAPI session store key */
  SESSION_ID: import.meta.env.VITE_DEFAULT_SESSION_ID ?? 'ride_gurgaon_101',

  /** Bolna API Key for outbound calls */
  BOLNA_API_KEY: import.meta.env.VITE_BOLNA_API_KEY ?? '',

  /** Bolna Agent ID */
  BOLNA_AGENT_ID: import.meta.env.VITE_BOLNA_AGENT_ID ?? '',

  // ── Free Spatial Services (no API keys) ──────────────────────────────────
  /** MapLibre GL vector tile style from OpenFreeMap */
  MAP_STYLE_URL: import.meta.env.VITE_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/liberty',

  /** Free OSM tile URL for Leaflet raster maps */
  OSM_TILE_URL: import.meta.env.VITE_OSM_TILE_URL ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',

  /** Public OSRM routing engine */
  OSRM_ROUTE_URL: import.meta.env.VITE_OSRM_ROUTE_URL ?? 'https://router.project-osrm.org/route/v1/driving',

  /** Photon place-search by Komoot */
  PHOTON_SEARCH_URL: import.meta.env.VITE_PHOTON_SEARCH_URL ?? 'https://photon.komoot.io/api',
} as const;

// ── Derived / configurable engine parameters ─────────────────────────────
export const PACE_CONFIG = {
  /** Safety margin against GPS + camera clock variance (default 4% / 0.04) */
  MARGIN: Number(import.meta.env.VITE_SAFETY_MARGIN ?? 0.04),
  /** AMBER alert fires this many km/h below the ceiling */
  AMBER_GAP_KMH: Number(import.meta.env.VITE_AMBER_GAP_KMH ?? 5.0),
} as const;
