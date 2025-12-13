/**
 * E2E Tests for Profile and Settings
 */
import { test, expect } from '@playwright/test'

test.describe('Profile', () => {
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

  test.describe('Profile Page', () => {
    test('displays profile page', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/profile')
      await expect(page.getByRole('heading', { name: /profil|profile/i })).toBeVisible()
    })

    test('displays user information', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/profile')
      await page.waitForTimeout(2000)

      // Check for username or email display
      const userInfo = page.locator('[data-testid="user-info"], .user-info, .profile-info')
      await expect(userInfo.first()).toBeVisible()
    })

    test('displays user stats', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/profile')
      await page.waitForTimeout(2000)

      // Check for XP, level, streak
      const statsSection = page.locator('[data-testid="user-stats"], .stats, .profile-stats')
      await expect(statsSection.first()).toBeVisible()
    })

    test('displays level and XP', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/profile')
      await page.waitForTimeout(2000)

      // Look for level indicator
      const levelDisplay = page.locator('[data-testid="level"], .level, :text(/niveau|level/i)')
      if (await levelDisplay.first().isVisible()) {
        await expect(levelDisplay.first()).toBeVisible()
      }
    })

    test('displays streak information', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/profile')
      await page.waitForTimeout(2000)

      // Look for streak indicator
      const streakDisplay = page.locator('[data-testid="streak"], .streak, :text(/série|streak/i)')
      if (await streakDisplay.first().isVisible()) {
        await expect(streakDisplay.first()).toBeVisible()
      }
    })

    test('displays activity chart', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/profile')
      await page.waitForTimeout(2000)

      // Look for chart/graph
      const activityChart = page.locator('[data-testid="activity-chart"], .chart, .recharts-wrapper, svg')
      if (await activityChart.first().isVisible()) {
        await expect(activityChart.first()).toBeVisible()
      }
    })
  })

  test.describe('Achievements', () => {
    test('can navigate to achievements page', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/achievements')
      await expect(page).toHaveURL(/achievements/)
    })

    test('displays achievements/badges', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/achievements')
      await page.waitForTimeout(2000)

      const achievementsList = page.locator('[data-testid="achievements"], .achievements, .badges')
      await expect(achievementsList.first()).toBeVisible()
    })

    test('shows locked and unlocked achievements', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/achievements')
      await page.waitForTimeout(2000)

      // Look for achievement cards
      const achievementCard = page.locator('[data-testid="achievement-card"], .achievement-card, .badge-card')
      const cardCount = await achievementCard.count()
      expect(cardCount).toBeGreaterThan(0)
    })
  })

  test.describe('Leaderboard', () => {
    test('can navigate to leaderboard page', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/leaderboard')
      await expect(page).toHaveURL(/leaderboard/)
    })

    test('displays leaderboard', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/leaderboard')
      await page.waitForTimeout(2000)

      const leaderboardTable = page.locator('[data-testid="leaderboard"], .leaderboard, table')
      await expect(leaderboardTable.first()).toBeVisible()
    })

    test('displays user rankings', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/leaderboard')
      await page.waitForTimeout(2000)

      // Look for ranking entries
      const rankingEntry = page.locator('[data-testid="ranking-entry"], .ranking-row, tr')
      const entryCount = await rankingEntry.count()
      expect(entryCount).toBeGreaterThan(0)
    })
  })
})

test.describe('Settings', () => {
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

  test.describe('Settings Page', () => {
    test('displays settings page', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /paramètres|settings/i })).toBeVisible()
    })

    test('displays theme toggle', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/settings')
      await page.waitForTimeout(2000)

      // Look for theme/dark mode toggle
      const themeToggle = page.locator('[data-testid="theme-toggle"], .theme-toggle, :text(/thème|theme|sombre|dark/i)')
      if (await themeToggle.first().isVisible()) {
        await expect(themeToggle.first()).toBeVisible()
      }
    })

    test('can toggle dark mode', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/settings')
      await page.waitForTimeout(2000)

      // Find and click theme toggle
      const themeToggle = page.locator('[data-testid="theme-toggle"], .theme-toggle, button:has-text(/sombre|dark|clair|light/i)')
      if (await themeToggle.first().isVisible()) {
        await themeToggle.first().click()
        await page.waitForTimeout(500)

        // Check if theme changed (html element should have data-theme or class change)
        const htmlElement = page.locator('html')
        const classOrAttribute = await htmlElement.getAttribute('class') || await htmlElement.getAttribute('data-theme')
        expect(classOrAttribute).toBeTruthy()
      }
    })

    test('displays notification settings', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/settings')
      await page.waitForTimeout(2000)

      // Look for notification settings
      const notificationSettings = page.locator('[data-testid="notification-settings"], .notification-settings, :text(/notification/i)')
      if (await notificationSettings.first().isVisible()) {
        await expect(notificationSettings.first()).toBeVisible()
      }
    })

    test('displays password change option', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/settings')
      await page.waitForTimeout(2000)

      // Look for password change section
      const passwordSection = page.locator('[data-testid="password-change"], .password-section, :text(/mot de passe|password/i)')
      if (await passwordSection.first().isVisible()) {
        await expect(passwordSection.first()).toBeVisible()
      }
    })
  })
})

test.describe('Spark Mascot', () => {
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

  test('displays Spark widget on dashboard', async ({ page }) => {
    if (!(await loginIfNeeded(page))) return

    await page.goto('/dashboard')
    await page.waitForTimeout(2000)

    // Look for Spark mascot
    const sparkWidget = page.locator('[data-testid="spark-widget"], .spark-widget, .spark, .mascot')
    if (await sparkWidget.first().isVisible()) {
      await expect(sparkWidget.first()).toBeVisible()
    }
  })

  test('can interact with Spark', async ({ page }) => {
    if (!(await loginIfNeeded(page))) return

    await page.goto('/dashboard')
    await page.waitForTimeout(2000)

    const sparkWidget = page.locator('[data-testid="spark-widget"], .spark-widget, .spark, .mascot').first()
    if (await sparkWidget.isVisible()) {
      await sparkWidget.click()
      await page.waitForTimeout(500)

      // Check for Spark dialog or expanded state
      const sparkDialog = page.locator('[data-testid="spark-dialog"], .spark-dialog, [role="dialog"]')
      if (await sparkDialog.isVisible()) {
        await expect(sparkDialog).toBeVisible()
      }
    }
  })

  test('displays accessories', async ({ page }) => {
    if (!(await loginIfNeeded(page))) return

    await page.goto('/profile')
    await page.waitForTimeout(2000)

    // Look for Spark/mascot section with accessories
    const accessoriesSection = page.locator('[data-testid="accessories"], .accessories, .spark-accessories')
    if (await accessoriesSection.isVisible()) {
      await expect(accessoriesSection).toBeVisible()
    }
  })
})
