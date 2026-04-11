export type Coordinates = {
  lat: number;
  lng: number;
};

export type ApiEnvelope<T> = {
  success: boolean;
  timestamp: string;
  dataSource: string;
  message: string | null;
  data: T;
};

export type ServiceName = 'signals' | 'buses' | 'mobility';
export type DataOrigin = 'live' | 'mock' | 'disabled';
export type Persona = 'default' | 'elder' | 'guardian';
export type PaceProfile = 'default' | 'slow';

export type ServiceResult<T> = {
  items: T[];
  source: DataOrigin;
};

export type SignalData = Coordinates & {
  intersectionId: string;
  intersectionName: string;
  pedestrianSignalStatus: 'GREEN' | 'RED' | 'UNKNOWN';
  pedestrianSignalStatusLabel: string;
  remainingSeconds: number | null;
  direction: string;
  speedLimit: number | null;
  laneWidth: number | null;
  intersectionComplexity: '단순' | '주의' | '복잡';
  collectedAt: string;
  advisoryOnly: true;
};

export type BusData = Coordinates & {
  routeId: string;
  routeNo: string;
  routeType: string;
  routeOrigin: string | null;
  routeTerminus: string | null;
  vehicleNo: string;
  speed: number | null;
  heading: number | null;
  lastUpdatedAt: string;
  nearStopName: string;
  stopSequence: number | null;
  etaCategory: '여유 있음' | '주의 필요' | '촉박' | '정보 부족';
  stopDistanceMeters: number;
  stopAccessStatus: '편함' | '보통' | '주의';
};

export type MobilityData = Coordinates & {
  centerId: string;
  centerName: string;
  availableVehicleCount: number | null;
  operatingVehicleCount: number | null;
  serviceStatus: '이용 가능' | '확인 필요' | '정보 없음';
  lastUpdatedAt: string;
};

export type SummaryData = {
  location: Coordinates;
  persona: Persona;
  paceProfile: PaceProfile;
  dataContext: {
    signalStdgCd: string;
    busStdgCd: string;
    mobilityStdgCd: string;
    enabledServices: ServiceName[];
    serviceSources: Record<ServiceName, DataOrigin>;
  };
  lastUpdatedAt: string;
  movementBurden: {
    score: number;
    label: '낮음' | '보통' | '높음';
    reason: string;
    whyNow: string;
    confidenceLabel: '높음' | '보통' | '낮음';
    freshnessMinutes: number | null;
    factors: string[];
    topConcerns: string[];
    scoreBreakdown: Array<{
      id: 'signal' | 'bus' | 'intersection' | 'walkAccess' | 'freshness';
      label: string;
      score: number;
      reason: string;
    }>;
    assistiveInsight: {
      message: string;
      reason: string;
      safetyReminder: string;
      engine: 'local-rules';
    };
  };
  topSignal: SignalData | null;
  topBus: BusData | null;
  topMobility: MobilityData | null;
  intersectionContext: {
    complexity: '단순' | '주의' | '복잡';
    speedLimit: number | null;
    laneWidth: number | null;
    note: string;
  } | null;
  walkContext: {
    source: 'osm' | 'derived';
    accessibilityLabel: '편함' | '보통' | '주의';
    note: string;
    stepsNearby: boolean;
    shelterNearby: boolean;
    crossingCount: number;
    busStopCount: number;
    signalCount: number;
  };
  signals: SignalData[];
  buses: BusData[];
  mobilityCenters: MobilityData[];
  disclaimer: string;
};

export type ServiceStatus = {
  name: ServiceName;
  mode: 'mock' | 'hybrid' | 'live';
  datasetUrl: string;
  stdgCd: string;
  endpointConfigured: boolean;
  apiKeyConfigured: boolean;
  liveAdapterReady: boolean;
  fallbackAvailable: boolean;
};

export type UlsanPresetPlace = {
  id: string;
  label: string;
  description: string;
  lat: number;
  lng: number;
};

export type UlsanCoverageSnapshot = {
  threshold: number;
  rounds: number;
  sampleCount: number;
  liveCount: number;
  coverageScore: number;
  selectionPolicy: 'free' | 'preset';
  updatedAt: string;
  recommendedPlaces: UlsanPresetPlace[];
  unstablePoints: Array<{
    id: string;
    label: string;
    lat: number;
    lng: number;
    liveSuccess: number;
    totalChecks: number;
  }>;
};

export type RouteCompareOption = {
  id: 'bus-priority' | 'signal-priority';
  label: string;
  burden: '낮음' | '보통' | '높음';
  score: number;
  note: string;
  recommended: boolean;
  includedServices: ServiceName[];
  confidenceLabel: '높음' | '보통' | '낮음';
  sourceLabels: string[];
};

export type RouteCompareData = {
  origin: Coordinates;
  destination: Coordinates;
  destinationDistanceMeters: number;
  recommendedOptionId: RouteCompareOption['id'];
  options: RouteCompareOption[];
};
