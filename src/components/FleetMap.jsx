import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './map.css';

const pinIcon = (color = '#355f8c') =>
  L.divIcon({
    className: 'fleet-map-pin-wrap',
    html: `<div class="fleet-map-pin" style="background:${color};border-color:${color}"></div>`,
    iconSize: [24, 26],
    iconAnchor: [12, 24],
    popupAnchor: [0, -22],
  });

export default function FleetMap({
  center = [-26.2041, 28.0473],
  zoom = 13,
  markers = [],
  onPick,
  height = 280,
  interactive = true,
}) {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, {
      zoomControl: true,
      dragging: interactive,
      scrollWheelZoom: interactive,
      touchZoom: interactive,
      doubleClickZoom: false,
      attributionControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    if (interactive && onPick) {
      map.on('click', (e) => onPick(e.latlng));
    }
    map.setView(center, zoom);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    markers.forEach((m) => {
      const marker = L.marker([m.lat, m.lng], { icon: pinIcon(m.color) });
      if (m.label) marker.bindPopup(m.label);
      marker.addTo(layer);
    });
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng])).pad(0.4);
      map.fitBounds(bounds, { maxZoom: 15 });
      const follow = markers.find((m) => m.follow);
      if (follow) map.setView([follow.lat, follow.lng], Math.max(map.getZoom(), 14));
    } else {
      map.setView(center, zoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  return (
    <div
      ref={divRef}
      className="fleet-map-root"
      style={{ height, width: '100%' }}
    />
  );
}