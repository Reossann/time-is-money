export function createDeliveryQueue() {
  let tail = Promise.resolve();
  let pendingCount = 0;

  return {
    enqueue(operation) {
      pendingCount += 1;

      const nextOperation = tail.then(operation, operation);
      tail = nextOperation.catch(() => {});

      return nextOperation.finally(() => {
        pendingCount -= 1;
      });
    },
    get pendingCount() {
      return pendingCount;
    },
  };
}
