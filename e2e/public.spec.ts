import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BANNER = 'Site demonstrativ realizat de Quality Zone';
const PATHS = ['/', '/programare', '/automatizari', '/confidentialitate', '/admin', '/status/x'];

test('banner and noindex on every page', async ({ page }) => {
  for (const path of PATHS) {
    const response = await page.goto(path);
    expect(response?.headers()['x-robots-tag'], path).toBe('noindex, nofollow');
    await expect(page.getByRole('link', { name: BANNER }), path).toBeVisible();
    await expect(page.locator('meta[name="robots"]'), path).toHaveAttribute('content', 'noindex, nofollow');
  }
});

test('demo-locked form', async ({ page }) => {
  await page.goto('/programare');
  await page.getByLabel('Prenume').fill('Ion');
  await page.getByLabel('Email').fill('ion@turbo-garaj.test');
  await page.getByLabel('Marca').fill('Dacia');
  await page.getByLabel('Modelul').fill('Logan');
  await page.getByRole('button', { name: 'Trimite programarea' }).click();
  await expect(page.getByText('Formular demonstrativ, programarea nu a fost trimisă.')).toBeVisible();
});

test('rejects a non-test email address', async ({ page }) => {
  await page.goto('/programare');
  await page.getByLabel('Prenume').fill('Ion');
  await page.getByLabel('Email').fill('ion@example.com');
  await page.getByLabel('Marca').fill('Dacia');
  await page.getByLabel('Modelul').fill('Logan');
  await page.getByRole('button', { name: 'Trimite programarea' }).click();
  await expect(page.getByRole('status').getByText('În demo folosește o adresă de test')).toBeVisible();
});

test('phone screenshots of the public pages', async ({ page }) => {
  mkdirSync('e2e/screenshots', { recursive: true });
  for (const [path, name] of [['/', 'home'], ['/programare', 'programare'], ['/automatizari', 'automatizari']] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: true });
  }
});
