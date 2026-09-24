import '../../test/happydom'

import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import type { Announcement } from '../api'
import { EN } from './text'
import UserConsoleAnnouncements from './Announcements'

function tickerAnnouncement(patch: Partial<Announcement> = {}): Announcement {
  return {
    id: 'ann-ticker-1',
    content: '# Quota refreshed\n\nDaily quota counters have refreshed.',
    displayKind: 'ticker',
    status: 'published',
    createdAt: 1,
    updatedAt: 2,
    publishedAt: 2,
    archivedAt: null,
    ...patch,
  }
}

async function renderAnnouncements({
  activeAnnouncements = [tickerAnnouncement()],
  historyAnnouncements = [],
  closedRecords = {},
  historyOpen = false,
  onHistoryOpenChange = mock(() => {}),
  onCloseAnnouncement = mock(() => {}),
}: {
  activeAnnouncements?: Announcement[]
  historyAnnouncements?: Announcement[]
  closedRecords?: Record<string, number>
  historyOpen?: boolean
  onHistoryOpenChange?: ReturnType<typeof mock>
  onCloseAnnouncement?: ReturnType<typeof mock>
} = {}): Promise<{ root: Root; onCloseAnnouncement: ReturnType<typeof mock> }> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <UserConsoleAnnouncements
        language="en"
        text={EN}
        activeAnnouncements={activeAnnouncements}
        historyAnnouncements={historyAnnouncements}
        closedRecords={closedRecords}
        historyOpen={historyOpen}
        onHistoryOpenChange={onHistoryOpenChange}
        onCloseAnnouncement={onCloseAnnouncement}
      />,
    )
  })

  return { root, onCloseAnnouncement }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('UserConsoleAnnouncements', () => {
  it('opens ticker details instead of dismissing when body content exists', async () => {
    const item = tickerAnnouncement()
    const { root, onCloseAnnouncement } = await renderAnnouncements({ activeAnnouncements: [item] })

    const ticker = document.querySelector<HTMLElement>('.user-console-announcement-ticker')
    expect(ticker?.textContent).toContain('Quota refreshed')
    expect(ticker?.textContent).not.toContain('Daily quota counters have refreshed.')

    const detailButton = document.querySelector<HTMLButtonElement>(
      `button[aria-label="${EN.announcements.tickerOpen.replace('{title}', 'Quota refreshed')}"]`,
    )
    expect(detailButton).not.toBeNull()

    await act(async () => {
      detailButton?.click()
    })

    expect(onCloseAnnouncement).not.toHaveBeenCalled()
    expect(document.querySelector('.user-console-announcement-ticker')).not.toBeNull()

    await act(async () => root.unmount())
  })

  it('keeps inline markdown links clickable inside derived titles', async () => {
    const item = tickerAnnouncement({
      content: '# Check the [status page](https://example.com)\n\nAdditional details.',
    })
    const { root } = await renderAnnouncements({ activeAnnouncements: [item] })

    const titleLink = document.querySelector<HTMLAnchorElement>('.user-console-announcement-ticker-title a')
    expect(titleLink?.getAttribute('href')).toBe('https://example.com')

    const detailButton = document.querySelector<HTMLButtonElement>(
      `button[aria-label="${EN.announcements.tickerOpen.replace('{title}', 'Check the status page')}"]`,
    )
    expect(detailButton).not.toBeNull()

    await act(async () => root.unmount())
  })

  it('dismisses ticker notifications directly when only a title exists', async () => {
    const item = tickerAnnouncement({ content: '# Quota refreshed' })
    const { root, onCloseAnnouncement } = await renderAnnouncements({ activeAnnouncements: [item] })

    expect(document.querySelector('.user-console-announcement-ticker-main--titled')).not.toBeNull()

    const closeButton = document.querySelector<HTMLButtonElement>(
      `button[aria-label="${EN.announcements.tickerClose}"]`,
    )
    expect(closeButton).not.toBeNull()

    await act(async () => {
      closeButton?.click()
    })

    expect(onCloseAnnouncement).toHaveBeenCalledWith(item.id)
    expect(document.querySelector('.user-console-announcement-dialog')).toBeNull()

    await act(async () => root.unmount())
  })

  it('renders untitled ticker content inline without opening details', async () => {
    const item = tickerAnnouncement({
      id: 'ann-ticker-untitled',
      content: 'Check the [status page](https://example.com) for live updates.',
    })
    const { root, onCloseAnnouncement } = await renderAnnouncements({ activeAnnouncements: [item] })

    const ticker = document.querySelector<HTMLElement>('.user-console-announcement-ticker')
    expect(ticker?.textContent).toContain('Check the status page for live updates.')
    expect(document.querySelector('.user-console-announcement-ticker-main--untitled')).not.toBeNull()
    expect(document.querySelector(`button[aria-label="${EN.announcements.tickerDetails}"]`)).toBeNull()

    const link = document.querySelector<HTMLAnchorElement>('.user-console-announcement-ticker-content a')
    expect(link?.getAttribute('href')).toBe('https://example.com')

    const closeButton = document.querySelector<HTMLButtonElement>(
      `button[aria-label="${EN.announcements.tickerClose}"]`,
    )
    expect(closeButton).not.toBeNull()

    await act(async () => {
      closeButton?.click()
    })

    expect(onCloseAnnouncement).toHaveBeenCalledWith(item.id)
    await act(async () => root.unmount())
  })

  it('offers mark as read only for an unclosed published ticker in history', async () => {
    const item = tickerAnnouncement({ id: 'ann-history-unread' })
    const onCloseAnnouncement = mock(() => {})
    const { root } = await renderAnnouncements({
      activeAnnouncements: [],
      historyAnnouncements: [item],
      historyOpen: true,
      onCloseAnnouncement,
    })

    const historyItem = document.querySelector<HTMLElement>('.user-console-announcement-history-item')
    expect(historyItem?.textContent).toContain('Quota refreshed')
    expect(historyItem?.textContent).toContain(EN.announcements.published)
    const markReadButton = Array.from(historyItem?.querySelectorAll('button') ?? [])
      .find((button) => button.textContent?.includes(EN.announcements.markRead))
    expect(markReadButton).not.toBeNull()

    await act(async () => {
      markReadButton?.click()
    })

    expect(onCloseAnnouncement).toHaveBeenCalledWith(item.id)
    await act(async () => root.unmount())
  })

  it('shows handled time without a mark-read action for closed published tickers', async () => {
    const item = tickerAnnouncement({ id: 'ann-history-closed' })
    const { root } = await renderAnnouncements({
      activeAnnouncements: [],
      historyAnnouncements: [item],
      closedRecords: { [item.id]: 1_762_390_120 },
      historyOpen: true,
    })

    const historyItem = document.querySelector<HTMLElement>('.user-console-announcement-history-item')
    expect(historyItem?.textContent).toContain('Handled')
    expect(historyItem?.textContent).not.toContain(EN.announcements.markRead)

    await act(async () => root.unmount())
  })

  it('does not offer mark as read for published modal notices', async () => {
    const item = tickerAnnouncement({
      id: 'ann-history-modal',
      displayKind: 'modal',
      content: '# Scheduled maintenance\n\nThe service will restart tonight.',
    })
    const { root } = await renderAnnouncements({
      activeAnnouncements: [],
      historyAnnouncements: [item],
      historyOpen: true,
    })

    const historyItem = document.querySelector<HTMLElement>('.user-console-announcement-history-item')
    expect(historyItem?.textContent).toContain('Scheduled maintenance')
    expect(historyItem?.textContent).toContain(EN.announcements.published)
    expect(historyItem?.textContent).not.toContain(EN.announcements.markRead)
    expect(historyItem?.querySelector('button')).toBeNull()

    await act(async () => root.unmount())
  })

  it('keeps archived notices in history without an archived badge or mark-read action', async () => {
    const item = tickerAnnouncement({
      id: 'ann-history-archived',
      status: 'archived',
      archivedAt: 3,
      content: '# Migration complete\n\nThe endpoint migration is complete.',
    })
    const { root } = await renderAnnouncements({
      activeAnnouncements: [],
      historyAnnouncements: [item],
      historyOpen: true,
    })

    const historyItem = document.querySelector<HTMLElement>('.user-console-announcement-history-item')
    expect(historyItem?.textContent).toContain('Migration complete')
    expect(historyItem?.textContent).not.toContain('Archived')
    expect(historyItem?.textContent).not.toContain(EN.announcements.markRead)
    expect(historyItem?.querySelector('.status-badge')).toBeNull()

    await act(async () => root.unmount())
  })

  it('provides a named close action and an empty state in announcement history', async () => {
    const { root } = await renderAnnouncements({
      activeAnnouncements: [],
      historyOpen: true,
    })

    expect(document.querySelector(`button[aria-label="${EN.announcements.closeHistory}"]`)).not.toBeNull()
    expect(document.querySelector('.user-console-announcement-history-list')?.textContent)
      .toContain(EN.announcements.emptyHistory)

    await act(async () => root.unmount())
  })
})
