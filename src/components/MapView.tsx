import React, { useEffect, useRef } from 'react';
import { Map as MaplibreMap, NavigationControl, GeoJSONSource, Marker, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Gantry } from '../data/gantries';
import { ENV } from '../config/env';

interface MapViewProps {
  routeCoords: [number, number][];
  riderCoords: [number, number];
  gantries: Gantry[];
  alertLevel: 'green' | 'amber' | 'red';
}

const ALERT_COLORS = { green: '#22c55e', amber: '#f59e0b', red: '#ef4444' };

export function MapView({ routeCoords, riderCoords, gantries, alertLevel }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MaplibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  // ── Initial map setup ────────────────────────────────────────────────────
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new MaplibreMap({
      container: mapContainer.current,
      style: ENV.MAP_STYLE_URL,
      center: [77.0320, 28.4486], // Rajiv Chowk midpoint of NH-48
      zoom: 12,
      pitch: 40,
      bearing: -20,
      attributionControl: false,
    });

    map.current.addControl(new NavigationControl({ showCompass: true }), 'bottom-right');

    map.current.on('load', () => {
      if (!map.current) return;

      // Route polyline
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: routeCoords.length >= 2 ? routeCoords : [[77.0872, 28.5022], [76.9384, 28.3618]] },
        },
      });

      // Route shadow (glow effect)
      map.current.addLayer({
        id: 'route-shadow',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#2563eb', 'line-width': 14, 'line-opacity': 0.25, 'line-blur': 6 },
      });

      // Route main line
      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#3b82f6', 'line-width': 5, 'line-opacity': 0.9 },
      });

      // Rider position dot
      map.current.addSource('rider', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: riderCoords } },
      });

      map.current.addLayer({
        id: 'rider-halo',
        type: 'circle',
        source: 'rider',
        paint: {
          'circle-radius': 22,
          'circle-color': ALERT_COLORS.green,
          'circle-opacity': 0.25,
          'circle-blur': 0.5,
        },
      });

      map.current.addLayer({
        id: 'rider-point',
        type: 'circle',
        source: 'rider',
        paint: {
          'circle-radius': 9,
          'circle-color': ALERT_COLORS.green,
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      });

      // ANPR gantry markers
      gantries.forEach(g => {
        const el = document.createElement('div');
        el.innerHTML = '📷';
        el.style.cssText = `
          font-size: 22px; cursor: pointer;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
          transition: transform 0.2s;
        `;
        el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.3)'; });
        el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });

        const marker = new Marker({ element: el })
          .setLngLat(g.coords)
          .setPopup(
            new Popup({ offset: 20 }).setHTML(`
              <div style="font-family: system-ui; padding: 4px;">
                <b style="color:#dc2626">📷 ANPR Gantry</b><br/>
                <span style="font-size:13px">${g.name}</span><br/>
                <span style="color:#6b7280;font-size:12px">${g.road} · Limit: <b>${g.limit_kmh} km/h</b></span>
              </div>
            `)
          )
          .addTo(map.current!);
        markersRef.current.push(marker);
      });
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      map.current?.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update route polyline ─────────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || routeCoords.length < 2) return;
    const src = map.current.getSource('route') as GeoJSONSource;
    if (src) {
      src.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeCoords } });
    }
  }, [routeCoords]);

  // ── Update rider position & alert color ──────────────────────────────────
  useEffect(() => {
    if (!map.current) return;
    const src = map.current.getSource('rider') as GeoJSONSource;
    if (src) {
      src.setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: riderCoords } });
    }
    // Smoothly pan camera to follow rider
    map.current.easeTo({ center: riderCoords, duration: 800, easing: (t: number) => t * (2 - t) });
  }, [riderCoords]);

  // ── Update alert halo color ───────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    const color = ALERT_COLORS[alertLevel] || ALERT_COLORS.green;
    map.current.setPaintProperty('rider-point', 'circle-color', color);
    map.current.setPaintProperty('rider-halo', 'circle-color', color);
  }, [alertLevel]);

  return (
    <div
      ref={mapContainer}
      style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }}
    />
  );
}
