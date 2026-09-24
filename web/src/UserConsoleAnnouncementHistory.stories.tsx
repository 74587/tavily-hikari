import type { Meta, StoryObj } from '@storybook/react-vite'

import userConsoleMeta from './UserConsole.stories'

const meta = { ...userConsoleMeta, title: 'User Console/UserConsole' } satisfies typeof userConsoleMeta

export default meta

type Story = StoryObj<typeof meta>

async function waitForAnnouncementHistory(canvasElement: HTMLElement): Promise<HTMLElement> {
  const deadline = Date.now() + 4000
  while (Date.now() < deadline) {
    const history = canvasElement.ownerDocument.querySelector<HTMLElement>('.user-console-announcement-history')
    const bounds = history?.getBoundingClientRect()
    if (
      history?.getAttribute('data-state') === 'open'
      && bounds != null
      && bounds.left < window.innerWidth
      && bounds.right <= window.innerWidth + 1
      && bounds.top < window.innerHeight
      && bounds.bottom <= window.innerHeight + 1
    ) {
      return history
    }
    await new Promise((resolve) => window.setTimeout(resolve, 50))
  }
  throw new Error('Expected the announcement history drawer to finish opening within the viewport.')
}

export const ConsoleHomeAnnouncementHistory: Story = {
  name: 'Console Home Announcement History',
  args: {
    consoleView: 'Console Home',
    isAdmin: true,
    landingFocus: 'Overview Focus',
    announcementPreview: 'History Open',
  },
  globals: {
    viewport: { value: '1440-device-desktop', isRotated: false },
  },
  play: async ({ canvasElement }) => {
    const history = await waitForAnnouncementHistory(canvasElement)
    if (!history.classList.contains('user-console-announcement-history--right')) {
      throw new Error('Expected the desktop announcement drawer to open from the right.')
    }
    const bounds = history.getBoundingClientRect()
    if (bounds.height < window.innerHeight - 1 || bounds.right < window.innerWidth - 1) {
      throw new Error('Expected the desktop announcement drawer to fill the viewport height.')
    }
    const list = history.querySelector<HTMLElement>('.user-console-announcement-history-list')
    if (list == null || list.scrollHeight <= list.clientHeight || getComputedStyle(list).overflowY !== 'auto') {
      throw new Error('Expected the desktop announcement history list to scroll independently.')
    }
  },
}

export const ConsoleHomeAnnouncementHistorySmallMax: Story = {
  name: 'Console Home Announcement History Small Max',
  args: {
    consoleView: 'Console Home',
    isAdmin: false,
    landingFocus: 'Overview Focus',
    announcementPreview: 'History Open',
  },
  globals: {
    viewport: { value: '0767-breakpoint-small-max', isRotated: false },
  },
  play: async ({ canvasElement }) => {
    const history = await waitForAnnouncementHistory(canvasElement)
    if (history == null || !history.classList.contains('user-console-announcement-history--bottom')) {
      throw new Error('Expected the 767px announcement drawer to open from the bottom.')
    }
    if (history.getBoundingClientRect().bottom < window.innerHeight - 1) {
      throw new Error('Expected the 767px announcement drawer to meet the bottom viewport edge.')
    }
    const list = history.querySelector<HTMLElement>('.user-console-announcement-history-list')
    if (list == null || list.scrollHeight <= list.clientHeight || getComputedStyle(list).overflowY !== 'auto') {
      throw new Error('Expected the 767px announcement history list to scroll independently.')
    }
  },
}

export const ConsoleHomeAnnouncementHistoryDesktopMin: Story = {
  name: 'Console Home Announcement History Desktop Min',
  args: {
    consoleView: 'Console Home',
    isAdmin: false,
    landingFocus: 'Overview Focus',
    announcementPreview: 'History Open',
  },
  globals: {
    viewport: { value: '0768-device-ipad', isRotated: false },
  },
  play: async ({ canvasElement }) => {
    const history = await waitForAnnouncementHistory(canvasElement)
    if (history == null || !history.classList.contains('user-console-announcement-history--right')) {
      throw new Error('Expected the 768px announcement drawer to open from the right.')
    }
    const bounds = history.getBoundingClientRect()
    if (bounds.height < window.innerHeight - 1 || bounds.right < window.innerWidth - 1) {
      throw new Error('Expected the 768px announcement drawer to fill the viewport height.')
    }
  },
}

export const ConsoleHomeAnnouncementHistoryMarkRead: Story = {
  name: 'Console Home Announcement History Mark Read',
  args: {
    consoleView: 'Console Home',
    isAdmin: false,
    landingFocus: 'Overview Focus',
    announcementPreview: 'History Unread Ticker',
  },
  globals: {
    viewport: { value: '1440-device-desktop', isRotated: false },
  },
  play: async ({ canvasElement }) => {
    await waitForAnnouncementHistory(canvasElement)
    const document = canvasElement.ownerDocument
    const historyItem = Array.from(document.querySelectorAll<HTMLElement>('.user-console-announcement-history-item'))
      .find((item) => item.textContent?.includes('Quota refresh'))
    const markRead = Array.from(historyItem?.querySelectorAll<HTMLButtonElement>('button') ?? [])
      .find((button) => button.textContent?.includes('Mark as read'))
    if (historyItem == null || markRead == null) {
      throw new Error('Expected an unread published ticker to provide a Mark as read action.')
    }
    markRead.click()
    await new Promise((resolve) => window.setTimeout(resolve, 160))
    if (document.querySelector('.user-console-announcement-ticker') != null) {
      throw new Error('Expected marking the active ticker read to hide the current banner.')
    }
    const trigger = document.querySelector<HTMLButtonElement>('.user-console-announcements-trigger')
    if (trigger?.getAttribute('aria-label') !== 'Announcements') {
      throw new Error('Expected marking the active ticker read to clear the unread header count.')
    }
    if (historyItem.querySelector('button') != null || !historyItem.textContent?.includes('Handled')) {
      throw new Error('Expected the history entry to show handled time after marking it read.')
    }
  },
}

export const ConsoleHomeAnnouncementHistoryReadTicker: Story = {
  name: 'Console Home Announcement History Read Ticker',
  args: {
    consoleView: 'Console Home',
    isAdmin: false,
    landingFocus: 'Overview Focus',
    announcementPreview: 'History Read Ticker',
  },
  globals: {
    viewport: { value: '1440-device-desktop', isRotated: false },
  },
  play: async ({ canvasElement }) => {
    await waitForAnnouncementHistory(canvasElement)
    const historyItem = Array.from(
      canvasElement.ownerDocument.querySelectorAll<HTMLElement>('.user-console-announcement-history-item'),
    ).find((item) => item.textContent?.includes('Quota refresh'))
    if (historyItem == null || historyItem.querySelector('button') != null) {
      throw new Error('Expected an already handled ticker to have no mark-read action.')
    }
    if (!historyItem.textContent?.includes('Handled')) {
      throw new Error('Expected an already handled ticker to show a handled timestamp.')
    }
  },
}

export const ConsoleHomeAnnouncementHistoryEmpty: Story = {
  name: 'Console Home Announcement History Empty',
  args: {
    consoleView: 'Console Home',
    isAdmin: false,
    landingFocus: 'Overview Focus',
    announcementPreview: 'History Empty',
  },
  globals: {
    viewport: { value: '1440-device-desktop', isRotated: false },
  },
  play: async ({ canvasElement }) => {
    const history = await waitForAnnouncementHistory(canvasElement)
    if (!history.textContent?.includes('No announcements yet.')) {
      throw new Error('Expected an explicit empty announcement history state.')
    }
  },
}

export const ConsoleHomeAnnouncementHistoryUntitled: Story = {
  name: 'Console Home Announcement History Untitled',
  args: {
    consoleView: 'Console Home',
    isAdmin: true,
    landingFocus: 'Overview Focus',
    announcementPreview: 'Ticker Untitled',
  },
  parameters: {
    viewport: { defaultViewport: '1440-device-desktop' },
  },
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => window.setTimeout(resolve, 180))
    document.querySelector<HTMLButtonElement>('.user-console-announcements-trigger')?.click()
    await new Promise((resolve) => window.setTimeout(resolve, 180))

    const history = canvasElement.ownerDocument.querySelector<HTMLElement>('.user-console-announcement-history')
    if (history == null) {
      throw new Error('Expected untitled announcement history drawer to render.')
    }
    const firstItemText = history.querySelector('.user-console-announcement-history-item')?.textContent ?? ''
    if (!firstItemText.includes('Check the status page for live updates.')) {
      throw new Error('Expected untitled announcement history to render full content.')
    }
    if (firstItemText.includes('Untitled')) {
      throw new Error('Expected untitled announcement history to avoid generating a fake title.')
    }
  },
}
