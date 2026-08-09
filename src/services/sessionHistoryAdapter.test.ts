import { describe, expect, it, vi } from "vitest";

import { createSessionHistoryAdapter } from "./sessionHistoryAdapter";

describe("createSessionHistoryAdapter", () => {
  it("filters the existing owner-scoped repository result to the requested range", async () => {
    const listByOwnerInRange = vi.fn().mockResolvedValue([
      { ownerId: "owner", endedAt: 100 },
      { ownerId: "owner", endedAt: 200 },
      { ownerId: "other", endedAt: 150 },
    ]);
    const adapter = createSessionHistoryAdapter({ listByOwnerInRange });

    await expect(adapter.listByOwnerAndRange("owner", 100, 200)).resolves.toEqual([
      { ownerId: "owner", endedAt: 100 },
    ]);
    expect(listByOwnerInRange).toHaveBeenCalledWith("owner", 100, 200, 10_001);
  });

  it("rejects a truncated result instead of returning incomplete totals", async () => {
    const adapter = createSessionHistoryAdapter(
      { listByOwnerInRange: vi.fn().mockResolvedValue([{}, {}]) },
      1,
    );
    await expect(adapter.listByOwnerAndRange("owner", 0, 1)).rejects.toMatchObject({
      code: "QUERY_LIMIT_EXCEEDED",
    });
  });
});
