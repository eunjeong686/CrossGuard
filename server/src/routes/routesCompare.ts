import { Router } from 'express';
import { getRouteComparison } from '../services/routesCompareService.js';
import type { Coordinates } from '../types/internal.js';
import { HttpError } from '../utils/errors.js';
import { buildResponse } from '../utils/response.js';
import { getStdgOverridesFromRequest } from '../utils/stdg.js';

export const routesCompareRouter = Router();

function parseCoordinate(value: unknown, name: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, `${name} 쿼리 파라미터가 필요합니다.`);
  }

  return parsed;
}

function parseCompareCoordinates(query: Record<string, unknown>) {
  const origin: Coordinates = {
    lat: parseCoordinate(query.originLat, 'originLat'),
    lng: parseCoordinate(query.originLng, 'originLng'),
  };
  const destination: Coordinates = {
    lat: parseCoordinate(query.destLat, 'destLat'),
    lng: parseCoordinate(query.destLng, 'destLng'),
  };

  return { origin, destination };
}

routesCompareRouter.get('/compare', async (request, response) => {
  const { origin, destination } = parseCompareCoordinates(request.query as Record<string, unknown>);
  const stdg = getStdgOverridesFromRequest(request);

  response.json(buildResponse(await getRouteComparison(origin, destination, stdg)));
});
