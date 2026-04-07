import { Router } from 'express';
import { buildResponse } from '../utils/response.js';

export const healthRouter = Router();

healthRouter.get('/', (_request, response) => {
  response.json(
    buildResponse({
      status: 'ok',
      service: 'SafeCross Mobility API',
    }),
  );
});
