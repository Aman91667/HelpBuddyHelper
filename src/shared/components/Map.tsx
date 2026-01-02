// @ts-nocheck
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import type { LocationUpdate as Location } from '@/types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Leaflet markercluster plugin (spiderfy) and styles
// @ts-ignore
import 'leaflet.markercluster/dist/MarkerCluster.css';
// @ts-ignore
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
// @ts-ignore
import 'leaflet.markercluster';

// Fix for default markers
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom larger icons for better visibility at high zoom
const patientIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: iconShadow,
  iconSize: [35, 57],
  iconAnchor: [17, 57],
  popupAnchor: [1, -44],
});

const helperIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: iconShadow,
  iconSize: [35, 57],
  iconAnchor: [17, 57],
  popupAnchor: [1, -44],
});

interface MapProps {
  center: Location;
  markers?: Array<{
    position: Location;
    popup?: string;
    type?: 'patient' | 'helper';
  }>;
  zoom?: number;
  height?: string;
  disabled?: boolean;
  fitToMarkers?: boolean;
  className?: string;
}

const ViewController = ({
  center,
  markers,
  fitToMarkers,
}: {
  center: Location;
  markers: MapProps['markers'];
  fitToMarkers?: boolean;
}) => {
  const map = useMap();

  useEffect(() => {
    if (!center || typeof center.lat !== 'number' || typeof center.lng !== 'number') return;

    const markerPositions = (markers || [])
      .map((marker) => {
        if (!marker?.position) return null;
        const { lat, lng } = marker.position;
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;
        return [lat, lng] as [number, number];
      })
      .filter(Boolean) as [number, number][];

    if (fitToMarkers && markerPositions.length >= 1) {
      const bounds = L.latLngBounds([...markerPositions, [center.lat, center.lng]]);
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 18 });
      return;
    }

    map.setView([center.lat, center.lng]);
  }, [
    center?.lat,
    center?.lng,
    fitToMarkers,
    map,
    JSON.stringify(
      (markers || []).map((m) =>
        m?.position ? [Number(m.position.lat?.toFixed?.(4) ?? m.position.lat), Number(m.position.lng?.toFixed?.(4) ?? m.position.lng)] : null,
      ),
    ),
  ]);

  return null;
};

export const Map = ({
  center,
  markers = [],
  zoom = 17,
  height = '400px',
  disabled = false,
  fitToMarkers = false,
  className = '',
}: MapProps) => {
  const hasCenter = center && typeof center.lat === 'number' && typeof center.lng === 'number';

  if (!hasCenter) {
    return (
      <div
        className={`w-full rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground ${className}`}
        style={{ height }}
      >
        <span>Location unavailable</span>
      </div>
    );
  }

  const centerPos: [number, number] = [center.lat, center.lng];

  // Ensure we have an array of adjusted markers to render when markercluster
  // plugin is not available. Keep the original shape but add `adjustedPos`.
  const adjustedMarkers = (markers || []).map((m) => ({
    ...m,
    adjustedPos: m?.position ?? null,
  }));

  let resolvedHeight =
    height === 'calc-vh'
      ? `calc(100vh - var(--app-header-height,64px) - var(--app-bottom-height,88px))`
      : height;

  // Use a compact height on small screens to avoid the map overlapping other UI elements
  if (typeof window !== 'undefined' && window.innerWidth < 640) {
    if (height === 'calc-vh') {
      resolvedHeight = `calc(60vh - var(--app-header-height,64px))`;
    } else {
      resolvedHeight = '50vh';
    }
  }

  return (
    <div
      className={`w-full rounded-2xl border border-border bg-card shadow-lg overflow-hidden ${
        disabled ? 'pointer-events-none opacity-50' : ''
      } ${className}`}
      style={{ height: resolvedHeight }}
    >
      <MapContainer
        center={centerPos}
        zoom={zoom}
        scrollWheelZoom={!disabled}
        zoomControl={!disabled}
        dragging={!disabled}
        style={{ height: '100%', width: '100%' }}
        maxZoom={19}
        minZoom={15}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <ViewController center={center} markers={markers} fitToMarkers={fitToMarkers} />

        {/* Use markercluster plugin when available; otherwise render adjusted markers */}
        {
          // @ts-ignore
          (L as any).markerClusterGroup ? (
            // Proper React component that uses hooks (useMap) inside React render
            <MarkerClusterLayer markers={markers} />
          ) : (
            adjustedMarkers.map((marker, index) => {
              const hasPos = marker && marker.adjustedPos && typeof marker.adjustedPos.lat === 'number' && typeof marker.adjustedPos.lng === 'number';
              if (!hasPos) return null;

              const pos: [number, number] = [marker.adjustedPos.lat, marker.adjustedPos.lng];
              const markerIcon = marker.type === 'helper' ? helperIcon : patientIcon;

              return (
                <Marker key={index} position={pos} icon={markerIcon}>
                  {marker.popup && <Popup>{marker.popup}</Popup>}
                </Marker>
              );
            })
          )
        }
      </MapContainer>
    </div>
  );
};

function MarkerClusterLayer({ markers: clusterMarkers }: { markers: MapProps['markers'] }) {
  const map = useMap();

  useEffect(() => {
    // @ts-ignore
    const Cluster = (L as any).markerClusterGroup;
    if (!Cluster) return;
    const group = Cluster({ spiderfyOnMaxZoom: true, showCoverageOnHover: true, maxClusterRadius: 50, disableClusteringAtZoom: 18 });

    (clusterMarkers || []).forEach((m) => {
      if (!m?.position) return;
      const icon = m.type === 'helper' ? helperIcon : patientIcon;
      const mk = L.marker([m.position.lat, m.position.lng], { icon });
      if (m.popup) mk.bindPopup(String(m.popup));
      group.addLayer(mk);
    });

    map.addLayer(group);
    return () => {
      try { map.removeLayer(group); } catch (e) { /* ignore */ }
    };
  }, [map, JSON.stringify(clusterMarkers || [])]);

  return null;
}
