import type { Request } from 'express';
import { env } from '../config/env.js';
import type { ServiceName } from '../types/internal.js';

export type StdgOverride = {
  signalStdgCd: string;
  busStdgCd: string;
  mobilityStdgCd: string;
};

export type SummaryScope = {
  includeSignals: boolean;
  includeBuses: boolean;
  includeMobility: boolean;
  enabledServices: ServiceName[];
};

function sanitizeStdgCd(value: unknown, fallback: string) {
  if (typeof value === 'string' && /^\d{10}$/.test(value)) {
    return value;
  }

  return fallback;
}

export function getStdgOverridesFromRequest(request: Request): StdgOverride {
  return {
    signalStdgCd: sanitizeStdgCd(request.query.signalStdgCd, env.publicData.signalStdgCd),
    busStdgCd: sanitizeStdgCd(request.query.busStdgCd, env.publicData.busStdgCd),
    mobilityStdgCd: sanitizeStdgCd(request.query.mobilityStdgCd, env.publicData.mobilityStdgCd),
  };
}

function parseBooleanFlag(value: unknown, fallback: boolean) {
  if (typeof value !== 'string') {
    return fallback;
  }

  if (value === 'true' || value === '1') {
    return true;
  }

  if (value === 'false' || value === '0') {
    return false;
  }

  return fallback;
}

export function getSummaryScopeFromRequest(request: Request): SummaryScope {
  const includeSignals = parseBooleanFlag(request.query.includeSignals, true);
  const includeBuses = parseBooleanFlag(request.query.includeBuses, true);
  const includeMobility = parseBooleanFlag(request.query.includeMobility, true);
  const enabledServices: ServiceName[] = [];

  if (includeSignals) {
    enabledServices.push('signals');
  }

  if (includeBuses) {
    enabledServices.push('buses');
  }

  if (includeMobility) {
    enabledServices.push('mobility');
  }

  return {
    includeSignals,
    includeBuses,
    includeMobility,
    enabledServices,
  };
}
