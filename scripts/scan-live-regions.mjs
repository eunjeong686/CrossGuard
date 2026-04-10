#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DEFAULT_REGION_URL = 'https://kr-legal-dong.github.io/data/gu.json';
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_DELAY_MS = 120;
const DEFAULT_PAGE_SIZE = 10;

const FALLBACK_REGIONS = [
  { stdgCd: '1114000000', name: '서울특별시 중구', lat: null, lng: null },
  { stdgCd: '3100000000', name: '울산광역시', lat: null, lng: null },
  { stdgCd: '4311000000', name: '충청북도 청주시', lat: null, lng: null },
  { stdgCd: '4686000000', name: '전라남도 함평군', lat: null, lng: null },
];

const SAMPLE_REGIONS = [
  { stdgCd: '1100000000', name: '서울특별시', lat: null, lng: null },
  { stdgCd: '2600000000', name: '부산광역시', lat: null, lng: null },
  { stdgCd: '2700000000', name: '대구광역시', lat: null, lng: null },
  { stdgCd: '2800000000', name: '인천광역시', lat: null, lng: null },
  { stdgCd: '2900000000', name: '광주광역시', lat: null, lng: null },
  { stdgCd: '3000000000', name: '대전광역시', lat: null, lng: null },
  { stdgCd: '3100000000', name: '울산광역시', lat: null, lng: null },
  { stdgCd: '3600000000', name: '세종특별자치시', lat: null, lng: null },
  { stdgCd: '4100000000', name: '경기도', lat: null, lng: null },
  { stdgCd: '4300000000', name: '충청북도', lat: null, lng: null },
  { stdgCd: '4311000000', name: '충청북도 청주시', lat: null, lng: null },
  { stdgCd: '4600000000', name: '전라남도', lat: null, lng: null },
  { stdgCd: '4686000000', name: '전라남도 함평군', lat: null, lng: null },
  { stdgCd: '5000000000', name: '제주특별자치도', lat: null, lng: null },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    all: false,
    limit: null,
    concurrency: DEFAULT_CONCURRENCY,
    delayMs: DEFAULT_DELAY_MS,
    timeoutMs: null,
    regionsFile: null,
    regionUrl: DEFAULT_REGION_URL,
    pageSize: DEFAULT_PAGE_SIZE,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--all') {
      options.all = true;
    } else if (arg === '--limit') {
      options.limit = Number(next);
      index += 1;
    } else if (arg === '--concurrency') {
      options.concurrency = Number(next);
      index += 1;
    } else if (arg === '--delay-ms') {
      options.delayMs = Number(next);
      index += 1;
    } else if (arg === '--timeout-ms') {
      options.timeoutMs = Number(next);
      index += 1;
    } else if (arg === '--regions') {
      options.regionsFile = next;
      index += 1;
    } else if (arg === '--region-url') {
      options.regionUrl = next;
      index += 1;
    } else if (arg === '--page-size') {
      options.pageSize = Number(next);
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (!options.all && options.limit === null) {
    options.limit = 5;
  }

  return {
    ...options,
    concurrency: Math.max(1, Number.isFinite(options.concurrency) ? options.concurrency : DEFAULT_CONCURRENCY),
    delayMs: Math.max(0, Number.isFinite(options.delayMs) ? options.delayMs : DEFAULT_DELAY_MS),
    pageSize: Math.max(1, Number.isFinite(options.pageSize) ? options.pageSize : DEFAULT_PAGE_SIZE),
  };
}

function printHelp() {
  console.log(`
Usage:
  node scripts/scan-live-regions.mjs --limit 5
  node scripts/scan-live-regions.mjs --all --concurrency 2 --delay-ms 120

Options:
  --all                 전국 시군구 목록 전체 스캔
  --limit <n>           앞에서부터 n개만 스캔
  --concurrency <n>     동시 스캔 지역 수
  --delay-ms <n>        지역 스캔 작업 사이 지연
  --timeout-ms <n>      API 요청 타임아웃
  --regions <path>      { stdgCd, name, lat?, lng? }[] JSON 파일 사용
  --region-url <url>    법정동 시군구 JSON URL
  --page-size <n>       existence check 요청당 numOfRows
`);
}

function readEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const [key, ...rest] = line.split('=');
        return [key.trim(), rest.join('=').trim().replace(/^["']|["']$/g, '')];
      }),
  );
}

function loadEnv() {
  const rootEnv = readEnvFile(resolve('.env'));
  const serverEnv = readEnvFile(resolve('server/.env'));

  return {
    ...rootEnv,
    ...serverEnv,
    ...process.env,
  };
}

function assertConfig(env, options) {
  const config = {
    serviceKey: env.PUBLIC_DATA_SERVICE_KEY,
    signalApiUrl: env.SIGNAL_API_URL ?? 'https://apis.data.go.kr/B551982/rti',
    busApiUrl: env.BUS_API_URL ?? 'https://apis.data.go.kr/B551982/rte',
    mobilityApiUrl: env.MOBILITY_API_URL ?? 'https://apis.data.go.kr/B551982/tsdo_v2',
    timeoutMs: options.timeoutMs ?? Number(env.PUBLIC_DATA_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  };

  if (!config.serviceKey) {
    throw new Error('PUBLIC_DATA_SERVICE_KEY가 없습니다. server/.env 또는 환경변수에 인증키를 설정해 주세요.');
  }

  return config;
}

async function fetchJson(url, { timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}: ${text.slice(0, 120)}`);
    }

    return JSON.parse(text);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function buildApiUrl(baseUrl, endpoint, query, serviceKey) {
  const url = new URL(`${baseUrl.replace(/\/$/, '')}${endpoint}`);
  url.searchParams.set('serviceKey', serviceKey);

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

function getHeader(response) {
  return response?.header ?? {};
}

function getItems(response) {
  const rawItems = response?.body?.items?.item ?? response?.body?.item;

  if (!rawItems) {
    return [];
  }

  return Array.isArray(rawItems) ? rawItems : [rawItems];
}

function resultCodeOk(response) {
  const code = getHeader(response).resultCode;
  return !code || code === 'K0';
}

function getResultMessage(response) {
  const header = getHeader(response);
  return [header.resultCode, header.resultMsg].filter(Boolean).join(' ');
}

function hasNumber(value) {
  if (typeof value === 'string' && value.trim() === '') {
    return false;
  }

  if (value === null || value === undefined) {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed);
}

function hasString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

async function fetchEndpoint({ config, baseUrl, endpoint, stdgCd, label, pageSize }) {
  const url = buildApiUrl(
    baseUrl,
    endpoint,
    {
      type: 'JSON',
      stdgCd,
      pageNo: 1,
      numOfRows: pageSize,
    },
    config.serviceKey,
  );
  const response = await fetchJson(url, { timeoutMs: config.timeoutMs });

  if (!resultCodeOk(response)) {
    return {
      ok: false,
      label,
      endpoint,
      count: 0,
      reason: getResultMessage(response) || 'API_ERROR',
      sample: null,
    };
  }

  const items = getItems(response);

  return {
    ok: items.length > 0,
    label,
    endpoint,
    count: items.length,
    reason: items.length > 0 ? 'OK' : 'NO_ITEMS',
    sample: items[0] ?? null,
    items,
  };
}

function endpointError({ label, endpoint, error }) {
  return {
    ok: false,
    label,
    endpoint,
    count: 0,
    reason: error instanceof Error ? error.message : String(error),
    sample: null,
    items: [],
  };
}

async function safeFetchEndpoint(args) {
  try {
    return await fetchEndpoint(args);
  } catch (error) {
    return endpointError({ label: args.label, endpoint: args.endpoint, error });
  }
}

function countValidSignals(mapResult, directionResult) {
  const mapItems = getSampleArray(mapResult);
  const directionItems = getSampleArray(directionResult);
  const validMapCount = mapItems.filter(
    (item) => hasString(item?.crsrdId) && hasNumber(item?.mapCtptIntLat) && hasNumber(item?.mapCtptIntLot),
  ).length;
  const validDirectionCount = directionItems.filter((item) => hasString(item?.crsrdId)).length;

  return Math.min(validMapCount, validDirectionCount);
}

function countValidBuses(routeResult, stopResult, locationResult) {
  const routeItems = getSampleArray(routeResult);
  const stopItems = getSampleArray(stopResult);
  const locationItems = getSampleArray(locationResult);
  const validRouteCount = routeItems.filter((item) => hasString(item?.rteId)).length;
  const validStopCount = stopItems.filter(
    (item) => hasString(item?.rteId) && hasNumber(item?.bstaLat) && hasNumber(item?.bstaLot),
  ).length;
  const validLocationCount = locationItems.filter(
    (item) => hasString(item?.rteId) && hasNumber(item?.lat) && hasNumber(item?.lot),
  ).length;

  return Math.min(validRouteCount, validStopCount, validLocationCount);
}

function countValidMobility(centerResult) {
  return getSampleArray(centerResult).filter(
    (item) => hasString(item?.cntrId) && hasNumber(item?.lat) && hasNumber(item?.lot),
  ).length;
}

function getSampleArray(result) {
  if (Array.isArray(result.items)) {
    return result.items;
  }

  const sample = result.sample;

  if (!sample) {
    return [];
  }

  return Array.isArray(sample) ? sample : [sample];
}

async function scanServiceEndpoints(region, config, options) {
  const common = { config, stdgCd: region.stdgCd, pageSize: options.pageSize };
  const [signalMap, signalDirection, busRoutes, busStops, busLocations, mobilityCenters, mobilityUse] =
    await Promise.all([
      safeFetchEndpoint({
        ...common,
        baseUrl: config.signalApiUrl,
        endpoint: '/crsrd_map_info',
        label: '교차로 맵 정보',
      }),
      safeFetchEndpoint({
        ...common,
        baseUrl: config.signalApiUrl,
        endpoint: '/tl_drct_info',
        label: '신호제어기 신호잔여시간 정보',
      }),
      safeFetchEndpoint({
        ...common,
        baseUrl: config.busApiUrl,
        endpoint: '/mst_info',
        label: '노선 기본 정보',
      }),
      safeFetchEndpoint({
        ...common,
        baseUrl: config.busApiUrl,
        endpoint: '/ps_info',
        label: '노선 경유지 정보',
      }),
      safeFetchEndpoint({
        ...common,
        baseUrl: config.busApiUrl,
        endpoint: '/rtm_loc_info',
        label: '버스 실시간 위치정보',
      }),
      safeFetchEndpoint({
        ...common,
        baseUrl: config.mobilityApiUrl,
        endpoint: '/center_info_v2',
        label: '교통약자이동지원센터 현황정보',
      }),
      safeFetchEndpoint({
        ...common,
        baseUrl: config.mobilityApiUrl,
        endpoint: '/info_vehicle_use_v2',
        label: '교통약자 택시 차량 이용가능 정보',
      }),
    ]);

  const signalValidCount = signalMap.ok && signalDirection.ok ? countValidSignals(signalMap, signalDirection) : 0;
  const busValidCount = busRoutes.ok && busStops.ok && busLocations.ok
    ? countValidBuses(busRoutes, busStops, busLocations)
    : 0;
  const mobilityValidCount = mobilityCenters.ok ? countValidMobility(mobilityCenters) : 0;

  const services = {
    signals: {
      live: signalValidCount > 0,
      validCount: signalValidCount,
      endpoints: [signalMap, signalDirection],
    },
    buses: {
      live: busValidCount > 0,
      validCount: busValidCount,
      endpoints: [busRoutes, busStops, busLocations],
    },
    mobility: {
      live: mobilityValidCount > 0,
      validCount: mobilityValidCount,
      endpoints: [mobilityCenters, mobilityUse],
    },
  };

  return {
    ...region,
    category: classify(services),
    services,
  };
}

function classify(services) {
  const signals = services.signals.live;
  const buses = services.buses.live;
  const mobility = services.mobility.live;
  const liveCount = [signals, buses, mobility].filter(Boolean).length;

  if (signals && buses && mobility) {
    return '3종 모두 가능';
  }

  if (signals && buses && !mobility) {
    return '신호+버스';
  }

  if (mobility && !signals && !buses) {
    return '이동지원';
  }

  if (liveCount === 0) {
    return '응답 없음/오류';
  }

  return '부분 가능';
}

async function loadRegions(options, config) {
  if (options.regionsFile) {
    const filePath = resolve(options.regionsFile);
    const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    return normalizeRegions(parsed);
  }

  if (!options.all && options.limit !== null && options.limit <= SAMPLE_REGIONS.length) {
    return SAMPLE_REGIONS.slice(0, options.limit);
  }

  try {
    const data = await fetchJson(options.regionUrl, { timeoutMs: config.timeoutMs });
    return mergeRegions(SAMPLE_REGIONS, normalizeRegions(data));
  } catch (error) {
    console.warn(`시군구 코드 목록을 불러오지 못해 내장 샘플을 사용합니다: ${error instanceof Error ? error.message : String(error)}`);
    return FALLBACK_REGIONS;
  }
}

function mergeRegions(...groups) {
  const deduped = new Map();

  for (const group of groups) {
    for (const region of group) {
      deduped.set(region.stdgCd, region);
    }
  }

  return [...deduped.values()].sort((left, right) => left.stdgCd.localeCompare(right.stdgCd));
}

function normalizeRegions(data) {
  const regions = data
    .filter((item) => item?.active !== false)
    .map((item) => ({
      stdgCd: item.stdgCd ?? item.code,
      name: item.name && item.siName ? item.fullName ?? `${item.siName} ${item.name}` : (item.fullName ?? item.name),
      lat: item.lat ?? null,
      lng: item.lng ?? null,
    }))
    .filter((item) => /^\d{10}$/.test(item.stdgCd) && item.name);

  const deduped = new Map();
  for (const region of regions) {
    deduped.set(region.stdgCd, region);
  }

  return [...deduped.values()].sort((left, right) => left.stdgCd.localeCompare(right.stdgCd));
}

async function delay(ms) {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}

async function runPool(regions, worker) {
  const results = [];
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < regions.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(regions[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(regions.length, worker.concurrency ?? 1) }, () => runWorker()),
  );

  return results;
}

function summarize(results) {
  const categories = {
    '3종 모두 가능': [],
    '신호+버스': [],
    이동지원: [],
    '부분 가능': [],
    '응답 없음/오류': [],
  };

  for (const result of results) {
    categories[result.category].push(result);
  }

  const rankedAllLive = [...categories['3종 모두 가능']].sort(rankByDataCount);

  return {
    generatedAt: new Date().toISOString(),
    total: results.length,
    counts: Object.fromEntries(
      Object.entries(categories).map(([category, items]) => [category, items.length]),
    ),
    topCandidates: rankedAllLive.slice(0, 10),
    categories,
  };
}

function rankByDataCount(left, right) {
  const leftScore =
    left.services.signals.validCount + left.services.buses.validCount + left.services.mobility.validCount;
  const rightScore =
    right.services.signals.validCount + right.services.buses.validCount + right.services.mobility.validCount;

  return rightScore - leftScore;
}

function toMarkdown(summary) {
  const lines = [
    '# 전국 시군구 실데이터 스캔 결과',
    '',
    `- 생성 시각: ${summary.generatedAt}`,
    `- 스캔 지역 수: ${summary.total}`,
    '',
    '## 분류별 집계',
    '',
    '| 분류 | 개수 |',
    '| --- | ---: |',
    ...Object.entries(summary.counts).map(([category, count]) => `| ${category} | ${count} |`),
    '',
    '## 3종 모두 가능 후보',
    '',
    ...formatResultList(summary.categories['3종 모두 가능']),
    '',
    '## 신호+버스 후보',
    '',
    ...formatResultList(summary.categories['신호+버스']),
    '',
    '## 이동지원 후보',
    '',
    ...formatResultList(summary.categories.이동지원),
    '',
    '## 부분 가능 후보',
    '',
    ...formatResultList(summary.categories['부분 가능']),
  ];

  return `${lines.join('\n')}\n`;
}

function formatResultList(items) {
  if (items.length === 0) {
    return ['- 없음'];
  }

  return items.slice(0, 30).map((item) => {
    const counts = `신호 ${item.services.signals.validCount}, 버스 ${item.services.buses.validCount}, 이동지원 ${item.services.mobility.validCount}`;
    return `- ${item.name} (${item.stdgCd}) - ${counts}`;
  });
}

function printSummary(summary, outputPaths) {
  console.log('\n=== 전국 시군구 실데이터 스캔 요약 ===');
  console.table(summary.counts);

  if (summary.topCandidates.length > 0) {
    console.log('\n3종 모두 가능 상위 후보');
    console.table(
      summary.topCandidates.map((item) => ({
        name: item.name,
        stdgCd: item.stdgCd,
        signals: item.services.signals.validCount,
        buses: item.services.buses.validCount,
        mobility: item.services.mobility.validCount,
      })),
    );
  } else {
    console.log('\n3종 모두 가능 지역을 찾지 못했습니다.');
  }

  console.log(`\nJSON: ${outputPaths.json}`);
  console.log(`MD:   ${outputPaths.md}`);
}

function timestampForFile() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
  ].join('');
}

async function writeOutputs(summary) {
  const outputDir = resolve('tmp');
  await mkdir(outputDir, { recursive: true });

  const stamp = timestampForFile();
  const jsonPath = join(outputDir, `live-region-scan-${stamp}.json`);
  const mdPath = join(outputDir, `live-region-scan-${stamp}.md`);

  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8'),
    writeFile(mdPath, toMarkdown(summary), 'utf8'),
  ]);

  return { json: jsonPath, md: mdPath };
}

async function main() {
  const options = parseArgs();
  const env = loadEnv();
  const config = assertConfig(env, options);
  const loadedRegions = await loadRegions(options, config);
  const regions = options.all ? loadedRegions : loadedRegions.slice(0, options.limit ?? loadedRegions.length);

  console.log(`스캔 대상: ${regions.length}개 지역`);
  console.log(`동시성: ${options.concurrency}, 지연: ${options.delayMs}ms, timeout: ${config.timeoutMs}ms`);

  const worker = async (region, index) => {
    await delay(index * options.delayMs);
    const result = await scanServiceEndpoints(region, config, options);
    console.log(
      `[${String(index + 1).padStart(3, '0')}/${regions.length}] ${result.category} - ${result.name} (${result.stdgCd})`,
    );
    return result;
  };
  worker.concurrency = options.concurrency;

  const results = await runPool(regions, worker);
  const summary = summarize(results);
  const outputPaths = await writeOutputs(summary);
  printSummary(summary, outputPaths);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
