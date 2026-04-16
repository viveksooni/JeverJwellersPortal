import type { MetalRateKey } from '../constants/jewelry.js';

export interface MetalRate {
  id: number;
  metalType: MetalRateKey;
  ratePerGram: string;
  effectiveDate: string; // ISO date YYYY-MM-DD (can be future)
  createdAt: string;
}

export interface CreateMetalRateDto {
  metalType: MetalRateKey;
  ratePerGram: string;
  effectiveDate: string; // YYYY-MM-DD, defaults to today if omitted
}

export interface TodayRates {
  [key: string]: string | null; // metalType -> ratePerGram or null if not set
}
