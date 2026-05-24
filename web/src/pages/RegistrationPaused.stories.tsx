import type { Meta, StoryObj } from '@storybook/react-vite'

import RegistrationPaused from './RegistrationPaused'

const meta = {
  title: 'Public/Pages/RegistrationPaused',
  component: RegistrationPaused,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof RegistrationPaused>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const DarkTheme: Story = {
  globals: {
    themeMode: 'dark',
  },
  parameters: {
    viewport: { defaultViewport: '0390-device-iphone-14' },
    docs: {
      description: {
        story:
          'Dark-theme registration-paused proof for the repaired low-light tropical clay palette without hard-coded blue-black glass.',
      },
    },
  },
}
