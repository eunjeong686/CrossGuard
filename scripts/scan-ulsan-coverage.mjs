#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const SAMPLE_POINTS = [
  { id: 'ulsan-cityhall', label: '울산 시청', lat: 35.5384, lng: 129.3114 },
  { id: 'samsan', label: '삼산동', lat: 35.5389, lng: 129.3356 },
  { id: 'taehwa', label: '태화강역', lat: 35.5397, lng: 129.3535 },
  { id: 'seongnam', label: '성남동', lat: 35.5547, lng: 129.3206 },
  { id: 'u-jeong', label: '우정혁신도시', lat: 35.5751, lng: 129.3135 },
  { id: 'junha', label: '전하동', lat: 35.507, lng: 129.427 },
  { id: 'bangeo', label: '방어동', lat: 35.4815, lng: 129.4315 },
  { id: 'hogae', label: '호계동', lat: 35.626, lng: 129.3564 },
  { id: 'hwajeong', label: '화정동', lat: 35.6402, lng: 129.3656 },
  { id: 'onsan', label: '온산읍', lat: 35.4185, lng: 129.3167 },
  { id: 'eonyang', label: '언양읍', lat: 35.5636, lng: 129.1265 },
  { id: 'beomseo', label: '범서읍', lat: 35.5695, lng: 129.2274 },
  { id: 'yaksa', label: '약사동', lat: 35.5734, lng: 129.3386 },
  { id: 'munsu', label: '문수월드컵경기장', lat: 35.5395, lng: 129.2563 },
  { id: 'myeongchon', label: '명촌동', lat: 35.5662, lng: 129.3551 },
  { id: 'sinjeong', label: '신정동', lat: 35.5315, lng: 129.3086 },
  { id: 'dalcheon', label: '달천동', lat: 35.6544, lng: 129.3592 },
  { id: 'dongcheon', label: '동천체육관', lat: 35.5692, lng: 129.3485 },
  { id: 'ilsan', label: '일산해수욕장 인근', lat: 35.4919, lng: 129.4335 },
  { id: 'samnam', label: '삼남읍', lat: 35.5434, lng: 129.1565 },
];

function getArg(name, fallback) {
  const pair = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return pair ? pair.split('=').slice(1).join('=') : fallback;
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSummary(baseUrl, point, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const params = new URLSearchParams({
    lat: String(point.lat),
    lng: String(point.lng),
    signalStdgCd: '3100000000',
    busStdgCd: '3100000000',
    includeSignals: 'true',
    includeBuses: 'true',
    includeMobility: 'false',
    persona: 'default',
    paceProfile: 'default',
  });
  try {
    const response = await fetch(`${baseUrl}/api/location/summary?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    const json = await response.json();
    return {
      ok: true,
      signals: json?.data?.dataContext?.serviceSources?.signals ?? 'disabled',
      buses: json?.data?.dataContext?.serviceSources?.buses ?? 'disabled',
      signalCount: json?.data?.signals?.length ?? 0,
      busCount: json?.data?.buses?.length ?? 0,
    };
  } catch (error) {
    return {
      ok: false,
      status: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'error',
    };
  } finally {
    clearTimeout(timer);
  }
}

function timestampTag() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

async function main() {
  const baseUrl = getArg('base-url', process.env.BASE_URL ?? 'http://localhost:8787').replace(/\/$/, '');
  const rounds = toNumber(getArg('rounds', '2'), 2);
  const delayMs = toNumber(getArg('delay-ms', '150'), 150);
  const timeoutMs = toNumber(getArg('timeout-ms', '7000'), 7000);
  const threshold = toNumber(getArg('threshold', '70'), 70);

  const perPoint = SAMPLE_POINTS.map((point) => ({
    ...point,
    liveSuccess: 0,
    totalChecks: 0,
    signalCount: 0,
    busCount: 0,
    failures: 0,
  }));

  for (let round = 0; round < rounds; round += 1) {
    for (const point of perPoint) {
      const result = await fetchSummary(baseUrl, point, timeoutMs);
      point.totalChecks += 1;

      if (!result.ok) {
        point.failures += 1;
      } else {
        point.signalCount += result.signalCount;
        point.busCount += result.busCount;
        if (result.signals === 'live' && result.buses === 'live') {
          point.liveSuccess += 1;
        }
      }

      await delay(delayMs);
    }
  }

  const totalChecks = perPoint.reduce((sum, point) => sum + point.totalChecks, 0);
  const liveCount = perPoint.reduce((sum, point) => sum + point.liveSuccess, 0);
  const coverageScore = Number(((liveCount / Math.max(totalChecks, 1)) * 100).toFixed(1));
  const selectionPolicy = coverageScore >= threshold ? 'free' : 'preset';
  const recommendedPlaces = perPoint
    .slice()
    .sort((left, right) => {
      if (left.liveSuccess !== right.liveSuccess) {
        return right.liveSuccess - left.liveSuccess;
      }

      return (right.signalCount + right.busCount) - (left.signalCount + left.busCount);
    })
    .slice(0, 3)
    .map((point) => ({
      id: point.id,
      label: point.label,
      description: '울산 신호·버스 검증 위치',
      lat: point.lat,
      lng: point.lng,
      liveSuccess: point.liveSuccess,
      totalChecks: point.totalChecks,
    }));

  const report = {
    createdAt: new Date().toISOString(),
    baseUrl,
    rounds,
    threshold,
    sampleCount: perPoint.length,
    totalChecks,
    liveCount,
    coverageScore,
    selectionPolicy,
    recommendedPlaces,
    unstablePoints: perPoint
      .filter((point) => point.liveSuccess < point.totalChecks)
      .map((point) => ({
        id: point.id,
        label: point.label,
        lat: point.lat,
        lng: point.lng,
        liveSuccess: point.liveSuccess,
        totalChecks: point.totalChecks,
        failures: point.failures,
      })),
    points: perPoint,
  };

  const tag = timestampTag();
  const tmpDir = path.resolve(process.cwd(), 'tmp');
  await fs.mkdir(tmpDir, { recursive: true });
  const outputPath = path.join(tmpDir, `ulsan-coverage-scan-${tag}.json`);
  const latestPath = path.join(tmpDir, 'ulsan-coverage-scan-latest.json');
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(latestPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    coverageScore,
    selectionPolicy,
    sampleCount: perPoint.length,
    rounds,
    outputPath,
    latestPath,
  }, null, 2));
}

main().catch((error) => {
  console.error('[scan-ulsan-coverage] failed', error);
  process.exit(1);
});
