
import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/login');
  
  const title = await page.title();
  console.log(`Page title: ${title}`);

  try {
    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Gestão Cases 2.0/);
    
    // Expect to see "Sign in"
    await expect(page.getByText('Sign in to your account')).toBeVisible();
  } catch (e) {
    const content = await page.content();
    console.log(`Page content: ${content}`);
    throw e;
  }
});
