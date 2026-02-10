import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { LoginRequest } from '@masq/shared';
import { AuthShell } from '../components/AuthShell';
import { ApiError, login } from '../lib/api';

interface LoginPageProps {
  onAuthenticated: () => Promise<void>;
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const navigate = useNavigate();
  const [form, setForm] = useState<LoginRequest>({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await login(form);
      await onAuthenticated();
      navigate('/home', { replace: true });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Enter Masq"
      subtitle="Use your account to continue as a mask, never as a global identity."
      footer={
        <>
          New to Masq?{' '}
          <Link className="text-neon-400 hover:text-white" to="/register">
            Create an account
          </Link>
          .
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-500">Email</label>
          <input
            autoComplete="email"
            data-testid="login-email-input"
            className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-white outline-none ring-0 placeholder:text-slate-600 focus:border-neon-400"
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-500">Password</label>
          <input
            autoComplete="current-password"
            data-testid="login-password-input"
            className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-white outline-none ring-0 placeholder:text-slate-600 focus:border-neon-400"
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            required
          />
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <button
          data-testid="login-submit-button"
          className="w-full rounded-xl border border-neon-400/40 bg-neon-400/10 px-4 py-2 text-sm font-medium text-neon-400 transition hover:border-neon-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={submitting}
        >
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
}
