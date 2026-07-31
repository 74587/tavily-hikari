import { useEffect, useState } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'

import BrandLockup from './BrandLockup'
import { Icon } from '../lib/icons'

import { languageOptions, type Language, useLanguage, useTranslate } from '../i18n'
import { type ThemeMode, useTheme } from '../theme'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeToggle from './ThemeToggle'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

interface UserConsoleHeaderProps {
  title: string
  subtitle: string
  eyebrow: string
  currentViewLabel: string
  currentViewTitle: string
  currentViewDescription: string
  sessionLabel: string
  sessionDisplayName?: string | null
  sessionProviderLabel?: string | null
  sessionAvatarUrl?: string | null
  adminLabel: string
  isAdmin: boolean
  adminHref?: string | null
  adminActionLabel?: string | null
  adminMenuLabel?: string | null
  announcementsLabel?: string | null
  announcementCount?: number
  onOpenAnnouncements?: () => void
  logoutVisible: boolean
  isLoggingOut: boolean
  logoutLabel: string
  loggingOutLabel: string
  onLogout: () => void
}

interface UserConsoleAvatarProps {
  avatarUrl?: string | null
  displayName: string
  className: string
  imageClassName: string
}

interface UserConsoleAccountMenuProps {
  sessionLabel: string
  sessionDisplayName?: string | null
  sessionProviderLabel?: string | null
  sessionAvatarUrl?: string | null
  adminLabel: string
  isAdmin: boolean
  adminHref?: string | null
  adminActionLabel?: string | null
  adminMenuLabel?: string | null
  logoutVisible: boolean
  isLoggingOut: boolean
  logoutLabel: string
  loggingOutLabel: string
  onLogout: () => void
}

const LANGUAGE_META: Record<Language, { icon: string; short: string }> = {
  en: { icon: 'circle-flags:gb', short: 'EN' },
  zh: { icon: 'circle-flags:cn', short: '中文' },
}

const UTILITY_COPY = {
  en: {
    menu: 'Preferences',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  },
  zh: {
    menu: '偏好',
    theme: '主题',
    light: '浅色',
    dark: '深色',
    system: '跟随系统',
  },
} as const

function ThemeModeIcon({ mode }: { mode: ThemeMode }): JSX.Element {
  if (mode === 'dark') return <Moon className="h-4 w-4" aria-hidden="true" />
  if (mode === 'light') return <Sun className="h-4 w-4" aria-hidden="true" />
  return <Monitor className="h-4 w-4" aria-hidden="true" />
}

function UserConsoleAvatar(props: UserConsoleAvatarProps): JSX.Element {
  const [broken, setBroken] = useState(false)
  const initial = props.displayName.trim().charAt(0).toUpperCase() || '?'

  useEffect(() => {
    setBroken(false)
  }, [props.avatarUrl])

  if (props.avatarUrl && !broken) {
    return (
      <img
        src={props.avatarUrl}
        alt=""
        aria-hidden="true"
        className={props.imageClassName}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    )
  }

  return (
    <span className={props.className} aria-hidden="true">
      {initial}
    </span>
  )
}

function UserConsoleUtilityMenu(): JSX.Element {
  const { language, setLanguage } = useLanguage()
  const { mode, setMode } = useTheme()
  const strings = useTranslate()
  const copy = UTILITY_COPY[language]

  const handleThemeSelect = (next: ThemeMode) => {
    if (next === mode) return
    setMode(next)
  }

  const handleLanguageSelect = (next: Language) => {
    if (next === language) return
    setLanguage(next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="user-console-utility-trigger"
          aria-label={`${copy.menu}: ${copy.theme} / ${strings.common.languageLabel}`}
        >
          <Icon icon="mdi:tune-variant" width={18} height={18} aria-hidden="true" />
          <span className="user-console-utility-trigger-label">{copy.menu}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="user-console-utility-menu">
        <DropdownMenuLabel className="user-console-utility-group-label">{copy.theme}</DropdownMenuLabel>
        <DropdownMenuItem className="user-console-utility-item" onClick={() => handleThemeSelect('light')}>
          <Sun className="h-4 w-4" aria-hidden="true" />
          <span className="user-console-utility-item-label">{copy.light}</span>
          {mode === 'light' ? <Check className="ml-auto h-4 w-4" aria-hidden="true" /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem className="user-console-utility-item" onClick={() => handleThemeSelect('dark')}>
          <Moon className="h-4 w-4" aria-hidden="true" />
          <span className="user-console-utility-item-label">{copy.dark}</span>
          {mode === 'dark' ? <Check className="ml-auto h-4 w-4" aria-hidden="true" /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem className="user-console-utility-item" onClick={() => handleThemeSelect('system')}>
          <ThemeModeIcon mode="system" />
          <span className="user-console-utility-item-label">{copy.system}</span>
          {mode === 'system' ? <Check className="ml-auto h-4 w-4" aria-hidden="true" /> : null}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="user-console-utility-group-label">{strings.common.languageLabel}</DropdownMenuLabel>
        {languageOptions.map((option) => {
          const meta = LANGUAGE_META[option.value]
          const isActive = option.value === language
          return (
            <DropdownMenuItem
              key={option.value}
              className="user-console-utility-item"
              onClick={() => handleLanguageSelect(option.value)}
            >
              <span className="language-flag" aria-hidden="true">
                <Icon icon={meta.icon} width={18} height={18} />
              </span>
              <span className="user-console-utility-item-label">{strings.common[option.labelKey]}</span>
              {isActive ? <Check className="ml-auto h-4 w-4" aria-hidden="true" /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserConsoleAnnouncementsTrigger({
  announcementsLabel,
  announcementCount,
  onOpenAnnouncements,
}: {
  announcementsLabel?: string | null
  announcementCount?: number
  onOpenAnnouncements?: () => void
}): JSX.Element | null {
  if (!onOpenAnnouncements || !announcementsLabel) {
    return null
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className="user-console-announcements-trigger"
      aria-label={announcementsLabel}
      onClick={onOpenAnnouncements}
    >
      <Icon icon="mdi:bell-ring-outline" width={16} height={16} aria-hidden="true" />
      {announcementCount && announcementCount > 0 ? (
        <span className="user-console-announcements-count">{announcementCount}</span>
      ) : null}
    </Button>
  )
}

function UserConsoleAccountMenu(props: UserConsoleAccountMenuProps): JSX.Element | null {
  const hasAdminAction = Boolean(props.adminHref && props.adminActionLabel)
  const accountName = props.sessionDisplayName ?? props.adminLabel
  const accountMeta = [props.sessionProviderLabel, props.isAdmin ? props.adminLabel : null]
    .filter((value): value is string => Boolean(value))
    .join(' · ')
  const showAccountMenu = Boolean(
    props.sessionDisplayName || props.sessionProviderLabel || props.isAdmin || hasAdminAction || props.logoutVisible,
  )

  if (!showAccountMenu) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="user-console-account-trigger"
          aria-label={`${props.sessionLabel}: ${accountName}`}
        >
          <UserConsoleAvatar
            avatarUrl={props.sessionAvatarUrl}
            displayName={accountName}
            className="user-console-account-avatar user-console-account-avatar-fallback user-console-account-trigger-icon"
            imageClassName="user-console-account-avatar user-console-account-avatar-image user-console-account-trigger-icon"
          />
          <span className="user-console-account-name">{accountName}</span>
          <Icon
            icon="mdi:chevron-down"
            width={14}
            height={14}
            aria-hidden="true"
            className="user-console-account-trigger-chevron"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="user-console-account-menu">
        <div className="user-console-account-summary">
          <UserConsoleAvatar
            avatarUrl={props.sessionAvatarUrl}
            displayName={accountName}
            className="user-console-account-avatar user-console-account-avatar-fallback user-console-account-summary-icon"
            imageClassName="user-console-account-avatar user-console-account-avatar-image user-console-account-summary-icon"
          />
          <div className="user-console-account-summary-body">
            <span className="user-console-account-summary-name">{accountName}</span>
            {accountMeta && <span className="user-console-account-summary-meta">{accountMeta}</span>}
          </div>
        </div>

        {(hasAdminAction || props.logoutVisible) && <DropdownMenuSeparator />}

        {hasAdminAction && (
          <DropdownMenuItem
            className="user-console-account-menu-item user-console-account-menu-admin"
            onSelect={() => {
              if (props.adminHref) {
                window.location.href = props.adminHref
              }
            }}
          >
            <Icon icon="mdi:crown-outline" width={16} height={16} aria-hidden="true" />
            <span>{props.adminMenuLabel ?? props.adminActionLabel}</span>
          </DropdownMenuItem>
        )}

        {props.logoutVisible && (
          <DropdownMenuItem
            className="user-console-account-menu-item user-console-account-menu-logout"
            onSelect={(event) => {
              event.preventDefault()
              if (!props.isLoggingOut) {
                props.onLogout()
              }
            }}
            disabled={props.isLoggingOut}
          >
            <Icon
              icon={props.isLoggingOut ? 'mdi:loading' : 'mdi:logout-variant'}
              width={16}
              height={16}
              className={props.isLoggingOut ? 'icon-spin' : undefined}
              aria-hidden="true"
            />
            <span>{props.isLoggingOut ? props.loggingOutLabel : props.logoutLabel}</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function UserConsoleHeader(props: UserConsoleHeaderProps): JSX.Element {
  const desktopSummary = props.subtitle

  return (
    <section className="surface app-header user-console-header">
      <div className="user-console-header-main">
        <div className="user-console-header-topline">
          <div className="user-console-header-brandline">
            <span className="user-console-header-brand-mobile">
              <img
                src="/assets/relay-mesh-mobile-logo-light.svg"
                alt="Tavily Hikari"
                className="user-console-header-brand-mobile-mark user-console-header-brand-mobile-mark-light"
                loading="eager"
                decoding="async"
              />
              <img
                src="/assets/relay-mesh-mobile-logo-dark.svg"
                alt=""
                aria-hidden="true"
                className="user-console-header-brand-mobile-mark user-console-header-brand-mobile-mark-dark"
                loading="eager"
                decoding="async"
              />
            </span>
            <BrandLockup
              title="Tavily Hikari"
              compact
              className="user-console-header-brand"
              markClassName="user-console-header-brand-mark"
            />
            <span className="user-console-header-eyebrow">{props.eyebrow}</span>
          </div>
          <span className="user-console-header-summary">{desktopSummary}</span>
        </div>
      </div>

      <div className="user-console-header-actions user-console-header-actions-desktop" aria-label={props.sessionLabel}>
        <ThemeToggle />
        <LanguageSwitcher />
        <UserConsoleAnnouncementsTrigger
          announcementsLabel={props.announcementsLabel}
          announcementCount={props.announcementCount}
          onOpenAnnouncements={props.onOpenAnnouncements}
        />
        <UserConsoleAccountMenu {...props} />
      </div>

      <div className="user-console-header-actions user-console-header-actions-compact" aria-label={props.sessionLabel}>
        <div className="user-console-header-compact-tools">
          <UserConsoleAnnouncementsTrigger
            announcementsLabel={props.announcementsLabel}
            announcementCount={props.announcementCount}
            onOpenAnnouncements={props.onOpenAnnouncements}
          />
          <UserConsoleUtilityMenu />
        </div>
        <div className="user-console-header-compact-account">
          <UserConsoleAccountMenu {...props} />
        </div>
      </div>
    </section>
  )
}
