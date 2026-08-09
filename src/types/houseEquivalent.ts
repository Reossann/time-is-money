export type HouseConstructionStage =
  | "foundation"
  | "frame"
  | "walls"
  | "roof"
  | "finishing";

export type HouseEquivalentInput = Readonly<{
  earnedYen: number;
  wastedYen: number;
  /** Defaults to the product-wide HOUSE_UNIT_YEN constant. */
  unitYen?: number;
}>;

export type HouseEquivalent = Readonly<{
  unitYen: number;
  earnedYen: number;
  wastedYen: number;
  completedHouseCount: number;
  currentHouseProgress: number;
  currentHouseProgressPercent: number;
  remainingYenToNextHouse: number;
  constructionStage: HouseConstructionStage;
  wastedHouseEquivalentCount: number;
}>;

export type HouseEquivalentErrorCode =
  | "INVALID_EARNED_YEN"
  | "INVALID_WASTED_YEN"
  | "INVALID_UNIT_YEN";
