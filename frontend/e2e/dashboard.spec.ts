/**
 * E2E Tests for Dashboard
 */
import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  // Helper to login before tests
  async function loginIfNeeded(page: any) {
    const testEmail = process.env.E2E_TEST_EMAIL
    const testPassword = process.env.E2E_TEST_PASSWORD

    if (!testEmail || !testPassword) {
      test.skip()
      return false
    }

    await page.goto('/login')
    await page.getByLabel(/email/i).fill(testEmail)
    await page.getByLabel(/mot de passe|password/i).fill(testPassword)
    await page.getByRole('button', { name: /connexion|login|se connecter/i }).click()
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 })
    return true
  }

  test.describe('Dashboard Layout', () => {
    test('displays main navigation', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      // Check for main navigation elements
      await expect(page.getByRole('navigation')).toBeVisible()
    })

    test('displays user stats', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      // Look for XP, level, or streak indicators
      const statsSection = page.locator('[data-testid="user-stats"], .stats, .user-info')
      await expect(statsSection.first()).toBeVisible({ timeout: 10000 })
    })

    test('displays quick actions', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      // Look for quick action buttons/cards
      const quickActions = page.locator('[data-testid="quick-actions"], .quick-actions')
      await expect(quickActions.first()).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Navigation', () => {
    test('can navigate to notes', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.getByRole('link', { name: /notes/i }).click()
      await expect(page).toHaveURL(/notes/)
    })

    test('can navigate to flashcards', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.getByRole('link', { name: /flashcards/i }).click()
      await expect(page).toHaveURL(/flashcards/)
    })

    test('can navigate to quizzes', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.getByRole('link', { name: /quiz/i }).click()
      await expect(page).toHaveURL(/quiz/)
    })

    test('can navigate to groups', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.getByRole('link', { name: /group|groupe/i }).click()
      await expect(page).toHaveURL(/groups/)
    })

    test('can navigate to profile', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.getByRole('link', { name: /profil|profile/i }).click()
      await expect(page).toHaveURL(/profile/)
    })

    test('can navigate to settings', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.getByRole('link', { name: /paramètres|settings/i }).click()
      await expect(page).toHaveURL(/settings/)
    })
  })

  test.describe('Spark Mascot', () => {
    test('displays Spark widget', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      // Look for Spark mascot widget
      const sparkWidget = page.locator('[data-testid="spark-widget"], .spark-widget, .spark')
      await expect(sparkWidget.first()).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Responsive Design', () => {
    test('displays mobile menu on small screens', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })

      // Look for mobile menu button
      const menuButton = page.getByRole('button', { name: /menu/i })
      if (await menuButton.isVisible()) {
        await menuButton.click()
        // Navigation should be visible after clicking
        await expect(page.getByRole('navigation')).toBeVisible()
      }
    })
  })
})
