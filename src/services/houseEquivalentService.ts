import {
  HOUSE_CONSTRUCTION_STAGE_BOUNDARIES,
  HOUSE_UNIT_YEN,
} from "../constants/houseEquivalent";
import type {
  HouseConstructionStage,
  HouseEquivalent,
  HouseEquivalentErrorCode,
  HouseEquivalentInput,
} from "../types/houseEquivalent";
import { houseEquivalentInputSchema } from "../utils/houseEquivalentSchemas";

export class HouseEquivalentError extends Error {
  constructor(
    public readonly code: HouseEquivalentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "HouseEquivalentError";
  }
}

function validateYen(value: unknown, code: HouseEquivalentErrorCode): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new HouseEquivalentError(
      code,
      `${code} must be a non-negative safe integer in JPY`,
    );
  }

  return value;
}

function validateUnitYen(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new HouseEquivalentError(
      "INVALID_UNIT_YEN",
      "unitYen must be a positive safe integer in JPY",
    );
  }

  return value;
}

export function validateHouseEquivalentInput(
  input: HouseEquivalentInput,
): Required<HouseEquivalentInput> {
  const parsed = houseEquivalentInputSchema.safeParse(input);
  if (parsed.success) {
    return Object.freeze({
      earnedYen: parsed.data.earnedYen,
      wastedYen: parsed.data.wastedYen,
      unitYen: parsed.data.unitYen ?? HOUSE_UNIT_YEN,
    });
  }

  return Object.freeze({
    earnedYen: validateYen(input?.earnedYen, "INVALID_EARNED_YEN"),
    wastedYen: validateYen(input?.wastedYen, "INVALID_WASTED_YEN"),
    unitYen: validateUnitYen(input?.unitYen ?? HOUSE_UNIT_YEN),
  });
}

export function getHouseConstructionStage(
  progressPercent: number,
): HouseConstructionStage {
  let stage: HouseConstructionStage = "foundation";

  for (const boundary of HOUSE_CONSTRUCTION_STAGE_BOUNDARIES) {
    if (progressPercent < boundary.minimumProgressPercent) break;
    stage = boundary.stage;
  }

  return stage;
}

export function calculateHouseEquivalent(
  input: HouseEquivalentInput,
): HouseEquivalent {
  const { earnedYen, wastedYen, unitYen } = validateHouseEquivalentInput(input);
  const completedHouseCount = Math.floor(earnedYen / unitYen);
  const remainderYen = earnedYen % unitYen;
  const currentHouseProgress = remainderYen / unitYen;
  const currentHouseProgressPercent = Math.floor(currentHouseProgress * 100);

  return Object.freeze({
    unitYen,
    earnedYen,
    wastedYen,
    completedHouseCount,
    currentHouseProgress,
    currentHouseProgressPercent,
    remainingYenToNextHouse: unitYen - remainderYen,
    constructionStage: getHouseConstructionStage(currentHouseProgressPercent),
    wastedHouseEquivalentCount: Math.floor(wastedYen / unitYen),
  });
}
