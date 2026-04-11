import type { Request } from 'express';
import type { Coordinates, PaceProfile, Persona } from '../types/internal.js';
import { HttpError } from './errors.js';

function parseCoordinate(value: unknown, name: 'lat' | 'lng') {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, `${name} 쿼리 파라미터가 필요합니다.`);
  }

  if (name === 'lat' && (parsed < -90 || parsed > 90)) {
    throw new HttpError(400, 'lat 값은 -90부터 90 사이여야 합니다.');
  }

  if (name === 'lng' && (parsed < -180 || parsed > 180)) {
    throw new HttpError(400, 'lng 값은 -180부터 180 사이여야 합니다.');
  }

  return parsed;
}

export function parseCoordinatesFromRequest(request: Request): Coordinates {
  return {
    lat: parseCoordinate(request.query.lat, 'lat'),
    lng: parseCoordinate(request.query.lng, 'lng'),
  };
}

export function parsePersonaFromRequest(request: Request): Persona {
  if (request.query.persona === 'elder' || request.query.persona === 'guardian') {
    return request.query.persona;
  }

  return 'default';
}

export function parsePaceProfileFromRequest(request: Request): PaceProfile {
  if (request.query.paceProfile === 'slow') {
    return 'slow';
  }

  return 'default';
}
