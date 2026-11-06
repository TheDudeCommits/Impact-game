/** The five rarities, Common to Mythic: how rare an item reads (its colour).
 *  Since 8 October 2026 (the shop streamlined) a rarity gates nothing: an item
 *  on offer has its own price or road level (unlocks.ts) and asks nothing else,
 *  so every rarity opens at level 1. A rarity's price is only what a retired
 *  item was sold for. A Mythic bought before is still numbered. */
export const RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic'] as const;
export type Rarity = (typeof RARITIES)[number];

export interface RarityRule {
  name: string;
  price: number;
  /** The account level it opens at. */
  level: number;
  /** Copies that will ever exist of each item (none: no limit). Each is numbered as it is bought. */
  supply?: number;
  /** Its colour in the interface (on paper; the shop lightens it on a dark page). */
  color: string;
}
export const RARITY: Record<Rarity, RarityRule> = {
  common: { name: 'Common', price: 60, level: 1, color: '#6b6560' },
  rare: { name: 'Rare', price: 200, level: 1, color: '#1f6fb8' },
  epic: { name: 'Epic', price: 600, level: 1, color: '#7a3cb4' },
  legendary: { name: 'Legendary', price: 1800, level: 1, color: '#a8740a' },
  mythic: { name: 'Mythic', price: 12000, level: 1, supply: 100, color: '#c81e2a' },
};
