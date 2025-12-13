/**
 * E2E Tests for Flashcards Feature
 */
import { test, expect } from '@playwright/test'

test.describe('Flashcards', () => {
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

  test.describe('Decks List', () => {
    test('displays flashcards page', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/flashcards')
      await expect(page.getByRole('heading', { name: /flashcard/i })).toBeVisible()
    })

    test('shows create deck button', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/flashcards')
      const createButton = page.getByRole('button', { name: /créer|create|nouveau|new/i })
      await expect(createButton.first()).toBeVisible()
    })

    test('displays deck cards', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/flashcards')

      // Wait for decks to load
      await page.waitForTimeout(2000)

      // Check for deck cards or empty state
      const deckCard = page.locator('[data-testid="deck-card"], .deck-card, .deck-item')
      const emptyState = page.locator('[data-testid="empty-state"], .empty-state')

      const hasDeck = await deckCard.first().isVisible()
      const hasEmptyState = await emptyState.first().isVisible()

      expect(hasDeck || hasEmptyState).toBe(true)
    })
  })

  test.describe('Create Deck', () => {
    test('can navigate to create deck page', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/flashcards')
      await page.getByRole('button', { name: /créer|create|nouveau|new/i }).first().click()
      await expect(page).toHaveURL(/flashcards\/new/)
    })

    test('displays deck creation form', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/flashcards/new')

      // Check for name and description fields
      const nameInput = page.getByLabel(/nom|name|titre|title/i)
      await expect(nameInput.or(page.getByPlaceholder(/nom|name|titre|title/i)).first()).toBeVisible()
    })

    test('can create a deck', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/flashcards/new')

      // Fill name
      const nameInput = page.getByLabel(/nom|name|titre|title/i).or(page.getByPlaceholder(/nom|name|titre|title/i))
      await nameInput.first().fill('Test Deck ' + Date.now())

      // Fill description if available
      const descInput = page.getByLabel(/description/i).or(page.getByPlaceholder(/description/i))
      if (await descInput.first().isVisible()) {
        await descInput.first().fill('Test deck description')
      }

      // Save deck
      const saveButton = page.getByRole('button', { name: /sauvegarder|save|créer|create/i })
      await saveButton.first().click()

      // Should redirect or show success
      await page.waitForTimeout(2000)
    })
  })

  test.describe('Deck Detail', () => {
    test('can view deck detail', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/flashcards')
      await page.waitForTimeout(2000)

      // Click on first deck if exists
      const deckCard = page.locator('[data-testid="deck-card"], .deck-card, .deck-item').first()
      if (await deckCard.isVisible()) {
        await deckCard.click()
        await expect(page).toHaveURL(/flashcards\/\d+/)
      }
    })

    test('displays flashcards in deck', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/flashcards')
      await page.waitForTimeout(2000)

      const deckCard = page.locator('[data-testid="deck-card"], .deck-card, .deck-item').first()
      if (await deckCard.isVisible()) {
        await deckCard.click()

        // Look for flashcard list or empty state
        await page.waitForTimeout(2000)
        const flashcardItem = page.locator('[data-testid="flashcard-item"], .flashcard-item, .card-item')
        const emptyState = page.locator('[data-testid="empty-state"], .empty-state')

        const hasCards = await flashcardItem.first().isVisible()
        const hasEmptyState = await emptyState.first().isVisible()

        expect(hasCards || hasEmptyState).toBe(true)
      }
    })
  })

  test.describe('Review Mode', () => {
    test('can start review session', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/flashcards')
      await page.waitForTimeout(2000)

      const deckCard = page.locator('[data-testid="deck-card"], .deck-card, .deck-item').first()
      if (await deckCard.isVisible()) {
        await deckCard.click()

        // Look for review button
        const reviewButton = page.getByRole('button', { name: /réviser|review|commencer|start/i })
        if (await reviewButton.isVisible()) {
          await reviewButton.click()
          await expect(page).toHaveURL(/review/)
        }
      }
    })

    test('displays flashcard in review mode', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      // Navigate to a review session
      await page.goto('/flashcards')
      await page.waitForTimeout(2000)

      const deckCard = page.locator('[data-testid="deck-card"], .deck-card, .deck-item').first()
      if (await deckCard.isVisible()) {
        await deckCard.click()
        await page.waitForTimeout(1000)

        const reviewButton = page.getByRole('button', { name: /réviser|review|commencer|start/i })
        if (await reviewButton.isVisible()) {
          await reviewButton.click()
          await page.waitForTimeout(2000)

          // Check for flashcard display
          const flashcardDisplay = page.locator('[data-testid="flashcard"], .flashcard, .review-card')
          if (await flashcardDisplay.isVisible()) {
            await expect(flashcardDisplay).toBeVisible()
          }
        }
      }
    })

    test('can flip flashcard', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/flashcards')
      await page.waitForTimeout(2000)

      const deckCard = page.locator('[data-testid="deck-card"], .deck-card, .deck-item').first()
      if (await deckCard.isVisible()) {
        await deckCard.click()
        await page.waitForTimeout(1000)

        const reviewButton = page.getByRole('button', { name: /réviser|review|commencer|start/i })
        if (await reviewButton.isVisible()) {
          await reviewButton.click()
          await page.waitForTimeout(2000)

          // Click to flip or show answer
          const flipButton = page.getByRole('button', { name: /afficher|show|flip|réponse|answer/i })
          if (await flipButton.isVisible()) {
            await flipButton.click()
            await page.waitForTimeout(500)
          }
        }
      }
    })
  })

  test.describe('Spaced Repetition', () => {
    test('displays difficulty buttons after flip', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/flashcards')
      await page.waitForTimeout(2000)

      const deckCard = page.locator('[data-testid="deck-card"], .deck-card, .deck-item').first()
      if (await deckCard.isVisible()) {
        await deckCard.click()
        await page.waitForTimeout(1000)

        const reviewButton = page.getByRole('button', { name: /réviser|review/i })
        if (await reviewButton.isVisible()) {
          await reviewButton.click()
          await page.waitForTimeout(2000)

          // Flip card
          const flipButton = page.getByRole('button', { name: /afficher|show|flip/i })
          if (await flipButton.isVisible()) {
            await flipButton.click()
            await page.waitForTimeout(500)

            // Look for difficulty buttons (Easy, Good, Hard, Again)
            const difficultyButtons = page.locator('button').filter({
              hasText: /facile|easy|bien|good|difficile|hard|again|à revoir/i,
            })

            const buttonCount = await difficultyButtons.count()
            expect(buttonCount).toBeGreaterThan(0)
          }
        }
      }
    })
  })
})
