import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Coordinates } from '../types/api';

const FALLBACK_COORDINATES: Coordinates = {
  lat: 35.5384,
  lng: 129.3114,
};

type LocationStatus = 'idle' | 'loading' | 'granted' | 'fallback' | 'error';

export function useLocation() {
  const hasGeolocation = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const [coordinates, setCoordinates] = useState<Coordinates>(FALLBACK_COORDINATES);
  const [status, setStatus] = useState<LocationStatus>(hasGeolocation ? 'loading' : 'fallback');
  const [errorMessage, setErrorMessage] = useState<string | null>(
    hasGeolocation ? null : '브라우저 위치 기능을 사용할 수 없어 울산 신호·버스 기준으로 보여드립니다.',
  );
  const [selectionMode, setSelectionMode] = useState(false);

  const requestCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('error');
      setErrorMessage('브라우저 위치 기능을 사용할 수 없습니다.');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCoordinates({
          lat: coords.latitude,
          lng: coords.longitude,
        });
        setStatus('granted');
      },
      () => {
        setStatus('fallback');
        setErrorMessage('위치 권한이 없어서 울산 신호·버스 기준으로 보여드리고 있습니다.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCoordinates({
          lat: coords.latitude,
          lng: coords.longitude,
        });
        setStatus('granted');
      },
      () => {
        setStatus('fallback');
        setErrorMessage('위치 권한이 없어서 울산 신호·버스 기준으로 보여드리고 있습니다.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }, [requestCurrentLocation]);

  const setManualLocation = useCallback((next: Coordinates) => {
    setCoordinates(next);
    setStatus('granted');
    setSelectionMode(false);
    setErrorMessage(null);
  }, []);

  const locationLabel = useMemo(() => {
    if (status === 'granted') {
      return '현재 또는 직접 선택한 위치';
    }

    return '기본 위치(울산)';
  }, [status]);

  return {
    coordinates,
    errorMessage,
    locationLabel,
    selectionMode,
    setManualLocation,
    setSelectionMode,
    requestCurrentLocation,
    status,
  };
}
