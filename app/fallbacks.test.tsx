import { readdirSync, readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './error';
import NotFound from './not-found';
import robots from './robots';
import sitemap from './sitemap';

function descendantFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (
      ['.git', '.next', 'dist', 'node_modules', 'test-results'].includes(
        entry.name,
      )
    )
      return [];
    const url = new URL(
      `${entry.name}${entry.isDirectory() ? '/' : ''}`,
      directory,
    );
    return entry.isDirectory() ? descendantFiles(url) : [url];
  });
}

function countTestCalls(source: string, name: 'it' | 'test'): number {
  const sourceFile = ts.createSourceFile(
    'counted-tests.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let count = 0;
  const inspect = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === name)
        count += 1;
      else if (
        ts.isCallExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        ts.isIdentifier(node.expression.expression.expression) &&
        node.expression.expression.expression.text === name &&
        node.expression.expression.name.text === 'each'
      ) {
        const cases = node.expression.arguments[0];
        if (!cases || !ts.isArrayLiteralExpression(cases))
          throw new Error(
            `${name}.each must use an inline array to be counted.`,
          );
        count += cases.elements.length;
      }
    }
    node.forEachChild(inspect);
  };
  inspect(sourceFile);
  return count;
}

describe('application fallbacks and crawl metadata', () => {
  it('renders a useful not-found route', () => {
    const markup = renderToStaticMarkup(<NotFound />);
    expect(markup).toContain('Page not found');
    expect(markup).toContain('href="/studio"');
  });

  it('renders a retry action for route errors', () => {
    const markup = renderToStaticMarkup(
      <ErrorBoundary error={new Error('test')} reset={vi.fn()} />,
    );
    expect(markup).toContain('The studio could not load.');
    expect(markup).toContain('Try again');
  });

  it('publishes the intended routes in robots and sitemap metadata', () => {
    expect(robots()).toEqual({
      rules: { userAgent: '*', allow: '/' },
      sitemap:
        'https://clearpath-access.hanzlakhan2266.chatgpt.site/sitemap.xml',
    });
    expect(sitemap()).toEqual([
      { url: 'https://clearpath-access.hanzlakhan2266.chatgpt.site' },
      { url: 'https://clearpath-access.hanzlakhan2266.chatgpt.site/studio' },
    ]);

    const packageJson = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { engines: { node: string } };
    expect(packageJson.engines.node).toBe('>=22.13.0');

    const readDocument = (file: string) =>
      readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const vitestCount = descendantFiles(new URL('../', import.meta.url))
      .filter((url) => /\.test\.tsx?$/.test(url.pathname))
      .reduce(
        (count, url) => count + countTestCalls(readFileSync(url, 'utf8'), 'it'),
        0,
      );
    const playwrightCount = countTestCalls(
      readDocument('tests/e2e/studio.spec.ts'),
      'test',
    );
    expect(readDocument('README.md')).toContain(
      `${vitestCount} Vitest unit/contract tests and ${playwrightCount} Chromium workflows pass locally`,
    );
    expect(readDocument('SUBMISSION.md')).toContain(
      `${vitestCount} unit/contract tests and ${playwrightCount} Chromium workflows passing locally`,
    );
    expect(readDocument('EVALUATION.md')).toContain(
      `Vitest: 5 files, ${vitestCount} tests passing locally`,
    );
    expect(readDocument('EVALUATION.md')).toContain(
      `Chromium: ${playwrightCount} workflows passing locally`,
    );
  });
});
