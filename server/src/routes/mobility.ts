import { Router } from 'express';
import { getNearbyMobilitySupport } from '../services/mobilityService.js';
import { parseCoordinatesFromRequest } from '../utils/request.js';
import { buildResponse } from '../utils/response.js';
import { getStdgOverridesFromRequest } from '../utils/stdg.js';

export const mobilityRouter = Router();

mobilityRouter.get('/nearby', async (request, response) => {
  const location = parseCoordinatesFromRequest(request);
  const stdg = getStdgOverridesFromRequest(request);
  const mobilityCenters = await getNearbyMobilitySupport(location, { stdgCd: stdg.mobilityStdgCd });

  response.json(
    buildResponse({
      location,
      dataContext: { mobilityStdgCd: stdg.mobilityStdgCd, source: mobilityCenters.source },
      mobilityCenters: mobilityCenters.items,
    }),
  );
});
