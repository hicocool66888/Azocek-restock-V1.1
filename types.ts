
export interface SKUData {
  sellerSku: string;
  restockSku: string;
}

export interface SalesData {
  sellerSku: string;
  months: {
    recent: number;
    middle: number;
    early: number;
  };
  monthNames: string[];
  daily: {
    recent: number;
    middle: number;
    early: number;
  };
  weightedAvg: number;
}

export interface OverseasInventory {
  available: number;
  transit: number;
}

export interface OverseasData {
  [restockSku: string]: {
    la: OverseasInventory;
    ny: OverseasInventory;
  };
}

export interface OfficialInventoryData {
  [restockSku: string]: {
    available: number;
    transit: number;
  };
}

export interface RestockPlanItem {
  restockSku: string;
  sellerSkus: string;
  daily: number;
  baseDemand: number;
  adjustedDemand: number;
  cycleDemand: number; 
  totalStock: number;
  gap: number;
  netDemand: number;
  // 总缺口分仓
  laQty: number;
  nyQty: number;
  fbtQty: number;
  // 新增：周期基准分仓 (用于 7 天下单参考)
  cycleLa: number;
  cycleNy: number;
  cycleFbt: number;
}

export interface AppState {
  mapping: Record<string, string>;
  sales: Record<string, SalesData>;
  overseas: OverseasData;
  officialInventory: OfficialInventoryData;
  weights: {
    recent: number;
    middle: number;
    early: number;
  };
}

export interface InventoryTabProps {
  mapping: Record<string, string>;
  overseas: OverseasData;
  officialInventory: OfficialInventoryData;
  onUpdateOverseas: (data: OverseasData) => void;
  onUpdateOfficial: (data: OfficialInventoryData) => void;
  onClearOverseas: () => void;
  onClearOfficial: () => void;
}
