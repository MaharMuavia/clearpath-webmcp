import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __clearPathTools?: Map<string, { execute: (input: unknown) => unknown }>;
  }
}

async function installWebMcpMock(page: Page) {
  await page.addInitScript(() => {
    const tools = new Map<string, { execute: (input: unknown) => unknown }>();
    window.__clearPathTools = tools;
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool(
          tool: { name: string; execute: (input: unknown) => unknown },
          options?: { signal?: AbortSignal },
        ) {
          tools.set(tool.name, tool);
          options?.signal?.addEventListener(
            'abort',
            () => {
              if (tools.get(tool.name) === tool) tools.delete(tool.name);
            },
            { once: true },
          );
        },
      },
    });
  });
}

async function openStudio(page: Page) {
  await page.goto('/studio');
  await page.locator('html[data-clearpath-ready="true"]').waitFor();
}

test('landing has no tools and studio registers the state-aware WebMCP surface', async ({
  page,
}) => {
  await installWebMcpMock(page);
  await page.goto('/');
  expect(
    await page.evaluate(() => [...(window.__clearPathTools?.keys() ?? [])]),
  ).toEqual([]);
  await openStudio(page);
  await expect(
    page.getByRole('heading', { name: 'North Hall classroom' }),
  ).toBeVisible();
  const names = await page.evaluate(() =>
    [...(window.__clearPathTools?.keys() ?? [])].sort(),
  );
  expect(names).toEqual(
    [
      'audit_access_routes',
      'focus_audit_issue',
      'generate_route_alternatives',
      'get_audit_history',
      'get_plan_geometry',
      'get_plan_summary',
      'set_planning_constraints',
    ].sort(),
  );
  await expect(
    page.evaluate(() =>
      window.__clearPathTools
        ?.get('audit_access_routes')
        ?.execute({ unexpected: true }),
    ),
  ).rejects.toThrow('Unexpected input');
});

test('audit focuses a real issue and tool output matches visible metrics', async ({
  page,
}) => {
  await installWebMcpMock(page);
  await openStudio(page);
  const result = await page.evaluate(
    async () =>
      window.__clearPathTools
        ?.get('audit_access_routes')
        ?.execute({ severity: 'all' }) as Promise<{
        metrics: { score: number };
        issues: Array<{ id: string }>;
      }>,
  );
  expect(result.issues.length).toBeGreaterThan(0);
  await page.evaluate(
    async (issueId) =>
      window.__clearPathTools?.get('focus_audit_issue')?.execute({ issueId }),
    result.issues[0].id,
  );
  await expect(
    page.getByText(`Focused ${result.issues[0].id} on the shared canvas.`),
  ).toBeVisible();
  await expect(page.getByText(`${result.metrics.score}/100`)).toBeVisible();
});

test('lock, generate, stage, compare, human approve, apply, and undo', async ({
  page,
}) => {
  await openStudio(page);
  await page.getByRole('button', { name: 'Lock Desk 8' }).click();
  await page.getByRole('button', { name: 'Generate alternatives' }).click();
  await expect(page.getByRole('button', { name: /Option 1/ })).toContainText(
    'Threshold satisfied',
  );
  await page.getByRole('button', { name: /Option 1/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Exact before / after comparison' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Approve and apply' }).click();
  await expect(page.getByText(/Human approval recorded/)).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(
    page.getByText(/Restored exact plan version north-hall-v1/),
  ).toBeVisible();
});

test('stage then reject leaves the committed version unchanged', async ({
  page,
}) => {
  await openStudio(page);
  await page.getByRole('button', { name: 'Generate alternatives' }).click();
  await page.getByRole('button', { name: /Option 1/ }).click();
  await page.getByRole('button', { name: 'Reject proposal' }).click();
  await expect(
    page.getByText(/rejected; committed geometry unchanged/),
  ).toBeVisible();
  await expect(page.getByText('Version north-hall-v1')).toBeVisible();
});

test('impossible capacity fails safely and the human UI works without WebMCP', async ({
  page,
}) => {
  await openStudio(page);
  await page.getByLabel('Required seat capacity').fill('25');
  await page.getByRole('button', { name: 'Generate alternatives' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'exceeds the current capacity',
  );
  await expect(page.getByText('Version north-hall-v1')).toBeVisible();
});

test('dynamic apply requests human approval and disappears after rejection', async ({
  page,
}) => {
  await installWebMcpMock(page);
  await openStudio(page);
  const generated = await page.evaluate(
    async () =>
      window.__clearPathTools
        ?.get('generate_route_alternatives')
        ?.execute({}) as Promise<{
        alternatives: Array<{ proposalId: string }>;
      }>,
  );
  const id = generated.alternatives[0].proposalId;
  await page.evaluate(
    async (proposalId) =>
      window.__clearPathTools
        ?.get('stage_route_proposal')
        ?.execute({ proposalId }),
    id,
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.__clearPathTools?.has('apply_staged_plan')),
    )
    .toBe(true);
  const request = await page.evaluate(
    async (proposalId) =>
      window.__clearPathTools
        ?.get('apply_staged_plan')
        ?.execute({ proposalId }) as Promise<{
        committed: boolean;
        approvalRequired: boolean;
      }>,
    id,
  );
  expect(request).toEqual(
    expect.objectContaining({ committed: false, approvalRequired: true }),
  );
  await expect(
    page.getByText(
      'The agent requested approval. No geometry has been committed.',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Audit trail' }).click();
  await expect(page.getByText('approval requested')).toBeVisible();
  await page.getByRole('tab', { name: 'compare' }).click();
  await page.getByRole('button', { name: 'Reject proposal' }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__clearPathTools?.has('apply_staged_plan')),
    )
    .toBe(false);
});

test('lower capacity exposes an explicit removable-seat trade-off and undo restores it', async ({
  page,
}) => {
  await openStudio(page);
  await page.getByLabel('Required seat capacity').fill('22');
  await page.getByRole('button', { name: 'Generate alternatives' }).click();
  await expect(page.getByRole('button', { name: /Option 1/ })).toContainText(
    'removed',
  );
  await page.getByRole('button', { name: /Option 1/ }).click();
  await expect(
    page.getByText(/removed from usable layout, −2 seats/),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'plan' }).click();
  await expect(page.getByText('REMOVED', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'compare' }).click();
  await page.getByRole('button', { name: 'Approve and apply' }).click();
  await expect(page.getByText('22 seats')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('24 seats')).toBeVisible();
});
