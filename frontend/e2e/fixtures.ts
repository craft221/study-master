/**
 * Shared fixtures and helpers for E2E tests
 */
import { test as base, expect } from '@playwright/test'

// Test data
export const testUser = {
  email: process.env.E2E_TEST_EMAIL || 'test@example.com',
  password: process.env.E2E_TEST_PASSWORD || 'TestPassword123!',
  username: 'testuser',
}

// Extended test with authentication
export const test = base.extend({
  // Authenticated page fixture
  authenticatedPage: async ({ page }, use) => {
    // Skip if no credentials
    if (!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD) {
      await use(page)
      return
    }

    // Login
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(process.env.E2E_TEST_EMAIL)
    await page.getByLabel(/mot de passe|password/i).fill(process.env.E2E_TEST_PASSWORD)
    await page.getByRole('button', { name: /connexion|login|se connecter/i }).click()

    // Wait for dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 })

    await use(page)
  },
})

// Re-export expect
export { expect }

// Helper functions
export async function login(page: any, email?: string, password?: string) {
  const testEmail = email || process.env.E2E_TEST_EMAIL
  const testPassword = password || process.env.E2E_TEST_PASSWORD

  if (!testEmail || !testPassword) {
    throw new Error('No test credentials provided')
  }

  await page.goto('/login')
  await page.getByLabel(/email/i).fill(testEmail)
  await page.getByLabel(/mot de passe|password/i).fill(testPassword)
  await page.getByRole('button', { name: /connexion|login|se connecter/i }).click()
  await expect(page).toHaveURL(/dashboard/, { timeout: 15000 })
}

export async function logout(page: any) {
  const logoutButton = page.getByRole('button', { name: /déconnexion|logout/i })
  if (await logoutButton.isVisible()) {
    await logoutButton.click()
    await expect(page).toHaveURL(/login|\/$/i)
  }
}

export async function navigateTo(page: any, path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
}

export async function waitForToast(page: any, text?: string) {
  const toast = page.locator('[data-testid="toast"], .toast, [role="alert"]')
  await expect(toast.first()).toBeVisible({ timeout: 5000 })
  if (text) {
    await expect(toast.first()).toContainText(text)
  }
}

export async function fillForm(page: any, fields: Record<string, string>) {
  for (const [label, value] of Object.entries(fields)) {
    const input = page.getByLabel(new RegExp(label, 'i'))
    if (await input.isVisible()) {
      await input.fill(value)
    }
  }
}

export async function submitForm(page: any, buttonText?: string) {
  const submitButton = buttonText
    ? page.getByRole('button', { name: new RegExp(buttonText, 'i') })
    : page.getByRole('button', { name: /submit|save|create|send|sauvegarder|créer|envoyer/i })
  await submitButton.click()
}
