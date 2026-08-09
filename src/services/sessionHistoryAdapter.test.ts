import { describe, expect, it, vi } from "vitest";

import { createSessionHistoryAdapter } from "./sessionHistoryAdapter";

describe("createSessionHistoryAdapter", () => {
  it("filters the existing owner-scoped repository result to the requested range", async () => {
    const listByOwner = vi.fn().mockResolvedValue([
      { ownerId: "owner", endedAt: 100 },
      { ownerId: "owner", endedAt: 200 },
      { ownerId: "other", endedAt: 150 },
    ]);
    const adapter = createSessionHistoryAdapter({ listByOwner });

    await expect(adapter.listByOwnerAndRange("owner", 100, 200)).resolves.toEqual([
      { ownerId: "owner", endedAt: 100 },
    ]);
    expect(listByOwner).toHaveBeenCalledWith("owner");
  });
});
