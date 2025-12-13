/**
 * Global setup for Playwright E2E tests
 * Runs once before all tests
 */
import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use

  console.log('Starting global setup...')
  console.log(`Base URL: ${baseURL}`)

  // Optionally create a test user or setup test data
  // This runs once before all tests

  // Check if app is running
  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    await page.goto(baseURL || 'http://localhost:3000', { timeout: 30000 })
    console.log('Application is accessible')
  } catch (error) {
    console.error('Application is not accessible. Make sure the dev server is running.')
    console.error(error)
  } finally {
    await browser.close()
  }

  console.log('Global setup complete')
}

export default globalSetup
