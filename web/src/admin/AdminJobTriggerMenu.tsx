import { Icon } from '../lib/icons'
import { Button } from '../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import type { AdminTranslations } from '../i18n'
import { MANUAL_JOB_ACTIONS } from './jobFilters'

interface AdminJobTriggerMenuProps {
  disabled: boolean
  triggeringJobType: string | null
  strings: AdminTranslations['jobs']
  labelForJobType: (jobType: string) => string
  onTrigger: (jobType: string) => void
}

export default function AdminJobTriggerMenu({
  disabled,
  triggeringJobType,
  strings,
  labelForJobType,
  onTrigger,
}: AdminJobTriggerMenuProps): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled || triggeringJobType != null}>
          <Icon icon="mdi:play-circle-outline" width={16} height={16} aria-hidden="true" />
          <span style={{ whiteSpace: 'nowrap' }}>
            {triggeringJobType ? labelForJobType(triggeringJobType) : strings.actions.trigger}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>{strings.title}</DropdownMenuLabel>
        {MANUAL_JOB_ACTIONS.map((jobType) => (
          <DropdownMenuItem
            key={jobType}
            disabled={triggeringJobType != null}
            onSelect={(event) => {
              event.preventDefault()
              onTrigger(jobType)
            }}
          >
            <Icon icon="mdi:play-outline" width={16} height={16} aria-hidden="true" />
            <span>{labelForJobType(jobType)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
