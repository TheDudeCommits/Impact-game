/** three's bundled meshoptimizer simplifier (three ships no types for it). */
declare module 'three/examples/jsm/libs/meshopt_simplifier.module.js' {
  export const MeshoptSimplifier: {
    ready: Promise<void>;
    supported: boolean;
    /** A coarser index buffer over the same vertices, and the error it settled for. */
    simplify(indices: Uint32Array, positions: Float32Array, stride: number, targetIndexCount: number, targetError: number, flags?: readonly string[]): [Uint32Array, number];
    simplifyWithAttributes(indices: Uint32Array, positions: Float32Array, stride: number, attributes: Float32Array, attributeStride: number, weights: number[], locks: Uint8Array | null, targetIndexCount: number, targetError: number, flags?: readonly string[]): [Uint32Array, number];
  };
}
