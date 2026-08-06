import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  disableAutostart: vi.fn(),
  enableAutostart: vi.fn(),
  isAutostartEnabled: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-autostart', () => ({
  disable: mocks.disableAutostart,
  enable: mocks.enableAutostart,
  isEnabled: mocks.isAutostartEnabled,
}));

import { SettingsPage } from './SettingsPage';

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAutostartEnabled.mockResolvedValue(false);
  });

  it('toggles autostart on when checkbox is clicked', async () => {
    const user = userEvent.setup();
    mocks.enableAutostart.mockResolvedValue(undefined);
    render(<SettingsPage />);

    await user.click(
      screen.getByRole('checkbox'),
    );

    expect(mocks.enableAutostart).toHaveBeenCalledOnce();
  });

  it('shows an error message when autostart toggle fails', async () => {
    const user = userEvent.setup();
    mocks.enableAutostart.mockRejectedValue(new Error('failed'));
    render(<SettingsPage />);

    await user.click(
      screen.getByRole('checkbox'),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      '自動起動の設定を変更できませんでした。',
    );
  });
});
