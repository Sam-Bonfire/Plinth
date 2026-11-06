import React, { createContext, useContext, useEffect, useState } from "react";
import type { BusinessConfig } from "../api/generated/types.js";
import type { PlinthApiClient } from "../api/index.js";

const DEFAULT_CONFIG: BusinessConfig = {
  currency_code: "INR",
  default_gst_rate_percent: 5,
  tender_methods: ["Cash", "Card", "UPI", "Wallet"],
  variance_anomaly_threshold_minor: 50000,
  kitchen_sla_warning_minutes: 240,
  kitchen_sla_late_minutes: 480,
  aggregator_allowlist: ["Swiggy", "Zomato"],
  list_page_limit_small: 50,
  list_page_limit_large: 100,
};

export const BusinessConfigContext = createContext<BusinessConfig>(DEFAULT_CONFIG);

export const useBusinessConfig = (): BusinessConfig => useContext(BusinessConfigContext);

export interface BusinessConfigProviderProps {
  children: React.ReactNode;
  fallback?: BusinessConfig;
  client?: PlinthApiClient;
}

export const BusinessConfigProvider: React.FC<BusinessConfigProviderProps> = ({ children, fallback, client }) => {
  const [config, setConfig] = useState<BusinessConfig>(fallback ?? DEFAULT_CONFIG);

  useEffect(() => {
    if (client) {
      client
        .getBusinessConfig()
        .then((cfg: BusinessConfig | null | undefined) => {
          if (cfg) setConfig(cfg);
        })
        .catch((err: unknown) => {
          console.warn("Failed to fetch business config, using fallback", err);
        });
    }
  }, [client]);

  return <BusinessConfigContext.Provider value={config}>{children}</BusinessConfigContext.Provider>;
};
