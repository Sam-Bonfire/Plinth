import React from "react";
import { PlinthBadge } from "./PlinthBadge.js";

export type LoyaltyTier = "Gold" | "Silver" | "Bronze" | "New";

export interface TierBadgeProps {
  tier: LoyaltyTier;
  className?: string;
}

const TIER_COLORS: Record<LoyaltyTier, string> = {
  // No readable silver token exists (--s5 is too light for text), so the
  // neutral ink tone stands in for silver.
  Gold: "var(--y)",
  Silver: "var(--acc)",
  Bronze: "var(--o)",
  New: "var(--g)",
};

export const TierBadge: React.FC<TierBadgeProps> = ({ tier, className = "" }) => (
  <PlinthBadge
    color={TIER_COLORS[tier]}
    label={tier}
    testId={`tier-badge-${tier.toLowerCase()}`}
    className={`plinth-tier-badge ${className}`.trim()}
  />
);
