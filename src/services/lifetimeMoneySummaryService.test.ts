import { describe, expect, it, vi } from "vitest";

import { createLifetimeMoneySummaryService } from "./lifetimeMoneySummaryService";

describe("createLifetimeMoneySummaryService", () => {
  it("delegates only to the shared aggregation client", async () => {
    const getLifetimeMoneySummary = vi.fn().mockResolvedValue({
      ownerId: "owner-a",
      sessionCount: 1,
      earnedYen: 100,
      wastedYen: 40,
      netYen: 60,
    });
    const service = createLifetimeMoneySummaryService({
      getLifetimeMoneySummary,
    });

    await expect(service.getSummary("owner-a")).resolves.toMatchObject({
      earnedYen: 100,
      wastedYen: 40,
    });
    expect(getLifetimeMoneySummary).toHaveBeenCalledWith("owner-a");
  });
});
