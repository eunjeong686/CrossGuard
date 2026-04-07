import cors from 'cors';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { busesRouter } from './routes/buses.js';
import { healthRouter } from './routes/health.js';
import { mobilityRouter } from './routes/mobility.js';
import { routesCompareRouter } from './routes/routesCompare.js';
import { signalsRouter } from './routes/signals.js';
import { summaryRouter } from './routes/summary.js';
import type { ServiceStatus } from './types/internal.js';
import { getErrorMessage, HttpError } from './utils/errors.js';
import { buildResponse } from './utils/response.js';

const app = express();
const currentDir = dirname(fileURLToPath(import.meta.url));
const frontendDistPath = resolve(currentDir, '../../frontend/dist');
const clientOrigins = env.clientOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || clientOrigins.length === 0 || clientOrigins.includes('*') || clientOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new HttpError(403, '허용되지 않은 출처입니다.'));
    },
  }),
);
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/location', summaryRouter);
app.use('/api/signals', signalsRouter);
app.use('/api/buses', busesRouter);
app.use('/api/mobility-support', mobilityRouter);
app.use('/api/routes', routesCompareRouter);
app.get('/api/meta/status', (_request, response) => {
  const services: ServiceStatus[] = [
    {
      name: 'signals',
      mode: env.publicData.mode,
      datasetUrl: env.publicData.docs.signal,
      stdgCd: env.publicData.signalStdgCd,
      endpointConfigured: Boolean(env.publicData.signalApiUrl),
      apiKeyConfigured: Boolean(env.publicData.serviceKey),
      liveAdapterReady: true,
      fallbackAvailable: true,
    },
    {
      name: 'buses',
      mode: env.publicData.mode,
      datasetUrl: env.publicData.docs.bus,
      stdgCd: env.publicData.busStdgCd,
      endpointConfigured: Boolean(env.publicData.busApiUrl),
      apiKeyConfigured: Boolean(env.publicData.serviceKey),
      liveAdapterReady: true,
      fallbackAvailable: true,
    },
    {
      name: 'mobility',
      mode: env.publicData.mode,
      datasetUrl: env.publicData.docs.mobility,
      stdgCd: env.publicData.mobilityStdgCd,
      endpointConfigured: Boolean(env.publicData.mobilityApiUrl),
      apiKeyConfigured: Boolean(env.publicData.serviceKey),
      liveAdapterReady: true,
      fallbackAvailable: true,
    },
  ];

  response.json(
    buildResponse({
      dataMode: env.publicData.mode,
      timeoutMs: env.publicData.timeoutMs,
      services,
    }),
  );
});
app.get('/api/meta/disclaimer', (_request, response) => {
  response.json(
    buildResponse({
      serviceMessage: 'SafeCross Mobility는 참고용 이동 보조 서비스입니다.',
      safetyMessage: '현장 신호와 실제 주변 상황을 반드시 우선 확인하세요.',
      refreshPolicy: {
        signals: '10-15초',
        buses: '10-15초',
        mobility: '20-30초',
      },
    }),
  );
});

if (existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));

  app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => {
    response.sendFile(resolve(frontendDistPath, 'index.html'));
  });
}

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  const statusCode = error instanceof HttpError ? error.statusCode : 500;

  response.status(statusCode).json({
    success: false,
    timestamp: new Date().toISOString(),
    dataSource: 'internal',
    message: getErrorMessage(error),
    data: null,
  });
});

app.listen(env.port, () => {
  console.log(`SafeCross Mobility server listening on http://localhost:${env.port}`);
});
