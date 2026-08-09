import { HOUSE_UNIT_YEN } from "../../constants/houseEquivalent";
import type { HouseEquivalentInput } from "../../types/houseEquivalent";

export const HOUSE_EQUIVALENT_FIXTURES = {
  zero: {
    earnedYen: 0,
    wastedYen: 0,
  },
  oneUnit: {
    earnedYen: HOUSE_UNIT_YEN,
    wastedYen: 0,
  },
  multipleWithProgress: {
    earnedYen: HOUSE_UNIT_YEN * 3 + HOUSE_UNIT_YEN / 2,
    wastedYen: HOUSE_UNIT_YEN * 2,
  },
} as const satisfies Readonly<Record<string, HouseEquivalentInput>>;
