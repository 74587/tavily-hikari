import '../../test/happydom'

import { afterEach, describe, expect, it } from 'bun:test'
import { act, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'

import { LanguageProvider } from '../i18n'
import { ThemeProvider } from '../theme'
import UserConsoleHeader from './UserConsoleHeader'

function renderWithProviders(node: ReactElement): string {
  return renderToStaticMarkup(
    <LanguageProvider>
      <ThemeProvider>{node}</ThemeProvider>
    </LanguageProvider>
  )
}

function wrapWithProviders(node: ReactElement): ReactElement {
  return (
    <LanguageProvider>
      <ThemeProvider>{node}</ThemeProvider>
    </LanguageProvider>
  )
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('UserConsoleHeader', () => {
  it('renders a single-line desktop header shell with desktop and compact action groups', () => {
    const html = renderWithProviders(
      <UserConsoleHeader
        title="User Console"
        subtitle="Your account dashboard and token management"
        eyebrow="User Workspace"
        currentViewLabel="Current View"
        currentViewTitle="Token Detail"
        currentViewDescription="Same token-level modules as home page."
        sessionLabel="Signed in as"
        sessionDisplayName="Ivan"
        sessionProviderLabel="LinuxDo"
        sessionAvatarUrl="https://connect.linux.do/user_avatar/connect.linux.do/ivan/96/1.png"
        adminLabel="Admin"
        isAdmin
        adminHref="/admin"
        adminActionLabel="Open Admin Dashboard"
        announcementsLabel="Open announcements"
        announcementCount={2}
        onOpenAnnouncements={() => undefined}
        logoutVisible
        isLoggingOut={false}
        logoutLabel="Sign out"
        loggingOutLabel="Signing out…"
        onLogout={() => undefined}
      />
    )

    expect(html).toContain('User Workspace')
    expect(html).toContain('/assets/relay-mesh-mobile-logo-light.svg')
    expect(html).toContain('/assets/relay-mesh-mobile-logo-dark.svg')
    expect(html).toContain('Your account dashboard and token management')
    expect(html).toContain('Signed in as: Ivan')
    expect(html).toContain('user-console-header-main')
    expect(html).toContain('user-console-header-topline')
    expect(html).not.toContain('user-console-header-bottomline')
    expect(html).not.toContain('user-console-header-title-group')
    expect(html).not.toContain('user-console-header-summary-mobile')
    expect(html).not.toContain('user-console-header-inline-meta')
    expect(html).toContain('user-console-header-actions-desktop')
    expect(html).toContain('user-console-header-actions-compact')
    expect(html).toContain('user-console-announcements-trigger')
    expect(html).toContain('user-console-utility-trigger')
    expect(html).toContain('Preferences: Theme / Language')
    expect(html).toContain('user-console-account-trigger')
    expect(html).toContain('user-console-account-avatar-image')
  })

  it('keeps the account trigger but omits sign out when no user session is available', () => {
    const html = renderWithProviders(
      <UserConsoleHeader
        title="User Console"
        subtitle="Your account dashboard and token management"
        eyebrow="User Workspace"
        currentViewLabel="Current View"
        currentViewTitle="Account Overview"
        currentViewDescription="Track account-level quotas."
        sessionLabel="Signed in as"
        sessionDisplayName="dev-mode"
        adminLabel="Admin"
        isAdmin
        adminHref="/admin"
        adminActionLabel="Open Admin Dashboard"
        logoutVisible={false}
        isLoggingOut={false}
        logoutLabel="Sign out"
        loggingOutLabel="Signing out…"
        onLogout={() => undefined}
      />
    )

    expect(html).toContain('Signed in as: dev-mode')
    expect(html).toContain('User Workspace')
    expect(html).not.toContain('user-console-header-bottomline')
    expect(html).toContain('user-console-account-trigger')
    expect(html).not.toContain('user-console-announcements-trigger')
    expect(html).not.toContain('Sign out')
  })

  it('renders a local svg icon inside the announcements trigger', () => {
    const html = renderWithProviders(
      <UserConsoleHeader
        title="User Console"
        subtitle="Your account dashboard and token management"
        eyebrow="User Workspace"
        currentViewLabel="Current View"
        currentViewTitle="Account Overview"
        currentViewDescription="Track account-level quotas."
        sessionLabel="Signed in as"
        sessionDisplayName="Ivan"
        sessionProviderLabel="LinuxDo"
        sessionAvatarUrl="https://connect.linux.do/user_avatar/connect.linux.do/ivan/96/1.png"
        adminLabel="Admin"
        isAdmin={false}
        announcementsLabel="Open announcements"
        announcementCount={1}
        onOpenAnnouncements={() => undefined}
        logoutVisible
        isLoggingOut={false}
        logoutLabel="Sign out"
        loggingOutLabel="Signing out…"
        onLogout={() => undefined}
      />,
    )

    expect(html).toContain('user-console-announcements-trigger')
    expect(html).toMatch(/user-console-announcements-trigger[\s\S]*?<svg/i)
    expect(html).not.toContain('api.iconify.design')
  })

  it('renders the compact utility menu copy in Chinese without changing the public props contract', () => {
    const html = renderToStaticMarkup(
      <LanguageProvider initialLanguage="zh">
        <ThemeProvider>
          <UserConsoleHeader
            title="用户控制台"
            subtitle="账户仪表盘与 Token 管理"
            eyebrow="用户工作区"
            currentViewLabel="当前视图"
            currentViewTitle="Token 列表"
            currentViewDescription="查看状态、配额窗口与最近请求。"
            sessionLabel="当前账户"
            sessionDisplayName="Ivan"
            sessionProviderLabel="LinuxDo"
            adminLabel="管理员"
            isAdmin
            adminHref="/admin"
            adminActionLabel="打开管理后台"
            announcementsLabel="打开通知"
            announcementCount={2}
            onOpenAnnouncements={() => undefined}
            logoutVisible
            isLoggingOut={false}
            logoutLabel="退出登录"
            loggingOutLabel="退出中…"
            onLogout={() => undefined}
          />
        </ThemeProvider>
      </LanguageProvider>,
    )

    expect(html).toContain('偏好: 主题 / 语言')
    expect(html).toContain('当前账户: Ivan')
    expect(html).not.toContain('用户控制台')
  })

  it('retries avatar rendering after a broken image url is replaced', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(wrapWithProviders(
        <UserConsoleHeader
          title="User Console"
          subtitle="Your account dashboard and token management"
          eyebrow="User Workspace"
          currentViewLabel="Current View"
          currentViewTitle="Account Overview"
          currentViewDescription="Track account-level quotas."
          sessionLabel="Signed in as"
          sessionDisplayName="Ivan"
          sessionProviderLabel="LinuxDo"
          sessionAvatarUrl="https://broken.example/avatar.png"
          adminLabel="Admin"
          isAdmin={false}
          logoutVisible
          isLoggingOut={false}
          logoutLabel="Sign out"
          loggingOutLabel="Signing out…"
          onLogout={() => undefined}
        />,
      ))
    })

    const dispatchImageError = () => {
      const images = Array.from(container.querySelectorAll<HTMLImageElement>('.user-console-account-trigger img'))
      expect(images).toHaveLength(2)
      for (const image of images) {
        expect(image.getAttribute('src')).toBe('https://broken.example/avatar.png')
        image.dispatchEvent(new Event('error', { bubbles: true }))
      }
    }

    await act(async () => {
      dispatchImageError()
    })

    expect(container.querySelectorAll('.user-console-account-trigger img')).toHaveLength(0)
    expect(container.querySelectorAll('.user-console-account-trigger .user-console-account-avatar-fallback')).toHaveLength(2)
    expect(
      container.querySelector('.user-console-account-trigger .user-console-account-avatar-fallback')?.textContent,
    ).toBe('I')

    await act(async () => {
      root.render(wrapWithProviders(
        <UserConsoleHeader
          title="User Console"
          subtitle="Your account dashboard and token management"
          eyebrow="User Workspace"
          currentViewLabel="Current View"
          currentViewTitle="Account Overview"
          currentViewDescription="Track account-level quotas."
          sessionLabel="Signed in as"
          sessionDisplayName="Ivan"
          sessionProviderLabel="LinuxDo"
          sessionAvatarUrl="https://connect.linux.do/user_avatar/connect.linux.do/ivan/96/1.png"
          adminLabel="Admin"
          isAdmin={false}
          logoutVisible
          isLoggingOut={false}
          logoutLabel="Sign out"
          loggingOutLabel="Signing out…"
          onLogout={() => undefined}
        />,
      ))
    })

    const repairedImages = Array.from(container.querySelectorAll<HTMLImageElement>('.user-console-account-trigger img'))
    expect(repairedImages).toHaveLength(2)
    for (const image of repairedImages) {
      expect(image.getAttribute('src')).toBe('https://connect.linux.do/user_avatar/connect.linux.do/ivan/96/1.png')
    }

    await act(async () => {
      root.unmount()
    })
  })
})
