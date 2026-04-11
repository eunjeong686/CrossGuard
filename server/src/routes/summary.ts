import { Router } from 'express';
import { getLocationSummary } from '../services/summaryService.js';
import { parseCoordinatesFromRequest, parsePaceProfileFromRequest, parsePersonaFromRequest } from '../utils/request.js';
import { buildResponse } from '../utils/response.js';
import { getStdgOverridesFromRequest, getSummaryScopeFromRequest } from '../utils/stdg.js';

export const summaryRouter = Router();

summaryRouter.get('/summary', async (request, response) => {
  const location = parseCoordinatesFromRequest(request);
  const stdg = getStdgOverridesFromRequest(request);
  const scope = getSummaryScopeFromRequest(request);
  const persona = parsePersonaFromRequest(request);
  const paceProfile = parsePaceProfileFromRequest(request);

  response.json(buildResponse(await getLocationSummary(location, stdg, scope, { persona, paceProfile })));
});
