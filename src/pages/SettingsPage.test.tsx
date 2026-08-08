import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  disableAutostart: vi.fn(),
  enableAutostart: vi.fn(),
  isAutostartEnabled: vi.fn(),
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-autostart', () => ({
  disable: mocks.disableAutostart,
  enable: mocks.enableAutostart,
  isEnabled: mocks.isAutostartEnabled,
}));

vi.mock('../services/settingsService', () => ({
  createDefaultSettings: () => ({
    hourlyRate: 3000,
    notificationThresholdMinutes: 30,
    idleThresholdMinutes: 5,
    notificationsEnabled: true,
    notificationTone: 'sparta',
    notificationIntervalMinutes: 30,
  }),
  loadSettings: mocks.loadSettings,
  saveSettings: mocks.saveSettings,
}));

import { SettingsPage } from './SettingsPage';

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAutostartEnabled.mockResolvedValue(false);
    mocks.loadSettings.mockResolvedValue({
      hourlyRate: 3000,
      notificationThresholdMinutes: 30,
      idleThresholdMinutes: 5,
      notificationsEnabled: true,
      notificationTone: 'sparta',
      notificationIntervalMinutes: 30,
    });
    mocks.saveSettings.mockImplementation(async (settings) => settings);
  });

  it('renders tone and interval settings controls', async () => {
    render(<SettingsPage />);

    expect(await screen.findByRole('group', { name: '通知の口調' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '通知間隔' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '1分' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '5分' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '10分' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '15分' })).toBeInTheDocument();
    expect(mocks.loadSettings).toHaveBeenCalledOnce();
  });

  it('saves the selected tone and interval immediately', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(await screen.findByRole('button', { name: 'やさしい' }));
    await user.click(screen.getByRole('button', { name: '15分' }));

    expect(mocks.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationTone: 'gentle',
        notificationIntervalMinutes: 15,
      }),
    );
  });

  it('toggles autostart on when checkbox is clicked', async () => {
    const user = userEvent.setup();
    mocks.enableAutostart.mockResolvedValue(undefined);
    render(<SettingsPage />);

    await user.click(screen.getByRole('checkbox'));

    expect(mocks.enableAutostart).toHaveBeenCalledOnce();
  });

  it('shows an error message when autostart toggle fails', async () => {
    const user = userEvent.setup();
    mocks.enableAutostart.mockRejectedValue(new Error('failed'));
    render(<SettingsPage />);

    await user.click(screen.getByRole('checkbox'));

    expect(screen.getByText('自動起動の設定を変更できませんでした。')).toBeInTheDocument();
  });
});
