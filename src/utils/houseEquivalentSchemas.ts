import { z } from "zod";

const nonnegativeSafeIntegerSchema = z.number().int().nonnegative().safe();
const positiveSafeIntegerSchema = z.number().int().positive().safe();

export const houseConstructionStageSchema = z.enum([
  "foundation",
  "frame",
  "walls",
  "roof",
  "finishing",
]);

export const houseEquivalentInputSchema = z
  .object({
    earnedYen: nonnegativeSafeIntegerSchema,
    wastedYen: nonnegativeSafeIntegerSchema,
    unitYen: positiveSafeIntegerSchema.optional(),
  })
  .strict();

export const houseEquivalentSchema = z
  .object({
    unitYen: positiveSafeIntegerSchema,
    earnedYen: nonnegativeSafeIntegerSchema,
    wastedYen: nonnegativeSafeIntegerSchema,
    completedHouseCount: nonnegativeSafeIntegerSchema,
    currentHouseProgress: z.number().min(0).lt(1),
    currentHouseProgressPercent: z.number().int().min(0).max(99),
    remainingYenToNextHouse: positiveSafeIntegerSchema,
    constructionStage: houseConstructionStageSchema,
    wastedHouseEquivalentCount: nonnegativeSafeIntegerSchema,
  })
  .strict();
