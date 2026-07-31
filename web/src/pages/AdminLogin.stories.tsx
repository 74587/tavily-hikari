import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import type { Profile } from '../api'
import { installDemoRuntime } from '../api/demo'
import UpdateAvailableBanner from '../components/UpdateAvailableBanner'
import { LanguageProvider } from '../i18n'
import { ZH } from '../i18n/translations/zh'
import { ThemeProvider } from '../theme'
import AdminLogin from './AdminLogin'

interface AdminLoginStoryProps {
  path?: string
  profile?: Profile
  profileUnavailable?: boolean
  showUpdateBanner?: boolean
}

const baseProfile: Profile = {
  displayName: 'Hikari Demo Admin',
  isAdmin: true,
  forwardAuthEnabled: false,
  builtinAuthEnabled: true,
  passkeyAuthEnabled: true,
  adminLoginTotpRequired: true,
  allowRegistration: false,
  userLoggedIn: true,
  userProvider: 'linuxdo',
  userDisplayName: 'Hikari Demo Admin',
  userAvatarUrl: null,
}

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(value), {
    ...init,
    headers,
  })
}

function installAdminLoginStoryRuntime(profile: Profile, profileUnavailable: boolean): void {
  installDemoRuntime()
  const passthrough = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.origin)
    const method = init?.method?.toUpperCase() ?? 'GET'
    if (url.pathname === '/api/profile') {
      return profileUnavailable
        ? new Response('profile unavailable', { status: 503 })
        : jsonResponse(profile)
    }
    if (url.pathname === '/api/admin/login' && method === 'POST') return jsonResponse({ ok: true })
    return passthrough(input, init)
  }
}

function AdminLoginStory({
  path = '/login',
  profile = baseProfile,
  profileUnavailable = false,
  showUpdateBanner = false,
}: AdminLoginStoryProps): JSX.Element {
  window.localStorage.setItem('tavily-hikari-demo-mode', 'true')
  window.history.replaceState({}, '', path)
  installAdminLoginStoryRuntime(profile, profileUnavailable)
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AdminLogin
          updateBanner={showUpdateBanner
            ? (
              <UpdateAvailableBanner
                className="auth-page-update-banner"
                strings={ZH.public.updateBanner}
                currentVersion="0.83.8"
                availableVersion="0.83.9"
                status="ready"
                loading={false}
                onUpdate={() => undefined}
                onDismiss={() => undefined}
              />
            )
            : undefined}
        />
      </ThemeProvider>
    </LanguageProvider>
  )
}

const meta = {
  title: 'Public/Pages/AdminLogin',
  component: AdminLoginStory,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Admin login page states for passkey login and break-glass password login.',
      },
    },
  },
  tags: ['autodocs'],
  render: (args) => <AdminLoginStory {...args} />,
} satisfies Meta<typeof AdminLoginStory>

export default meta

type Story = StoryObj<typeof meta>

const desktopViewport = { viewport: { defaultViewport: '1440-device-desktop' } } as const
const mobileViewport = { viewport: { defaultViewport: '0390-device-iphone-14' } } as const
const shortMobileViewport = { viewport: { defaultViewport: '0390-device-short' } } as const

const noLoginMethodsProfile: Profile = {
  ...baseProfile,
  builtinAuthEnabled: false,
  passkeyAuthEnabled: false,
  adminLoginTotpRequired: false,
}

async function showUpdateBanner(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement)
  const banner = await canvas.findByRole('status')
  const main = canvas.getByRole('main')
  await expect(banner).toHaveClass('auth-page-update-banner')
  await expect(banner.compareDocumentPosition(main)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
}

export const UpdateAvailableBelowHeader: Story = {
  args: {
    showUpdateBanner: true,
  },
  globals: {
    language: 'zh',
  },
  parameters: desktopViewport,
  play: async ({ canvasElement }) => {
    await showUpdateBanner(canvasElement)
  },
}

export const UpdateAvailableBelowHeaderMobile: Story = {
  name: 'Update available below header / mobile',
  args: {
    showUpdateBanner: true,
  },
  globals: {
    language: 'zh',
  },
  parameters: mobileViewport,
  play: async ({ canvasElement }) => {
    await showUpdateBanner(canvasElement)
  },
}

export const PasskeyLogin: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.findByRole('button', { name: /passkey/i })).resolves.toBeInTheDocument()
    await expect(canvas.findByLabelText(/totp|验证码/i)).resolves.toBeInTheDocument()
  },
}

export const PasskeyLoginMobile: Story = {
  name: 'Passkey login / mobile',
  parameters: mobileViewport,
  globals: {
    language: 'zh',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const main = canvas.getByRole('main')
    const footerControls = canvas.getByRole('button', { name: /theme|主题/i }).parentElement
    await expect(canvas.findByLabelText(/totp|验证码/i)).resolves.toBeInTheDocument()
    await expect(canvas.findByRole('button', { name: /passkey/i })).resolves.toBeInTheDocument()
    await expect(footerControls).toHaveClass('auth-page-footer-controls')
    await expect(main.compareDocumentPosition(footerControls!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  },
}

export const ResetEnrollment: Story = {
  args: {
    path: '/login?adminPasskeyResetToken=story-reset-token',
    profile: {
      ...baseProfile,
      isAdmin: false,
      builtinAuthEnabled: false,
      passkeyAuthEnabled: false,
      adminLoginTotpRequired: false,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.findByText(/one-time reset link|一次性重置链接/i)).resolves.toBeInTheDocument()
    await expect(canvas.findByRole('button', { name: /register passkey|注册 Passkey/i })).resolves.toBeInTheDocument()
  },
}

export const ResetEnrollmentComplete: Story = {
  args: {
    path: '/login?adminPasskeyRegistered=1',
    profile: {
      ...baseProfile,
      isAdmin: false,
      builtinAuthEnabled: false,
      passkeyAuthEnabled: true,
      adminLoginTotpRequired: false,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.findByText(/Passkey registered|Passkey 已注册/i)).resolves.toBeInTheDocument()
    await expect(canvas.findByRole('button', { name: /passkey/i })).resolves.toBeInTheDocument()
  },
}

export const PasswordOnly: Story = {
  args: {
    profile: {
      ...baseProfile,
      passkeyAuthEnabled: false,
      adminLoginTotpRequired: false,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.findByLabelText(/password|口令/i)).resolves.toBeInTheDocument()
    await expect(canvas.findByRole('button', { name: /sign in|登录/i })).resolves.toBeInTheDocument()
  },
}

export const PasskeyOnlyTotpRequired: Story = {
  args: {
    profile: {
      ...baseProfile,
      builtinAuthEnabled: false,
      passkeyAuthEnabled: true,
      adminLoginTotpRequired: true,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.findByLabelText(/totp|验证码/i)).resolves.toBeInTheDocument()
    await expect(canvas.findByRole('button', { name: /passkey/i })).resolves.toBeInTheDocument()
  },
}

export const NoLoginMethods: Story = {
  name: 'No login methods / desktop',
  parameters: desktopViewport,
  globals: {
    language: 'zh',
  },
  args: {
    profile: noLoginMethodsProfile,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.findByText(/disabled|未启用/i)).resolves.toBeInTheDocument()
    await expect(canvas.findByRole('region', { name: /credentials|登录凭据/i })).resolves.toBeInTheDocument()
    await expect(canvasElement.querySelector('.shadow-clayCard')).toBeNull()
  },
}

export const NoLoginMethodsMobile: Story = {
  name: 'No login methods / mobile',
  parameters: mobileViewport,
  globals: {
    language: 'zh',
  },
  args: {
    profile: noLoginMethodsProfile,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const mobileMark = await canvas.findByRole('img', { name: 'Tavily Hikari' })
    await expect(mobileMark).toHaveAttribute('src', '/assets/relay-mesh-mobile-logo-light.svg')
    await expect(mobileMark).toBeVisible()
    await expect(canvas.getByRole('button', { name: /theme|主题/i })).toBeVisible()
    await expect(canvas.getByRole('button', { name: /language|语言/i })).toBeVisible()
    await expect(canvas.getByRole('region', { name: /credentials|登录凭据/i })).toBeInTheDocument()
    await expect(canvasElement.querySelector('.shadow-clayCard')).toBeNull()
  },
}

export const NoLoginMethodsShortMobile: Story = {
  name: 'No login methods / short mobile',
  parameters: shortMobileViewport,
  globals: {
    language: 'zh',
  },
  args: {
    profile: noLoginMethodsProfile,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const credentials = await canvas.findByRole('region', { name: /credentials|登录凭据/i })
    const footerControls = canvas.getByRole('button', { name: /theme|主题/i }).parentElement
    await expect(credentials).toBeInTheDocument()
    await expect(footerControls).toHaveClass('auth-page-footer-controls')
    await expect(credentials.compareDocumentPosition(footerControls!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  },
}

export const ProfileUnavailable: Story = {
  args: {
    profileUnavailable: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.findByText(/unable to confirm|无法确认/i)).resolves.toBeInTheDocument()
    await expect(canvas.findByRole('button', { name: /passkey/i })).resolves.toBeInTheDocument()
  },
}

export const DarkTheme: Story = {
  globals: {
    themeMode: 'dark',
  },
}
