import type { HouseConstructionStage } from "../types/houseEquivalent";

/** Amount in JPY represented by one completed house. */
export const HOUSE_UNIT_YEN = 30_000_000;

/** Keep the visual treatment bounded even for very large lifetime totals. */
export const MAX_RENDERED_COMPLETED_HOUSES = 3;

export const HOUSE_CONSTRUCTION_STAGE_BOUNDARIES: ReadonlyArray<
  Readonly<{
    minimumProgressPercent: number;
    stage: HouseConstructionStage;
  }>
> = [
  { minimumProgressPercent: 0, stage: "foundation" },
  { minimumProgressPercent: 20, stage: "frame" },
  { minimumProgressPercent: 45, stage: "walls" },
  { minimumProgressPercent: 70, stage: "roof" },
  { minimumProgressPercent: 90, stage: "finishing" },
];
