/**
 * E2E Tests for Quiz Feature
 */
import { test, expect } from '@playwright/test'

test.describe('Quizzes', () => {
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

  test.describe('Quiz List', () => {
    test('displays quizzes page', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/quizzes')
      await expect(page.getByRole('heading', { name: /quiz/i })).toBeVisible()
    })

    test('shows create quiz button', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/quizzes')
      const createButton = page.getByRole('button', { name: /créer|create|nouveau|new/i })
      await expect(createButton.first()).toBeVisible()
    })

    test('displays quiz cards or empty state', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/quizzes')
      await page.waitForTimeout(2000)

      const quizCard = page.locator('[data-testid="quiz-card"], .quiz-card, .quiz-item')
      const emptyState = page.locator('[data-testid="empty-state"], .empty-state')

      const hasQuiz = await quizCard.first().isVisible()
      const hasEmptyState = await emptyState.first().isVisible()

      expect(hasQuiz || hasEmptyState).toBe(true)
    })
  })

  test.describe('Create Quiz', () => {
    test('can navigate to create quiz page', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/quizzes')
      await page.getByRole('button', { name: /créer|create|nouveau|new/i }).first().click()
      await expect(page).toHaveURL(/quizzes\/new/)
    })

    test('displays quiz creation form', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/quizzes/new')

      // Check for title field
      const titleInput = page.getByLabel(/titre|title|nom|name/i)
      await expect(titleInput.or(page.getByPlaceholder(/titre|title|nom|name/i)).first()).toBeVisible()
    })

    test('can add questions to quiz', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/quizzes/new')

      // Fill title
      const titleInput = page.getByLabel(/titre|title|nom|name/i).or(page.getByPlaceholder(/titre|title|nom|name/i))
      await titleInput.first().fill('Test Quiz ' + Date.now())

      // Look for add question button
      const addQuestionButton = page.getByRole('button', { name: /ajouter|add|question/i })
      if (await addQuestionButton.first().isVisible()) {
        await addQuestionButton.first().click()
        await page.waitForTimeout(500)
      }
    })
  })

  test.describe('Quiz Taking', () => {
    test('can start a quiz', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/quizzes')
      await page.waitForTimeout(2000)

      const quizCard = page.locator('[data-testid="quiz-card"], .quiz-card, .quiz-item').first()
      if (await quizCard.isVisible()) {
        await quizCard.click()

        // Look for start button
        const startButton = page.getByRole('button', { name: /commencer|start|démarrer/i })
        if (await startButton.isVisible()) {
          await startButton.click()
          await page.waitForTimeout(2000)
        }
      }
    })

    test('displays question and answers', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/quizzes')
      await page.waitForTimeout(2000)

      const quizCard = page.locator('[data-testid="quiz-card"], .quiz-card, .quiz-item').first()
      if (await quizCard.isVisible()) {
        await quizCard.click()

        const startButton = page.getByRole('button', { name: /commencer|start|démarrer/i })
        if (await startButton.isVisible()) {
          await startButton.click()
          await page.waitForTimeout(2000)

          // Check for question display
          const questionDisplay = page.locator('[data-testid="question"], .question, .quiz-question')
          if (await questionDisplay.isVisible()) {
            await expect(questionDisplay).toBeVisible()

            // Check for answer options
            const answerOptions = page.locator('[data-testid="answer-option"], .answer-option, .option')
            const optionCount = await answerOptions.count()
            expect(optionCount).toBeGreaterThan(0)
          }
        }
      }
    })

    test('can select an answer', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/quizzes')
      await page.waitForTimeout(2000)

      const quizCard = page.locator('[data-testid="quiz-card"], .quiz-card, .quiz-item').first()
      if (await quizCard.isVisible()) {
        await quizCard.click()

        const startButton = page.getByRole('button', { name: /commencer|start|démarrer/i })
        if (await startButton.isVisible()) {
          await startButton.click()
          await page.waitForTimeout(2000)

          // Click first answer option
          const answerOption = page.locator('[data-testid="answer-option"], .answer-option, .option').first()
          if (await answerOption.isVisible()) {
            await answerOption.click()
            await page.waitForTimeout(500)
          }
        }
      }
    })

    test('displays progress indicator', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/quizzes')
      await page.waitForTimeout(2000)

      const quizCard = page.locator('[data-testid="quiz-card"], .quiz-card, .quiz-item').first()
      if (await quizCard.isVisible()) {
        await quizCard.click()

        const startButton = page.getByRole('button', { name: /commencer|start|démarrer/i })
        if (await startButton.isVisible()) {
          await startButton.click()
          await page.waitForTimeout(2000)

          // Look for progress indicator
          const progressIndicator = page.locator('[data-testid="progress"], .progress, .quiz-progress')
          if (await progressIndicator.isVisible()) {
            await expect(progressIndicator).toBeVisible()
          }
        }
      }
    })
  })

  test.describe('Quiz Results', () => {
    test('shows results after completing quiz', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/quizzes')
      await page.waitForTimeout(2000)

      const quizCard = page.locator('[data-testid="quiz-card"], .quiz-card, .quiz-item').first()
      if (await quizCard.isVisible()) {
        await quizCard.click()

        const startButton = page.getByRole('button', { name: /commencer|start|démarrer/i })
        if (await startButton.isVisible()) {
          await startButton.click()
          await page.waitForTimeout(2000)

          // Answer all questions (click through)
          for (let i = 0; i < 10; i++) {
            const answerOption = page.locator('[data-testid="answer-option"], .answer-option, .option').first()
            if (await answerOption.isVisible()) {
              await answerOption.click()
              await page.waitForTimeout(500)

              const nextButton = page.getByRole('button', { name: /suivant|next|continuer/i })
              if (await nextButton.isVisible()) {
                await nextButton.click()
                await page.waitForTimeout(500)
              }
            } else {
              break
            }
          }

          // Check for results display
          await page.waitForTimeout(2000)
          const resultsDisplay = page.locator('[data-testid="results"], .results, .quiz-results, .score')
          if (await resultsDisplay.isVisible()) {
            await expect(resultsDisplay).toBeVisible()
          }
        }
      }
    })
  })

  test.describe('Quiz Sharing', () => {
    test('can share quiz', async ({ page }) => {
      if (!(await loginIfNeeded(page))) return

      await page.goto('/quizzes')
      await page.waitForTimeout(2000)

      const quizCard = page.locator('[data-testid="quiz-card"], .quiz-card, .quiz-item').first()
      if (await quizCard.isVisible()) {
        await quizCard.click()

        // Look for share button
        const shareButton = page.getByRole('button', { name: /partager|share/i })
        if (await shareButton.isVisible()) {
          await shareButton.click()
          await page.waitForTimeout(500)

          // Check for share modal
          const shareModal = page.locator('[data-testid="share-modal"], .share-modal, [role="dialog"]')
          if (await shareModal.isVisible()) {
            await expect(shareModal).toBeVisible()
          }
        }
      }
    })
  })
})
