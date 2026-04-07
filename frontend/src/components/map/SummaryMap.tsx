import { useMemo } from 'react';
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

const POSITION_WINDOW = 0.004;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toPercent(current: Coordinates, point: Coordinates) {
  const x = clamp(50 + ((point.lng - current.lng) / POSITION_WINDOW) * 100, 8, 92);
  const y = clamp(50 - ((point.lat - current.lat) / POSITION_WINDOW) * 100, 10, 90);
  return { left: `${x}%`, top: `${y}%` };
}

function resolveMarkerSource(source: DataOrigin): Exclude<DataOrigin, 'disabled'> {
  return source === 'mock' ? 'mock' : 'live';
}

export function SummaryMap({
  coordinates,
  summary,
  selectionMode,
  onManualSelect,
}: SummaryMapProps) {
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
    [summary.buses, summary.dataContext.serviceSources.buses, summary.dataContext.serviceSources.mobility, summary.dataContext.serviceSources.signals, summary.mobilityCenters, summary.signals],
  );

  const handleBoardClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (!selectionMode) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const xRatio = (event.clientX - rect.left) / rect.width;
    const yRatio = (event.clientY - rect.top) / rect.height;

    onManualSelect({
      lat: coordinates.lat + (0.5 - yRatio) * POSITION_WINDOW,
      lng: coordinates.lng + (xRatio - 0.5) * POSITION_WINDOW,
    });
  };

  return (
    <div className="map-card">
      <div className="map-header">
        <div>
          <p className="eyebrow">지도</p>
          <h2>{selectionMode ? '지도를 눌러 위치를 선택하세요' : '주변 교차로와 이동수단 후보'}</h2>
        </div>
        <div className="map-header-side">
          <span>{selectionMode ? '선택 모드' : '탐색 모드'}</span>
          <div className="map-source-legend">
            <small><i className="live" />LIVE</small>
            <small><i className="mock" />MOCK</small>
          </div>
        </div>
      </div>
      <div
        aria-label={selectionMode ? '위치 선택 보드' : '주변 정보 보드'}
        className={`map-board${selectionMode ? ' selecting' : ''}`}
        onClick={handleBoardClick}
        role="button"
        tabIndex={0}
      >
        <div className="map-rings" />
        <div className="map-pin current" style={{ left: '50%', top: '50%' }}>
          <span />
          <small>현재 위치</small>
        </div>
        {markers.map((marker) => (
          <div
            className={`map-pin ${marker.tone} ${marker.source}`}
            key={marker.id}
            style={toPercent(coordinates, marker.position)}
            title={`${marker.label} (${marker.source.toUpperCase()})`}
          >
            <span />
            <small>{marker.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
