import React from "react";
import { FilterButtonGroup } from "../FilterButtonGroup/FilterButtonGroup.js";

export const ALL_STATIONS = "all";

export interface KDSStationFilterProps {
  stations: string[];
  counts?: Record<string, number>;
  value?: string;
  onChange: (station: string) => void;
  className?: string;
}

export const KDSStationFilter: React.FC<KDSStationFilterProps> = ({
  stations,
  counts,
  value = ALL_STATIONS,
  onChange,
  className = "",
}) => (
  <FilterButtonGroup
    value={value}
    onChange={onChange}
    className={`plinth-kds-station-filter ${className}`.trim()}
    options={[
      { value: ALL_STATIONS, label: "All stations" },
      ...stations.map((station) => ({
        value: station,
        label: station,
        count: counts?.[station],
      })),
    ]}
  />
);
