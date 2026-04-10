import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import type { Coordinates, DataOrigin, SummaryPayload } from '../../types/api';

type SummaryMapProps = {
  coordinates: Coordinates;
  summary: SummaryPayload;
  selectionMode: boolean;
  onManualSelect: (coordinates: Coordinates) => void;
};

type MarkerDescriptor = {
  id: string;
  label: string;
  tone: 'signal' | 'bus' | 'mobility';
  source: Exclude<DataOrigin, 'disabled'>;
  position: Coordinates;
};

function resolveMarkerSource(source: DataOrigin): Exclude<DataOrigin, 'disabled'> {
  return source === 'mock' ? 'mock' : 'live';
}

function getMarkerColor(tone: MarkerDescriptor['tone']) {
  if (tone === 'signal') {
    return '#ef4444';
  }

  if (tone === 'bus') {
    return '#f59e0b';
  }

  return '#2563eb';
}

export function SummaryMap({
  coordinates,
  summary,
  selectionMode,
  onManualSelect,
}: SummaryMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const currentMarkerRef = useRef<L.CircleMarker | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const selectionModeRef = useRef(selectionMode);
  const onManualSelectRef = useRef(onManualSelect);

  const markers = useMemo<MarkerDescriptor[]>(
    () => [
      ...summary.signals.map((signal) => ({
        id: signal.intersectionId,
        label: signal.intersectionName,
        tone: 'signal' as const,
        source: resolveMarkerSource(summary.dataContext.serviceSources.signals),
        position: { lat: signal.lat, lng: signal.lng },
      })),
      ...summary.mobilityCenters.map((center) => ({
        id: center.centerId,
        label: center.centerName,
        tone: 'mobility' as const,
        source: resolveMarkerSource(summary.dataContext.serviceSources.mobility),
        position: { lat: center.lat, lng: center.lng },
      })),
      ...summary.buses.map((bus) => ({
        id: bus.routeId,
        label: `${bus.routeNo}번 ${bus.nearStopName}`,
        tone: 'bus' as const,
        source: resolveMarkerSource(summary.dataContext.serviceSources.buses),
        position: { lat: bus.lat, lng: bus.lng },
      })),
    ],
    [
      summary.buses,
      summary.dataContext.serviceSources.buses,
      summary.dataContext.serviceSources.mobility,
      summary.dataContext.serviceSources.signals,
      summary.mobilityCenters,
      summary.signals,
    ],
  );

  useEffect(() => {
    selectionModeRef.current = selectionMode;
    onManualSelectRef.current = onManualSelect;
  }, [onManualSelect, selectionMode]);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return;
    }

    const map = L.map(mapElementRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([coordinates.lat, coordinates.lng], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const markerLayer = L.layerGroup().addTo(map);
    const currentMarker = L.circleMarker([coordinates.lat, coordinates.lng], {
      radius: 10,
      color: '#ffffff',
      weight: 3,
      fillColor: '#0f766e',
      fillOpacity: 1,
    })
      .bindTooltip('현재 위치', {
        direction: 'top',
        offset: [0, -8],
        permanent: true,
      })
      .addTo(map);

    map.on('click', (event: L.LeafletMouseEvent) => {
      if (!selectionModeRef.current) {
        return;
      }

      onManualSelectRef.current({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    });

    mapRef.current = map;
    markerLayerRef.current = markerLayer;
    currentMarkerRef.current = currentMarker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      currentMarkerRef.current = null;
    };
  }, [coordinates.lat, coordinates.lng]);

  useEffect(() => {
    if (!mapRef.current || !currentMarkerRef.current) {
      return;
    }

    mapRef.current.setView([coordinates.lat, coordinates.lng], mapRef.current.getZoom(), {
      animate: true,
    });
    currentMarkerRef.current.setLatLng([coordinates.lat, coordinates.lng]);
  }, [coordinates]);

  useEffect(() => {
    if (!markerLayerRef.current) {
      return;
    }

    markerLayerRef.current.clearLayers();

    markers.forEach((marker) => {
      const circle = L.circleMarker([marker.position.lat, marker.position.lng], {
        radius: marker.tone === 'mobility' ? 9 : 8,
        color: marker.source === 'live' ? '#ffffff' : '#f8fafc',
        weight: 3,
        fillColor: getMarkerColor(marker.tone),
        fillOpacity: marker.source === 'live' ? 0.95 : 0.72,
      }).bindTooltip(marker.label, {
        direction: 'top',
        offset: [0, -8],
      });

      markerLayerRef.current?.addLayer(circle);
    });
  }, [markers]);

  useEffect(() => {
    if (!mapElementRef.current) {
      return;
    }

    mapElementRef.current.style.cursor = selectionMode ? 'crosshair' : '';
  }, [selectionMode]);

  return (
    <div className="map-card app-map-card">
      <div aria-label={selectionMode ? '위치 선택 지도' : '주변 정보 지도'} className={`map-board${selectionMode ? ' selecting' : ''}`}>
        <div className="map-overlay-panel">
          <div className="map-stat-pill">
            <strong>{summary.signals.length}</strong>
            <span>신호</span>
          </div>
          <div className="map-stat-pill">
            <strong>{summary.buses.length}</strong>
            <span>버스</span>
          </div>
          <div className="map-stat-pill">
            <strong>{summary.mobilityCenters.length}</strong>
            <span>이동지원</span>
          </div>
        </div>
        <div className="leaflet-map" ref={mapElementRef} />
        {selectionMode ? <div className="map-select-hint">지도를 눌러 위치를 고르세요</div> : null}
      </div>
    </div>
  );
}
