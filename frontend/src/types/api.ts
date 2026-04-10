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

export type SignalCard = Coordinates & {
  intersectionId: string;
  intersectionName: string;
  pedestrianSignalStatus: SignalStatus;
  pedestrianSignalStatusLabel: string;
  remainingSeconds: number | null;
  direction: string;
  collectedAt: string;
  advisoryOnly: true;
};

export type BusCard = Coordinates & {
  routeId: string;
  routeNo: string;
  routeType: string;
  vehicleNo: string;
  speed: number | null;
  heading: number | null;
  lastUpdatedAt: string;
  nearStopName: string;
  etaCategory: EtaCategory;
  stopDistanceMeters: number;
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
    confidenceLabel: BurdenLabel;
    freshnessMinutes: number | null;
    factors: string[];
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
  signals: SignalCard[];
  buses: BusCard[];
  mobilityCenters: MobilityCard[];
  disclaimer: string;
};

export type RouteCompareOption = {
  id: 'bus-priority' | 'mobility-priority';
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
