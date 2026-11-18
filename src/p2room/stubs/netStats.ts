/* The room bundle's netStats (src/server/netStats.ts): PlayerTwo's studio measures rooms itself. */
const noop = () => {};
export const netStats = { tickMsTotal: 0, census: undefined as unknown, onSnapshots: noop, onTick: noop, onWrittenOff: noop, onOwed: noop, onInput: noop, onMessage: noop };
