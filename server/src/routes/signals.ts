import { Router } from 'express';
import { getNearbySignals } from '../services/signalService.js';
import { parseCoordinatesFromRequest } from '../utils/request.js';
import { buildResponse } from '../utils/response.js';
import { getStdgOverridesFromRequest } from '../utils/stdg.js';

export const signalsRouter = Router();

signalsRouter.get('/nearby', async (request, response) => {
  const location = parseCoordinatesFromRequest(request);
  const stdg = getStdgOverridesFromRequest(request);
  const signals = await getNearbySignals(location, { stdgCd: stdg.signalStdgCd });

  response.json(
    buildResponse({
      location,
      dataContext: { signalStdgCd: stdg.signalStdgCd, source: signals.source },
      signals: signals.items,
      safetyMessage: '현장 신호를 반드시 우선 확인하세요.',
    }),
  );
});
