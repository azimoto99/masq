import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../lib/api';
import { TestRouter } from '../test/TestRouter';
import { RegisterPage } from './RegisterPage';

const authResponse = {
  user: {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'new@example.com',
    friendCode: 'BCDEFGHJ',
    createdAt: new Date().toISOString(),
  },
};

describe('RegisterPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes registration payload and authenticates on success', async () => {
    const user = userEvent.setup();
    const registerSpy = vi.spyOn(api, 'register').mockResolvedValue(authResponse);
    const onAuthenticated = vi.fn(async () => {});

    render(
      <TestRouter>
        <RegisterPage onAuthenticated={onAuthenticated} />
      </TestRouter>,
    );

    await user.type(screen.getByTestId('register-email-input'), '  NEW@Example.com  ');
    await user.type(screen.getByTestId('register-password-input'), 'topsecret\r\n123');
    await user.click(screen.getByTestId('register-submit-button'));

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledTimes(1);
      expect(registerSpy).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'topsecret123',
      });
      expect(onAuthenticated).toHaveBeenCalledTimes(1);
    });
  });

  it('renders API error messages on failed registration', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'register').mockRejectedValue(new api.ApiError('Email already registered', 409));
    const onAuthenticated = vi.fn(async () => {});

    render(
      <TestRouter>
        <RegisterPage onAuthenticated={onAuthenticated} />
      </TestRouter>,
    );

    await user.type(screen.getByTestId('register-email-input'), 'dupe@example.com');
    await user.type(screen.getByTestId('register-password-input'), 'password123');
    await user.click(screen.getByTestId('register-submit-button'));

    await waitFor(() => {
      expect(screen.getByText('Email already registered')).toBeInTheDocument();
      expect(onAuthenticated).not.toHaveBeenCalled();
    });
  });
});
