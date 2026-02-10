import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { RegisterRequest } from '@masq/shared';
import { AuthShell } from '../components/AuthShell';
import { ApiError, register } from '../lib/api';

interface RegisterPageProps {
  onAuthenticated: () => Promise<void>;
}

export function RegisterPage({ onAuthenticated }: RegisterPageProps) {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterRequest>({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await register(form);
      await onAuthenticated();
      navigate('/home', { replace: true });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Registration failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create Account"
      subtitle="Accounts unlock mask identities. Your rooms and messages still run through masks."
      footer={
        <>
          Already have an account?{' '}
          <Link className="text-neon-400 hover:text-white" to="/login">
            Sign in
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
            data-testid="register-email-input"
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
            autoComplete="new-password"
            data-testid="register-password-input"
            className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-white outline-none ring-0 placeholder:text-slate-600 focus:border-neon-400"
            type="password"
            minLength={8}
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
          data-testid="register-submit-button"
          className="w-full rounded-xl border border-neon-400/40 bg-neon-400/10 px-4 py-2 text-sm font-medium text-neon-400 transition hover:border-neon-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={submitting}
        >
          {submitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
}
