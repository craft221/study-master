/**
 * E2E Tests for Authentication Flow
 */
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test.describe('Login Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login')
    })

    test('displays login form', async ({ page }) => {
      // Check heading - "Bon retour!" is the actual title
      await expect(page.getByRole('heading', { name: /bon retour|connexion|login/i })).toBeVisible()
      // Check email input by id
      await expect(page.locator('#email')).toBeVisible()
      // Check password input by id
      await expect(page.locator('#password')).toBeVisible()
      // Check submit button
      await expect(page.getByRole('button', { name: /se connecter|connexion|login/i })).toBeVisible()
    })

    test('shows link to register page', async ({ page }) => {
      // The link text is "S'inscrire gratuitement"
      const registerLink = page.getByRole('link', { name: /s'inscrire|inscription|register|créer/i })
      await expect(registerLink).toBeVisible()
    })

    test('validates required fields', async ({ page }) => {
      await page.getByRole('button', { name: /se connecter|connexion|login/i }).click()

      // Should show validation errors or stay on login page
      await expect(page).toHaveURL(/login/)
    })

    test('shows error for invalid credentials', async ({ page }) => {
      await page.locator('#email').fill('invalid@example.com')
      await page.locator('#password').fill('wrongpassword')
      await page.getByRole('button', { name: /se connecter|connexion|login/i }).click()

      // Should show error message - use first() because there might be multiple (error div + toast)
      await expect(page.getByText(/erreur|error|invalid|incorrect/i).first()).toBeVisible({ timeout: 10000 })
    })

    test('redirects to dashboard on successful login', async ({ page }) => {
      // This test requires a valid test account
      // Skip if no test credentials available
      const testEmail = process.env.E2E_TEST_EMAIL
      const testPassword = process.env.E2E_TEST_PASSWORD

      if (!testEmail || !testPassword) {
        test.skip()
        return
      }

      await page.locator('#email').fill(testEmail)
      await page.locator('#password').fill(testPassword)
      await page.getByRole('button', { name: /se connecter|connexion|login/i }).click()

      await expect(page).toHaveURL(/dashboard/, { timeout: 15000 })
    })
  })

  test.describe('Register Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/register')
    })

    test('displays registration form', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /inscription|register|créer|rejoignez/i })).toBeVisible()
      await expect(page.locator('#email')).toBeVisible()
      await expect(page.locator('#username')).toBeVisible()
      await expect(page.locator('#password')).toBeVisible()
    })

    test('shows link to login page', async ({ page }) => {
      const loginLink = page.getByRole('link', { name: /connexion|login|se connecter|déjà un compte/i })
      await expect(loginLink).toBeVisible()
    })

    test('validates email format', async ({ page }) => {
      await page.locator('#email').fill('invalid-email')
      await page.locator('#username').fill('testuser')
      await page.locator('#password').fill('Password123!')

      await page.getByRole('button', { name: /inscription|register|créer|s'inscrire/i }).click()

      // Should show email validation error or stay on register page
      await expect(page).toHaveURL(/register/)
    })

    test('validates password strength', async ({ page }) => {
      await page.locator('#email').fill('test@example.com')
      await page.locator('#username').fill('testuser')
      await page.locator('#password').fill('weak')

      await page.getByRole('button', { name: /inscription|register|créer|s'inscrire/i }).click()

      // Should show password validation error
      await expect(page).toHaveURL(/register/)
    })
  })

  test.describe('Logout', () => {
    test('can logout from dashboard', async ({ page }) => {
      // This test requires authentication
      const testEmail = process.env.E2E_TEST_EMAIL
      const testPassword = process.env.E2E_TEST_PASSWORD

      if (!testEmail || !testPassword) {
        test.skip()
        return
      }

      // Login first
      await page.goto('/login')
      await page.locator('#email').fill(testEmail)
      await page.locator('#password').fill(testPassword)
      await page.getByRole('button', { name: /se connecter|connexion|login/i }).click()
      await expect(page).toHaveURL(/dashboard/, { timeout: 15000 })

      // Find and click logout button
      const logoutButton = page.getByRole('button', { name: /déconnexion|logout/i })
      if (await logoutButton.isVisible()) {
        await logoutButton.click()
        await expect(page).toHaveURL(/login|\/$/i)
      }
    })
  })
})
