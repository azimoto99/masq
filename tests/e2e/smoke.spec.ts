import { expect, type Page, test } from '@playwright/test';

const password = 'password123';

async function registerAndCreateMask(page: Page, email: string, maskName: string) {
  await page.goto('/register');
  await page.getByTestId('register-email-input').fill(email);
  await page.getByTestId('register-password-input').fill(password);
  await page.getByTestId('register-submit-button').click();

  await expect(page).toHaveURL(/\/home$/);
  await page.getByTestId('home-open-masks-button').click();
  await expect(page).toHaveURL(/\/masks$/);

  await page.getByTestId('mask-display-name-input').fill(maskName);
  await page.getByTestId('mask-create-submit-button').click();
  await expect(page.getByText(maskName)).toBeVisible();
}

async function openRoomsFromMasks(page: Page) {
  const openRoomsButton = page.getByTestId('open-rooms-button');
  await expect(openRoomsButton).toBeEnabled();
  await openRoomsButton.click();
  await expect(page).toHaveURL(/\/rooms$/);
}

test('registers, creates mask, creates room, and sends a message', async ({ page }) => {
  const suffix = Date.now().toString();
  const email = `smoke-${suffix}@example.com`;
  const maskName = `Ghost-${suffix}`;
  const roomTitle = `Smoke Room ${suffix}`;
  const messageBody = `hello-from-smoke-${suffix}`;

  await registerAndCreateMask(page, email, maskName);
  await openRoomsFromMasks(page);

  await page.getByTestId('room-create-title-input').fill(roomTitle);
  await page.getByTestId('room-create-submit-button').click();

  await expect(page).toHaveURL(/\/rooms\/[0-9a-fA-F-]{36}$/);
  await expect(page.getByRole('heading', { level: 2, name: roomTitle })).toBeVisible();

  const composer = page.getByTestId('room-composer-textarea');
  await expect(composer).toBeEnabled({ timeout: 20_000 });
  await composer.fill(messageBody);

  await page.getByTestId('room-send-submit-button').click();
  await expect(page.getByText(messageBody)).toBeVisible();
});

test('supports realtime room exchange between two users', async ({ browser }) => {
  const suffix = Date.now().toString();
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();

  try {
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await registerAndCreateMask(pageA, `rt-a-${suffix}@example.com`, `MaskA-${suffix}`);
    await registerAndCreateMask(pageB, `rt-b-${suffix}@example.com`, `MaskB-${suffix}`);

    await openRoomsFromMasks(pageA);
    await pageA.getByTestId('room-create-title-input').fill(`Realtime Room ${suffix}`);
    await pageA.getByTestId('room-create-submit-button').click();
    await expect(pageA).toHaveURL(/\/rooms\/[0-9a-fA-F-]{36}$/);
    const roomId = pageA.url().split('/').pop();
    expect(roomId).toBeTruthy();

    await openRoomsFromMasks(pageB);
    await pageB.getByPlaceholder('Room code (UUID)').fill(roomId ?? '');
    await pageB.getByRole('button', { name: 'Join By Code' }).click();
    await expect(pageB).toHaveURL(new RegExp(`/rooms/${roomId}$`));

    const composerA = pageA.getByTestId('room-composer-textarea');
    const composerB = pageB.getByTestId('room-composer-textarea');
    await expect(composerA).toBeEnabled({ timeout: 20_000 });
    await expect(composerB).toBeEnabled({ timeout: 20_000 });

    const messageFromA = `hello-from-a-${suffix}`;
    await composerA.fill(messageFromA);
    await pageA.getByTestId('room-send-submit-button').click();
    await expect(pageB.getByText(messageFromA)).toBeVisible({ timeout: 20_000 });

    const messageFromB = `hello-from-b-${suffix}`;
    await composerB.fill(messageFromB);
    await pageB.getByTestId('room-send-submit-button').click();
    await expect(pageA.getByText(messageFromB)).toBeVisible({ timeout: 20_000 });
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
