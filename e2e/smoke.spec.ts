import { test, expect } from '@playwright/test';

test.describe('Room Manager - Public Routes & Smoke Tests', () => {
  test('Landing page renders title and CTA buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Room Manager/);
    await expect(page.getByText('Room Manager')).toBeVisible();
    await expect(page.getByRole('link', { name: /Sign in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Get Started/i })).toBeVisible();
  });

  test('Login screen renders with credentials form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/Email address/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Sign up/i })).toBeVisible();
  });

  test('Signup screen renders with registration form', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: /Create an account/i })).toBeVisible();
    await expect(page.getByLabel(/Full Name/i)).toBeVisible();
    await expect(page.getByLabel(/Email address/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Create account/i })).toBeVisible();
  });

  test('Navigation between landing and login works', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Sign in/i }).first().click();
    await expect(page).toHaveURL(/.*login/);
  });
});
