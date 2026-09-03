import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './error';
import NotFound from './not-found';
import robots from './robots';
import sitemap from './sitemap';

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
    expect(readDocument('README.md')).toContain(
      '74 Vitest unit/contract tests and 9 Chromium workflows pass locally',
    );
    expect(readDocument('SUBMISSION.md')).toContain(
      '74 unit/contract tests and 9 Chromium workflows passing locally',
    );
    expect(readDocument('EVALUATION.md')).toContain(
      'Vitest: 5 files, 74 tests passing locally',
    );
    expect(readDocument('EVALUATION.md')).toContain(
      'Chromium: 9 workflows passing locally',
    );
  });
});
