import { Router } from 'express';
import { getNearbyBuses } from '../services/busService.js';
import { parseCoordinatesFromRequest } from '../utils/request.js';
import { buildResponse } from '../utils/response.js';
import { getStdgOverridesFromRequest } from '../utils/stdg.js';

export const busesRouter = Router();

busesRouter.get('/nearby', async (request, response) => {
  const location = parseCoordinatesFromRequest(request);
  const stdg = getStdgOverridesFromRequest(request);
  const buses = await getNearbyBuses(location, { stdgCd: stdg.busStdgCd });

  response.json(
    buildResponse({
      location,
      dataContext: { busStdgCd: stdg.busStdgCd, source: buses.source },
      buses: buses.items,
      advisoryMessage: '정확한 ETA 대신 여유 분류형으로 제공합니다.',
    }),
  );
});
