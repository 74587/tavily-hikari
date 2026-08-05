import { chromium } from 'playwright-core'

const captures = [
  {
    name: 'pressure-desktop.png',
    storyPath: '/iframe.html?id=admin-pages--pressure&viewMode=story',
    viewport: { width: 1440, height: 2200 },
  },
  {
    name: 'pressure-mobile.png',
    storyPath: '/iframe.html?id=admin-pages--pressure-mobile&viewMode=story',
    viewport: { width: 390, height: 2600 },
  },
]

const baseUrl = process.env.STORYBOOK_BASE_URL ?? 'http://127.0.0.1:54590'
const outputDir =
  process.env.OUTPUT_DIR ??
  'docs/specs/admin-pressure-curves/assets'

const browser = await chromium.launch({ headless: true })

try {
  for (const capture of captures) {
    const page = await browser.newPage({ viewport: capture.viewport, deviceScaleFactor: 2 })
    await page.goto(`${baseUrl}${capture.storyPath}`, { waitUntil: 'load', timeout: 60000 })
    await page.locator('.admin-layout').waitFor({ state: 'visible', timeout: 30000 })
    await page.locator('[data-testid="pressure-analysis-screen"]').waitFor({
      state: 'visible',
      timeout: 30000,
    })
    const clip = await page.evaluate(() => {
      const adminLayout = document.querySelector('.admin-layout')
      const pressurePage = document.querySelector('[data-testid="pressure-analysis-screen"]')
      if (!(adminLayout instanceof HTMLElement) || !(pressurePage instanceof HTMLElement)) {
        throw new Error('pressure capture target missing')
      }
      const layoutRect = adminLayout.getBoundingClientRect()
      const pressureRect = pressurePage.getBoundingClientRect()
      const padding = 24
      const x = Math.max(0, Math.floor(layoutRect.left))
      const y = Math.max(0, Math.floor(layoutRect.top))
      const width = Math.ceil(layoutRect.width)
      const height = Math.ceil(pressureRect.bottom - layoutRect.top + padding)
      return { x, y, width, height }
    })
    await page.screenshot({
      path: `${outputDir}/${capture.name}`,
      clip,
    })
    await page.close()
  }
} finally {
  await browser.close()
}
