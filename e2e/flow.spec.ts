import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test('full automation flow', async ({ page, browser }) => {
  page.on('dialog', (d) => void d.accept());
  mkdirSync('e2e/screenshots', { recursive: true });

  // 1. Log in.
  await page.goto('/admin');
  await page.getByLabel('Parola').fill('e2e-admin');
  await page.getByRole('button', { name: 'Intră în cont' }).click();
  await expect(page.getByRole('button', { name: 'Ieși din cont' })).toBeVisible();

  // 2. Reset the demo.
  await page.getByRole('button', { name: 'Resetează demo' }).click();
  await expect(page.getByText('Nu există mesaje.')).toBeVisible();

  // 3. Book a car with reminders accepted.
  await page.goto('/programare');
  await page.getByLabel('Prenume').fill('Ion');
  await page.getByLabel('Email').fill('ion@turbo-garaj.test');
  await page.getByLabel('Marca').fill('Dacia');
  await page.getByLabel('Modelul').fill('Logan');
  await page.getByLabel('Vreau remindere pentru ITP și ulei').check();
  await page.getByRole('button', { name: 'Trimite programarea' }).click();
  const statusLink = page.getByRole('link', { name: 'Deschide pagina de status' });
  await expect(statusLink).toBeVisible();
  const statusPath = await statusLink.getAttribute('href');
  expect(statusPath).toMatch(/^\/status\/.+/);

  await page.goto('/admin');
  const outbox = page.locator('section[aria-labelledby="outbox"]');
  await expect(outbox.getByText('Programarea ta la Turbo Garaj a fost primită')).toBeVisible();

  // 4. Mark it ready for pickup.
  await page.getByLabel('Status pentru Ion').selectOption({ label: 'Gata de ridicare' });
  // One email and one simulated SMS carry the "ready" subject.
  const ready = outbox.locator('li').filter({ hasText: 'Mașina ta e gata' });
  await expect(ready).toHaveCount(2);
  await expect(ready.filter({ hasText: 'SMS (simulare, netrimis)' })).toHaveCount(1);

  // 5. The public status page shows the new status as active.
  const customer = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const statusPage = await customer.newPage();
  await statusPage.goto(statusPath!);
  await expect(statusPage.locator('li[aria-current="step"]')).toHaveText('Gata de ridicare');
  await statusPage.screenshot({ path: 'e2e/screenshots/status.png', fullPage: true });

  // 6. "Rulează acum" adds a daily-reminders run triggered by the button.
  const runs = page.locator('section[aria-labelledby="live"] > ul > li');
  const reminderRuns = runs.filter({ hasText: 'Remindere zilnice' }).filter({ hasText: 'buton' });
  await expect(reminderRuns).toHaveCount(0);
  await page.getByRole('button', { name: 'Rulează acum' }).click();
  await expect(reminderRuns).toHaveCount(1, { timeout: 5000 });
  await page.screenshot({ path: 'e2e/screenshots/admin.png', fullPage: true });

  // 7. Deleting the customer invalidates the status link.
  await page.getByRole('button', { name: 'Șterge clientul' }).click();
  await expect(page.getByText('Nu există programări.')).toBeVisible();
  await statusPage.reload();
  await expect(statusPage.getByText('Linkul nu mai e valid.')).toBeVisible();
  await customer.close();
});
