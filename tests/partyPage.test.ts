import { describe, expect, it, vi } from 'vitest';
import { DISCORD_COPY, DISCORD_INVITE, discordButton, openDiscord } from '../src/ui/social/discord';
import { partySkeleton, welcomeMarkup } from '../src/ui/social/PartyUI';
import { DISCORD_INVITE as FORK_INVITE } from '../src/originals/brand';

const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
describe('the party page', () => {
  it.skipIf(!FORK_INVITE)('invites to the Discord before and inside a party: the copy, the link, one button with the mark', () => {
    expect(DISCORD_INVITE).toBe(FORK_INVITE);
    expect(DISCORD_COPY).toBe('Need friends to play with? Join our Discord server!');
    for (const html of [welcomeMarkup(), welcomeMarkup({ joining: '123456' }), welcomeMarkup({ connecting: true, code: '12' }), partySkeleton()]) {
      expect(text(html)).toContain(DISCORD_COPY);
      expect(html).toContain(`data-party-discord="${DISCORD_INVITE}"`);
      // One control, and a button: the pad's and the keyboard's focus reach buttons, inputs and selects, never a link.
      const block = html.match(/<button[^>]*data-party-discord[^>]*>[\s\S]*?<\/button>/)?.[0] ?? '';
      expect(block).toContain('<svg');
      expect(text(block)).toContain(DISCORD_COPY);
      expect(html).not.toMatch(/<a[\s>]/);
      expect(html).not.toMatch(/<select/);
    }
    // Inside a party it is the compact, secondary row; before one, the full block beside CREATE PARTY.
    expect(partySkeleton()).toContain('pt-discord pt-compact');
    expect(welcomeMarkup()).not.toContain('pt-compact');
    expect(discordButton()).toContain('aria-label="Need friends to play with? Join our Discord server! (Discord opens in a new tab)"');
  });
  it.skipIf(!FORK_INVITE)('opens the invite in a new tab that cannot reach back into the game', () => {
    const open = vi.fn();
    openDiscord(open);
    expect(open).toHaveBeenCalledWith(DISCORD_INVITE, '_blank', 'noopener');
  });
  it.skipIf(!!FORK_INVITE)('shows no Discord without an invite', () => {
    expect(DISCORD_INVITE).toBeNull();
    expect([discordButton(), discordButton(true)]).toEqual(['', '']);
    for (const html of [welcomeMarkup(), welcomeMarkup({ joining: '123456' }), welcomeMarkup({ connecting: true, code: '12' }), partySkeleton()]) expect(html).not.toMatch(/discord/i);
    const open = vi.fn();
    openDiscord(open);
    expect(open).not.toHaveBeenCalled();
  });
});
