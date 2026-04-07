export function formatRelativeTime(timestamp: string) {
  const diff = Math.max(0, Date.now() - new Date(timestamp).getTime());
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) {
    return `${seconds}초 전`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}분 전`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}시간 전`;
}

export function formatCoordinates(lat: number, lng: number) {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}
