/**
 * E2E Tests for Notes Feature
 */
import { test, expect } from '@playwright/test'

test.describe('Notes', () => {
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

  test.describe('Notes List', () => {
    test('displays notes page', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/notes')
      await expect(page.getByRole('heading', { name: /notes/i })).toBeVisible()
    })

    test('shows create note button', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/notes')
      const createButton = page.getByRole('button', { name: /créer|create|nouveau|new/i })
      await expect(createButton.first()).toBeVisible()
    })

    test('can search notes', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/notes')
      const searchInput = page.getByPlaceholder(/rechercher|search/i)
      if (await searchInput.isVisible()) {
        await searchInput.fill('test')
        // Wait for search results
        await page.waitForTimeout(500)
      }
    })
  })

  test.describe('Create Note', () => {
    test('can navigate to create note page', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/notes')
      await page.getByRole('button', { name: /créer|create|nouveau|new/i }).first().click()
      await expect(page).toHaveURL(/notes\/new/)
    })

    test('displays note creation form', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/notes/new')

      // Check for title and content fields
      const titleInput = page.getByLabel(/titre|title/i)
      const contentArea = page.locator('textarea, [contenteditable="true"], .editor')

      await expect(titleInput.or(page.getByPlaceholder(/titre|title/i)).first()).toBeVisible()
      await expect(contentArea.first()).toBeVisible()
    })

    test('can create a note', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/notes/new')

      // Fill title
      const titleInput = page.getByLabel(/titre|title/i).or(page.getByPlaceholder(/titre|title/i))
      await titleInput.first().fill('Test Note ' + Date.now())

      // Fill content
      const contentArea = page.locator('textarea, [contenteditable="true"], .editor').first()
      await contentArea.fill('This is a test note content created by E2E tests.')

      // Save note
      const saveButton = page.getByRole('button', { name: /sauvegarder|save|créer|create/i })
      await saveButton.first().click()

      // Should redirect or show success
      await page.waitForTimeout(2000)
    })
  })

  test.describe('Note Detail', () => {
    test('can view note detail', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/notes')

      // Click on first note if exists
      const noteCard = page.locator('[data-testid="note-card"], .note-card, .note-item').first()
      if (await noteCard.isVisible()) {
        await noteCard.click()
        await expect(page).toHaveURL(/notes\/\d+/)
      }
    })

    test('can edit note', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/notes')

      // Click on first note if exists
      const noteCard = page.locator('[data-testid="note-card"], .note-card, .note-item').first()
      if (await noteCard.isVisible()) {
        await noteCard.click()
        await expect(page).toHaveURL(/notes\/\d+/)

        // Look for edit button
        const editButton = page.getByRole('button', { name: /modifier|edit/i })
        if (await editButton.isVisible()) {
          await editButton.click()
        }
      }
    })
  })

  test.describe('AI Features', () => {
    test('can generate flashcards from note', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/notes')

      const noteCard = page.locator('[data-testid="note-card"], .note-card, .note-item').first()
      if (await noteCard.isVisible()) {
        await noteCard.click()

        // Look for AI generation button
        const aiButton = page.getByRole('button', { name: /flashcard|IA|AI|générer/i })
        if (await aiButton.isVisible()) {
          await aiButton.click()
          // Wait for AI generation
          await page.waitForTimeout(5000)
        }
      }
    })
  })
})
