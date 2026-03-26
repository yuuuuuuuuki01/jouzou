"use client";

import { createContext, startTransition, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type {
  BrewPlanResult,
  ForecastAdjustment,
  ForecastResult,
  InventoryImportResult,
  SalesImportResult
} from "@/lib/brewing/types";

interface BrewPlannerState {
  salesImport: SalesImportResult | null;
  inventoryImport: InventoryImportResult | null;
  adjustments: ForecastAdjustment[];
  forecast: ForecastResult | null;
  plan: BrewPlanResult | null;
  safetyStockMonthsByProduct: Record<string, number>;
}

interface BrewPlannerContextValue extends BrewPlannerState {
  hydrated: boolean;
  setSalesImport: (value: SalesImportResult | null) => void;
  setInventoryImport: (value: InventoryImportResult | null) => void;
  setForecast: (value: ForecastResult | null) => void;
  setPlan: (value: BrewPlanResult | null) => void;
  upsertAdjustment: (value: ForecastAdjustment) => void;
  clearAdjustment: (productCode: string, yearMonth?: string) => void;
  setSafetyStockMonths: (productCode: string, months: number) => void;
  clearAll: () => void;
}

const STORAGE_KEY = "brew-planner-state-v1";

const initialState: BrewPlannerState = {
  salesImport: null,
  inventoryImport: null,
  adjustments: [],
  forecast: null,
  plan: null,
  safetyStockMonthsByProduct: {}
};

const BrewPlannerContext = createContext<BrewPlannerContextValue | null>(null);

function sameAdjustmentScope(left: ForecastAdjustment, right: ForecastAdjustment) {
  return left.productCode === right.productCode && left.yearMonth === right.yearMonth;
}

export function BrewPlannerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BrewPlannerState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as BrewPlannerState;
        setState({
          ...initialState,
          ...parsed
        });
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const value = useMemo<BrewPlannerContextValue>(
    () => ({
      ...state,
      hydrated,
      setSalesImport(nextValue) {
        startTransition(() => {
          setState((current) => ({
            ...current,
            salesImport: nextValue,
            forecast: null,
            plan: null
          }));
        });
      },
      setInventoryImport(nextValue) {
        startTransition(() => {
          setState((current) => ({
            ...current,
            inventoryImport: nextValue,
            plan: null
          }));
        });
      },
      setForecast(nextValue) {
        startTransition(() => {
          setState((current) => ({
            ...current,
            forecast: nextValue,
            plan: null
          }));
        });
      },
      setPlan(nextValue) {
        startTransition(() => {
          setState((current) => ({
            ...current,
            plan: nextValue
          }));
        });
      },
      upsertAdjustment(nextValue) {
        startTransition(() => {
          setState((current) => {
            const filtered = current.adjustments.filter((adjustment) => !sameAdjustmentScope(adjustment, nextValue));
            const isEmpty = Number.isNaN(nextValue.value) || nextValue.value === 0;

            return {
              ...current,
              adjustments: isEmpty ? filtered : [...filtered, nextValue],
              forecast: null,
              plan: null
            };
          });
        });
      },
      clearAdjustment(productCode, yearMonth) {
        startTransition(() => {
          setState((current) => ({
            ...current,
            adjustments: current.adjustments.filter(
              (adjustment) => adjustment.productCode !== productCode || adjustment.yearMonth !== yearMonth
            ),
            forecast: null,
            plan: null
          }));
        });
      },
      setSafetyStockMonths(productCode, months) {
        startTransition(() => {
          setState((current) => ({
            ...current,
            safetyStockMonthsByProduct: {
              ...current.safetyStockMonthsByProduct,
              [productCode]: Number.isFinite(months) ? months : 1
            },
            plan: null
          }));
        });
      },
      clearAll() {
        startTransition(() => {
          setState(initialState);
        });
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }),
    [hydrated, state]
  );

  return <BrewPlannerContext.Provider value={value}>{children}</BrewPlannerContext.Provider>;
}

export function useBrewPlanner() {
  const context = useContext(BrewPlannerContext);
  if (!context) {
    throw new Error("useBrewPlanner must be used within BrewPlannerProvider");
  }

  return context;
}
