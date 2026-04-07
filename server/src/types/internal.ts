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
  collectedAt: string;
  advisoryOnly: true;
};

export type BusData = Coordinates & {
  routeId: string;
  routeNo: string;
  routeType: string;
  vehicleNo: string;
  speed: number | null;
  heading: number | null;
  lastUpdatedAt: string;
  nearStopName: string;
  etaCategory: '여유 있음' | '주의 필요' | '촉박' | '정보 부족';
  stopDistanceMeters: number;
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
  };
  topSignal: SignalData | null;
  topBus: BusData | null;
  topMobility: MobilityData | null;
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
