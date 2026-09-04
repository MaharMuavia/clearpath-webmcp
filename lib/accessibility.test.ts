import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const TEXT_TOKENS = {
  '--studio-muted': '#53655a',
  '--studio-subtle': '#4f6156',
} as const;

const SOURCES = [
  {
    file: 'app/page.tsx',
    url: new URL('../app/page.tsx', import.meta.url),
    defaultBackground: '#f7f8f3',
  },
  {
    file: 'components/studio/clearpath-studio.tsx',
    url: new URL('../components/studio/clearpath-studio.tsx', import.meta.url),
    defaultBackground: '#edf2ec',
  },
] as const;

const ICON_ONLY_EXEMPTIONS = [
  {
    file: 'components/studio/clearpath-studio.tsx',
    tag: 'Unlock',
    foreground: '#668071',
  },
  {
    file: 'components/studio/clearpath-studio.tsx',
    tag: 'Check',
    foreground: '#37824f',
  },
  {
    file: 'components/studio/clearpath-studio.tsx',
    tag: 'Eye',
    foreground: '#668071',
  },
] as const;

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function classText(
  element: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
): string {
  const className = element.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) &&
      property.name.getText(sourceFile) === 'className',
  );
  if (!className?.initializer) return '';
  const strings: string[] = [];
  const collectStrings = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node)) strings.push(node.text);
    else node.forEachChild(collectStrings);
  };
  collectStrings(className.initializer);
  return strings.join(' ');
}

function backgroundColors(classNames: string): string[] {
  const hex = [...classNames.matchAll(/(?:^|\s)bg-\[(#[0-9a-f]{6})\]/gi)].map(
    (match) => match[1].toLowerCase(),
  );
  if (/(?:^|\s)bg-white(?:\s|$)/.test(classNames)) hex.push('#ffffff');
  return [...new Set(hex)];
}

function textColors(classNames: string): string[] {
  return [
    ...classNames.matchAll(
      /(?:^|\s)text-\[(#[0-9a-f]{6}|var\((--[a-z0-9-]+)\))\]/gi,
    ),
  ].map((match) => {
    const token = match[2] as keyof typeof TEXT_TOKENS | undefined;
    return token ? TEXT_TOKENS[token] : match[1].toLowerCase();
  });
}

function nearestBackgrounds(
  element: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
  fallback: string,
): string[] {
  let current: ts.Node | undefined = element;
  const visited = new Set<ts.JsxOpeningLikeElement>();
  while (current) {
    const opening = ts.isJsxOpeningElement(current)
      ? current
      : ts.isJsxSelfClosingElement(current)
        ? current
        : ts.isJsxElement(current)
          ? current.openingElement
          : undefined;
    if (opening && !visited.has(opening)) {
      visited.add(opening);
      const backgrounds = backgroundColors(classText(opening, sourceFile));
      if (backgrounds.length > 0) return backgrounds;
    }
    current = current.parent;
  }
  return [fallback];
}

describe('rendered text contrast', () => {
  it('checks component text literals against their nearest background', () => {
    const stylesheet = readFileSync(
      new URL('../app/globals.css', import.meta.url),
      'utf8',
    );
    for (const [name, value] of Object.entries(TEXT_TOKENS))
      expect(stylesheet).toContain(`${name}: ${value};`);

    const usedExemptions = new Set<string>();
    for (const source of SOURCES) {
      const text = readFileSync(source.url, 'utf8');
      const sourceFile = ts.createSourceFile(
        source.file,
        text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const inspect = (node: ts.Node): void => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          const foregrounds = textColors(classText(node, sourceFile));
          const backgrounds = nearestBackgrounds(
            node,
            sourceFile,
            source.defaultBackground,
          );
          const tag = node.tagName.getText(sourceFile);
          const line =
            sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          for (const foreground of foregrounds) {
            const exemption = ICON_ONLY_EXEMPTIONS.find(
              (candidate) =>
                candidate.file === source.file &&
                candidate.tag === tag &&
                candidate.foreground === foreground,
            );
            for (const background of backgrounds) {
              const label = `${source.file}:${line} <${tag}> ${foreground} on ${background}`;
              if (exemption) {
                usedExemptions.add(
                  `${exemption.file}:${exemption.tag}:${exemption.foreground}`,
                );
                expect(
                  contrastRatio(foreground, background),
                  label,
                ).toBeGreaterThanOrEqual(3);
              } else {
                expect(
                  contrastRatio(foreground, background),
                  label,
                ).toBeGreaterThanOrEqual(4.5);
              }
            }
          }
        }
        node.forEachChild(inspect);
      };
      inspect(sourceFile);
    }

    expect([...usedExemptions].sort()).toEqual(
      ICON_ONLY_EXEMPTIONS.map(
        ({ file, tag, foreground }) => `${file}:${tag}:${foreground}`,
      ).sort(),
    );
  });
});
