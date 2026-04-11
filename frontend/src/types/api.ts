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

export type SignalStatus = 'GREEN' | 'RED' | 'UNKNOWN';
export type EtaCategory = '여유 있음' | '주의 필요' | '촉박' | '정보 부족';
export type ServiceStatus = '이용 가능' | '확인 필요' | '정보 없음';
export type BurdenLabel = '낮음' | '보통' | '높음';
export type DataOrigin = 'live' | 'mock' | 'disabled';
export type Persona = 'default' | 'elder' | 'guardian';
export type PaceProfile = 'default' | 'slow';

export type SignalCard = Coordinates & {
  intersectionId: string;
  intersectionName: string;
  pedestrianSignalStatus: SignalStatus;
  pedestrianSignalStatusLabel: string;
  remainingSeconds: number | null;
  direction: string;
  speedLimit: number | null;
  laneWidth: number | null;
  intersectionComplexity: '단순' | '주의' | '복잡';
  collectedAt: string;
  advisoryOnly: true;
};

export type BusCard = Coordinates & {
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
  etaCategory: EtaCategory;
  stopDistanceMeters: number;
  stopAccessStatus: '편함' | '보통' | '주의';
};

export type MobilityCard = Coordinates & {
  centerId: string;
  centerName: string;
  availableVehicleCount: number | null;
  operatingVehicleCount: number | null;
  serviceStatus: ServiceStatus;
  lastUpdatedAt: string;
};

export type SummaryPayload = {
  location: Coordinates;
  persona: Persona;
  paceProfile: PaceProfile;
  dataContext: {
    signalStdgCd: string;
    busStdgCd: string;
    mobilityStdgCd: string;
    enabledServices: Array<'signals' | 'buses' | 'mobility'>;
    serviceSources: {
      signals: DataOrigin;
      buses: DataOrigin;
      mobility: DataOrigin;
    };
  };
  lastUpdatedAt: string;
  movementBurden: {
    score: number;
    label: BurdenLabel;
    reason: string;
    whyNow: string;
    confidenceLabel: BurdenLabel;
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
  topSignal: SignalCard | null;
  topBus: BusCard | null;
  topMobility: MobilityCard | null;
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
  signals: SignalCard[];
  buses: BusCard[];
  mobilityCenters: MobilityCard[];
  disclaimer: string;
};

export type RouteCompareOption = {
  id: 'bus-priority' | 'signal-priority';
  label: string;
  burden: BurdenLabel;
  score: number;
  note: string;
  recommended: boolean;
  includedServices: Array<'signals' | 'buses' | 'mobility'>;
  confidenceLabel: BurdenLabel;
  sourceLabels: string[];
};

export type RouteComparePayload = {
  origin: Coordinates;
  destination: Coordinates;
  destinationDistanceMeters: number;
  recommendedOptionId: RouteCompareOption['id'];
  options: RouteCompareOption[];
};

export type MetaServiceStatus = {
  name: 'signals' | 'buses' | 'mobility';
  mode: 'mock' | 'hybrid' | 'live';
  datasetUrl: string;
  stdgCd: string;
  endpointConfigured: boolean;
  apiKeyConfigured: boolean;
  liveAdapterReady: boolean;
  fallbackAvailable: boolean;
};

export type UlsanCoveragePayload = {
  threshold: number;
  rounds: number;
  sampleCount: number;
  liveCount: number;
  coverageScore: number;
  selectionPolicy: 'free' | 'preset';
  updatedAt: string;
  recommendedPlaces: Array<{
    id: string;
    label: string;
    description: string;
    lat: number;
    lng: number;
  }>;
  unstablePoints: Array<{
    id: string;
    label: string;
    lat: number;
    lng: number;
    liveSuccess: number;
    totalChecks: number;
  }>;
};

export type MetaStatusPayload = {
  dataMode: 'mock' | 'hybrid' | 'live';
  timeoutMs: number;
  services: MetaServiceStatus[];
  ulsanCoverage: UlsanCoveragePayload;
};
