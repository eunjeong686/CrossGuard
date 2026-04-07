import type { Coordinates } from '../types/internal.js';

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function offsetCoordinates(origin: Coordinates, latOffset: number, lngOffset: number): Coordinates {
  return {
    lat: origin.lat + latOffset,
    lng: origin.lng + lngOffset,
  };
}

export function getDistanceMeters(origin: Coordinates, destination: Coordinates) {
  const lat1 = toRadians(origin.lat);
  const lat2 = toRadians(destination.lat);
  const latDiff = toRadians(destination.lat - origin.lat);
  const lngDiff = toRadians(destination.lng - origin.lng);

  const haversine =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDiff / 2) ** 2;

  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return Math.round(EARTH_RADIUS_METERS * centralAngle);
}
