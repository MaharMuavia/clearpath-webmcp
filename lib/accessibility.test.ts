import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const STUDIO_TEXT_TOKENS = {
  '--studio-muted': '#53655a',
  '--studio-subtle': '#4f6156',
} as const;

const STUDIO_TOKEN_PAIRS = [
  ['--studio-muted', '#ffffff'],
  ['--studio-muted', '#f8faf6'],
  ['--studio-muted', '#f7f9f5'],
  ['--studio-muted', '#f5f8f2'],
  ['--studio-muted', '#edf2ec'],
  ['--studio-subtle', '#ffffff'],
  ['--studio-subtle', '#f8faf6'],
] as const;

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return (
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  );
}

function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('studio text contrast', () => {
  it('keeps every muted foreground/background token pair at WCAG AA', () => {
    const stylesheet = readFileSync(
      new URL('../app/globals.css', import.meta.url),
      'utf8',
    );
    for (const [name, value] of Object.entries(STUDIO_TEXT_TOKENS))
      expect(stylesheet).toContain(`${name}: ${value};`);
    for (const [foregroundToken, background] of STUDIO_TOKEN_PAIRS) {
      const foreground = STUDIO_TEXT_TOKENS[foregroundToken];
      expect(
        contrastRatio(foreground, background),
        `${foregroundToken} on ${background}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
