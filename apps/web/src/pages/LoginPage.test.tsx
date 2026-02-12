import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../lib/api';
import { TestRouter } from '../test/TestRouter';
import { LoginPage } from './LoginPage';

const authResponse = {
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'user@example.com',
    friendCode: 'ABCDEFGH',
    createdAt: new Date().toISOString(),
  },
};

describe('LoginPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes credentials and authenticates successfully', async () => {
    const user = userEvent.setup();
    const loginSpy = vi.spyOn(api, 'login').mockResolvedValue(authResponse);
    const onAuthenticated = vi.fn(async () => {});

    render(
      <TestRouter>
        <LoginPage onAuthenticated={onAuthenticated} />
      </TestRouter>,
    );

    await user.type(screen.getByTestId('login-email-input'), '  TEST@Example.com  ');
    await user.type(screen.getByTestId('login-password-input'), 'abc\r\n123');
    await user.click(screen.getByTestId('login-submit-button'));

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledTimes(1);
      expect(loginSpy).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'abc123',
      });
      expect(onAuthenticated).toHaveBeenCalledTimes(1);
    });
  });

  it('shows API errors when login fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'login').mockRejectedValue(new api.ApiError('Invalid credentials', 401));
    const onAuthenticated = vi.fn(async () => {});

    render(
      <TestRouter>
        <LoginPage onAuthenticated={onAuthenticated} />
      </TestRouter>,
    );

    await user.type(screen.getByTestId('login-email-input'), 'user@example.com');
    await user.type(screen.getByTestId('login-password-input'), 'password123');
    await user.click(screen.getByTestId('login-submit-button'));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      expect(onAuthenticated).not.toHaveBeenCalled();
    });
  });
});
