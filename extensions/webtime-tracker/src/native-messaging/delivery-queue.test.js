import { describe, expect, it, vi } from "vitest";

import { createDeliveryQueue } from "./delivery-queue.js";

describe("createDeliveryQueue", () => {
  it("delivers operations in the order they were queued", async () => {
    const queue = createDeliveryQueue();
    const order = [];
    let releaseFirst;

    const first = queue.enqueue(
      () =>
        new Promise((resolve) => {
          releaseFirst = () => {
            order.push("first");
            resolve();
          };
        }),
    );
    const secondOperation = vi.fn(() => {
      order.push("second");
    });
    const second = queue.enqueue(secondOperation);

    await Promise.resolve();
    expect(secondOperation).not.toHaveBeenCalled();
    expect(queue.pendingCount).toBe(2);

    releaseFirst();
    await Promise.all([first, second]);

    expect(order).toEqual(["first", "second"]);
    expect(queue.pendingCount).toBe(0);
  });

  it("continues with the next operation after a failure", async () => {
    const queue = createDeliveryQueue();
    const first = queue.enqueue(() => Promise.reject(new Error("failed")));
    const second = queue.enqueue(() => "delivered");

    await expect(first).rejects.toThrow("failed");
    await expect(second).resolves.toBe("delivered");
  });
});
