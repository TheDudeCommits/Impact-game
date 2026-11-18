/* `process` in the room bundle: a room has no environment, no argv and no exit (esbuild injects this where a module
 * reads it). */
export const process = { env: {} as Record<string, string | undefined>, argv: [] as string[], platform: 'p2room', versions: {}, on() {}, once() {}, emit() {}, exit() {}, cwd: () => '/', nextTick: (fn: (...a: unknown[]) => void, ...a: unknown[]) => queueMicrotask(() => fn(...a)) };
