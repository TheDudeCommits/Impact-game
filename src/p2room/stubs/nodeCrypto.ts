/* node:crypto, for the room bundle: what the rooms use of it, from Web Crypto. */
export const randomUUID = () => crypto.randomUUID();
export function randomInt(min: number, max?: number) { if (max === undefined) { max = min; min = 0; } const span = max - min, a = new Uint32Array(1); crypto.getRandomValues(a); return min + (a[0] % span); }
export function randomBytes(n: number) { return crypto.getRandomValues(new Uint8Array(n)); }
export default { randomUUID, randomInt, randomBytes };
