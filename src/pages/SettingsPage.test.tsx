import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  disableAutostart: vi.fn(),
  enableAutostart: vi.fn(),
  isAutostartEnabled: vi.fn(),
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-autostart', () => ({
  disable: mocks.disableAutostart,
  enable: mocks.enableAutostart,
  isEnabled: mocks.isAutostartEnabled,
}));

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: mocks.isPermissionGranted,
  requestPermission: mocks.requestPermission,
  sendNotification: mocks.sendNotification,
}));

import { SettingsPage } from './SettingsPage';

describe('SettingsPage notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAutostartEnabled.mockResolvedValue(false);
  });

  it('requests permission before sending a notification', async () => {
    const user = userEvent.setup();
    mocks.isPermissionGranted.mockResolvedValue(false);
    mocks.requestPermission.mockResolvedValue('granted');
    render(<SettingsPage />);

    await user.click(
      screen.getByRole('button', { name: '通知をテスト送信' }),
    );

    expect(mocks.requestPermission).toHaveBeenCalledOnce();
    expect(mocks.sendNotification).toHaveBeenCalledWith({
      title: 'Time Is Money',
      body: 'テスト通知です',
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'テスト通知を送信しました。',
    );
  });

  it('does not send when notification permission is denied', async () => {
    const user = userEvent.setup();
    mocks.isPermissionGranted.mockResolvedValue(false);
    mocks.requestPermission.mockResolvedValue('denied');
    render(<SettingsPage />);

    await user.click(
      screen.getByRole('button', { name: '通知をテスト送信' }),
    );

    expect(mocks.sendNotification).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      '通知が許可されていません。',
    );
    await waitFor(() => expect(mocks.isAutostartEnabled).toHaveBeenCalled());
  });
});
