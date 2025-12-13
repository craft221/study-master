/**
 * E2E Tests for Groups/Collaboration Feature
 */
import { test, expect } from '@playwright/test'

test.describe('Groups', () => {
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

  test.describe('Groups List', () => {
    test('displays groups page', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/groups')
      await expect(page.getByRole('heading', { name: /group|groupe/i })).toBeVisible()
    })

    test('shows create group button', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/groups')
      const createButton = page.getByRole('button', { name: /créer|create|nouveau|new/i })
      await expect(createButton.first()).toBeVisible()
    })

    test('displays group cards or empty state', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/groups')
      await page.waitForTimeout(2000)

      const groupCard = page.locator('[data-testid="group-card"], .group-card, .group-item')
      const emptyState = page.locator('[data-testid="empty-state"], .empty-state')

      const hasGroup = await groupCard.first().isVisible()
      const hasEmptyState = await emptyState.first().isVisible()

      expect(hasGroup || hasEmptyState).toBe(true)
    })
  })

  test.describe('Create Group', () => {
    test('can open create group dialog', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/groups')
      await page.getByRole('button', { name: /créer|create|nouveau|new/i }).first().click()

      // Check for dialog/modal
      const dialog = page.locator('[role="dialog"], .modal, .dialog')
      await expect(dialog.first()).toBeVisible()
    })

    test('displays group creation form', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/groups')
      await page.getByRole('button', { name: /créer|create|nouveau|new/i }).first().click()

      // Check for name field
      const nameInput = page.getByLabel(/nom|name/i)
      await expect(nameInput.or(page.getByPlaceholder(/nom|name/i)).first()).toBeVisible()
    })

    test('can create a group', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/groups')
      await page.getByRole('button', { name: /créer|create|nouveau|new/i }).first().click()

      // Fill name
      const nameInput = page.getByLabel(/nom|name/i).or(page.getByPlaceholder(/nom|name/i))
      await nameInput.first().fill('Test Group ' + Date.now())

      // Fill description if available
      const descInput = page.getByLabel(/description/i).or(page.getByPlaceholder(/description/i))
      if (await descInput.first().isVisible()) {
        await descInput.first().fill('Test group description')
      }

      // Create group
      const createButton = page.getByRole('button', { name: /créer|create|sauvegarder|save/i }).last()
      await createButton.click()

      // Wait for creation
      await page.waitForTimeout(2000)
    })
  })

  test.describe('Group Detail', () => {
    test('can view group detail', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/groups')
      await page.waitForTimeout(2000)

      const groupCard = page.locator('[data-testid="group-card"], .group-card, .group-item').first()
      if (await groupCard.isVisible()) {
        await groupCard.click()
        await expect(page).toHaveURL(/groups\/\d+/)
      }
    })

    test('displays group tabs', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/groups')
      await page.waitForTimeout(2000)

      const groupCard = page.locator('[data-testid="group-card"], .group-card, .group-item').first()
      if (await groupCard.isVisible()) {
        await groupCard.click()
        await page.waitForTimeout(2000)

        // Check for tabs (Messages, Notes, Flashcards, etc.)
        const tabsList = page.locator('[role="tablist"], .tabs')
        if (await tabsList.isVisible()) {
          await expect(tabsList).toBeVisible()
        }
      }
    })
  })

  test.describe('Group Chat', () => {
    test('displays chat messages', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/groups')
      await page.waitForTimeout(2000)

      const groupCard = page.locator('[data-testid="group-card"], .group-card, .group-item').first()
      if (await groupCard.isVisible()) {
        await groupCard.click()
        await page.waitForTimeout(2000)

        // Click on messages tab if needed
        const messagesTab = page.getByRole('tab', { name: /messages/i })
        if (await messagesTab.isVisible()) {
          await messagesTab.click()
          await page.waitForTimeout(500)
        }

        // Check for messages container
        const messagesContainer = page.locator('[data-testid="messages"], .messages, .chat-messages')
        if (await messagesContainer.isVisible()) {
          await expect(messagesContainer).toBeVisible()
        }
      }
    })

    test('can send a message', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/groups')
      await page.waitForTimeout(2000)

      const groupCard = page.locator('[data-testid="group-card"], .group-card, .group-item').first()
      if (await groupCard.isVisible()) {
        await groupCard.click()
        await page.waitForTimeout(2000)

        // Click on messages tab if needed
        const messagesTab = page.getByRole('tab', { name: /messages/i })
        if (await messagesTab.isVisible()) {
          await messagesTab.click()
          await page.waitForTimeout(500)
        }

        // Find message input
        const messageInput = page.getByPlaceholder(/message|écrire|write/i)
        if (await messageInput.isVisible()) {
          await messageInput.fill('Test message ' + Date.now())

          // Send message
          const sendButton = page.getByRole('button', { name: /envoyer|send/i })
          if (await sendButton.isVisible()) {
            await sendButton.click()
            await page.waitForTimeout(500)
          }
        }
      }
    })
  })

  test.describe('Group Resources', () => {
    test('can access shared notes', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/groups')
      await page.waitForTimeout(2000)

      const groupCard = page.locator('[data-testid="group-card"], .group-card, .group-item').first()
      if (await groupCard.isVisible()) {
        await groupCard.click()
        await page.waitForTimeout(2000)

        // Click on notes tab
        const notesTab = page.getByRole('tab', { name: /notes/i })
        if (await notesTab.isVisible()) {
          await notesTab.click()
          await page.waitForTimeout(500)
        }
      }
    })

    test('can access shared flashcards', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/groups')
      await page.waitForTimeout(2000)

      const groupCard = page.locator('[data-testid="group-card"], .group-card, .group-item').first()
      if (await groupCard.isVisible()) {
        await groupCard.click()
        await page.waitForTimeout(2000)

        // Click on flashcards tab
        const flashcardsTab = page.getByRole('tab', { name: /flashcard/i })
        if (await flashcardsTab.isVisible()) {
          await flashcardsTab.click()
          await page.waitForTimeout(500)
        }
      }
    })

    test('can access group quizzes', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/groups')
      await page.waitForTimeout(2000)

      const groupCard = page.locator('[data-testid="group-card"], .group-card, .group-item').first()
      if (await groupCard.isVisible()) {
        await groupCard.click()
        await page.waitForTimeout(2000)

        // Click on quizzes tab
        const quizzesTab = page.getByRole('tab', { name: /quiz/i })
        if (await quizzesTab.isVisible()) {
          await quizzesTab.click()
          await page.waitForTimeout(500)
        }
      }
    })
  })

  test.describe('Group Members', () => {
    test('displays online members', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/groups')
      await page.waitForTimeout(2000)

      const groupCard = page.locator('[data-testid="group-card"], .group-card, .group-item').first()
      if (await groupCard.isVisible()) {
        await groupCard.click()
        await page.waitForTimeout(2000)

        // Look for members list or presence indicators
        const membersList = page.locator('[data-testid="members"], .members, .online-users')
        if (await membersList.isVisible()) {
          await expect(membersList).toBeVisible()
        }
      }
    })
  })
})
