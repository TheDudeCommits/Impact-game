// The cluster's production entry (src/server/main.ts with ROOM_WORKERS) with a fault planted in its primary, for
// tests/cluster.test.ts. Never deployed. On SIGUSR2 the primary throws in a timer and leaves a promise rejected that
// nobody awaits - outside every request and every child. Its children are forked from src/server/index.ts as ever, and
// never see this file.
export {};
if (!process.env.CLUSTER_ROLE) process.on('SIGUSR2', () => {
  setTimeout(() => { throw new Error('planted stray exception in the primary'); });
  void Promise.reject(new Error('planted stray rejection in the primary'));
});

await import('../../src/server/main');
