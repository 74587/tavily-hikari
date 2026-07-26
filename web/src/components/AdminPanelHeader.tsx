import { type ReactNode } from 'react'

import { Icon } from '../lib/icons'

import AdminReturnToConsoleLink from './AdminReturnToConsoleLink'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeToggle from './ThemeToggle'
import { Button } from './ui/button'

interface AdminPanelHeaderProps {
  title: string
  subtitle?: string
  displayName?: string | null
  isAdmin: boolean
  isRefreshing: boolean
  refreshDisabled?: boolean
  refreshLabel: string
  refreshingLabel: string
  userConsoleLabel?: string
  userConsoleHref?: string
  stackActions?: boolean
  onRefresh: () => void
  extraActions?: ReactNode
}

export default function AdminPanelHeader(props: AdminPanelHeaderProps): JSX.Element {
  return (
    <section className={`surface app-header admin-panel-header${props.stackActions ? ' admin-panel-header--stacked-actions' : ''}`}>
      <div className="admin-panel-header-main">
        <h1>{props.title}</h1>
        {props.subtitle ? <p className="admin-panel-header-subtitle">{props.subtitle}</p> : null}
      </div>

      <div className="admin-panel-header-side">
        <div className="admin-panel-header-tools">
          <div className="admin-language-switcher">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
          {props.displayName && (
            <div className={`user-badge${props.isAdmin ? ' user-badge-admin' : ''}`} title={props.displayName}>
              {props.isAdmin && <Icon icon="mdi:crown-outline" className="user-badge-icon" aria-hidden="true" />}
              <span>{props.displayName}</span>
            </div>
          )}
        </div>

        <div className={`admin-panel-header-actions${props.stackActions ? ' admin-panel-header-actions--stacked' : ''}`}>
          {props.extraActions}

          {props.userConsoleLabel && (
            <AdminReturnToConsoleLink
              label={props.userConsoleLabel}
              href={props.userConsoleHref}
              className="admin-return-link--header"
            />
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="admin-panel-refresh-button"
            onClick={props.onRefresh}
            disabled={props.isRefreshing || props.refreshDisabled}
          >
            <Icon
              icon={props.isRefreshing ? 'mdi:loading' : 'mdi:refresh'}
              width={16}
              height={16}
              className={props.isRefreshing ? 'icon-spin' : undefined}
              aria-hidden="true"
            />
            <span>{props.isRefreshing ? props.refreshingLabel : props.refreshLabel}</span>
          </Button>
        </div>
      </div>
    </section>
  )
}
