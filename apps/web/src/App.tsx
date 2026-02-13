import { Component, type ErrorInfo, type ReactNode, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { MeResponse } from '@masq/shared';
import { ApiError, getMe, logout } from './lib/api';
import { AuthenticatedShell } from './components/AuthenticatedShell';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { MasksPage } from './pages/MasksPage';
import { RegisterPage } from './pages/RegisterPage';
import { RoomChatPage } from './pages/RoomChatPage';
import { FriendsPage } from './pages/FriendsPage';
import { DmPage } from './pages/DmPage';
import { ServersPage } from './pages/ServersPage';
import { NarrativePage } from './pages/NarrativePage';
import { PerksPage } from './pages/PerksPage';
import { LandingPage } from './pages/LandingPage';
import { RtcProvider, useRtc } from './rtc/RtcProvider';

type SessionState =
  | { status: 'loading' }
  | {
      status: 'authenticated';
      me: MeResponse;
    }
  | { status: 'anonymous' };

function FullScreenLoading() {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-ink-700 bg-ink-800/85 p-8 text-center text-sm text-slate-400 shadow-2xl shadow-black/40">
      Checking session...
    </div>
  );
}

interface RuntimeErrorBoundaryState {
  error: Error | null;
}

class RuntimeErrorBoundary extends Component<{ children: ReactNode }, RuntimeErrorBoundaryState> {
  state: RuntimeErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): RuntimeErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Masq UI runtime error:', error, errorInfo);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="mx-auto mt-20 max-w-2xl rounded-3xl border border-rose-500/45 bg-ink-900/95 p-6 shadow-2xl shadow-black/50">
        <p className="text-xs uppercase tracking-[0.16em] text-rose-300">Renderer Error</p>
        <h2 className="mt-2 text-lg font-semibold text-white">The page crashed unexpectedly.</h2>
        <p className="mt-2 text-sm text-slate-300">
          Reload the app. If this keeps happening, share the message below.
        </p>
        <p className="mt-3 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {this.state.error.message}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-cyan-100 hover:border-cyan-300 hover:text-white"
        >
          Reload App
        </button>
      </div>
    );
  }
}

function RtcAuthGuard({ sessionStatus }: { sessionStatus: SessionState['status'] }) {
  const { activeContext, leaveCall } = useRtc();

  useEffect(() => {
    if (sessionStatus !== 'anonymous' || !activeContext) {
      return;
    }

    void leaveCall();
  }, [activeContext, leaveCall, sessionStatus]);

  return null;
}

export default function App() {
  const [session, setSession] = useState<SessionState>({ status: 'loading' });
  const isDesktopQueryEnabled =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('desktop') === '1';
  const isElectronShell =
    isDesktopQueryEnabled ||
    (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron'));
  const Router = isElectronShell ? HashRouter : BrowserRouter;

  const refreshSession = useCallback(async () => {
    setSession({ status: 'loading' });

    try {
      const me = await getMe();
      setSession({ status: 'authenticated', me });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setSession({ status: 'anonymous' });
        return;
      }

      setSession({ status: 'anonymous' });
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } finally {
      setSession({ status: 'anonymous' });
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const renderAuthenticated = (content: (me: MeResponse) => ReactNode) => {
    if (session.status !== 'authenticated') {
      return <Navigate to="/login" replace />;
    }

    return (
      <AuthenticatedShell me={session.me} onLogout={handleLogout}>
        {content(session.me)}
      </AuthenticatedShell>
    );
  };

  return (
    <RtcProvider>
      <Router>
        <RuntimeErrorBoundary>
          <RtcAuthGuard sessionStatus={session.status} />
          <div className="h-dvh overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(29,44,64,0.88),_rgba(8,10,14,1)_66%)] p-3 sm:p-4 md:p-5">
            {session.status === 'loading' ? (
              <div className="flex h-full items-center justify-center">
                <FullScreenLoading />
              </div>
            ) : (
              <div className="h-full min-h-0">
                <Routes>
                  <Route
                    path="/"
                    element={
                      session.status === 'authenticated' ? (
                        <Navigate to="/home" replace />
                      ) : (
                        <LandingPage />
                      )
                    }
                  />
                  <Route
                    path="/landing"
                    element={
                      session.status === 'authenticated' ? (
                        <Navigate to="/home" replace />
                      ) : (
                        <LandingPage />
                      )
                    }
                  />
                  <Route
                    path="/login"
                    element={
                      session.status === 'authenticated' ? (
                        <Navigate to="/home" replace />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <LoginPage onAuthenticated={refreshSession} />
                        </div>
                      )
                    }
                  />
                  <Route
                    path="/register"
                    element={
                      session.status === 'authenticated' ? (
                        <Navigate to="/home" replace />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <RegisterPage onAuthenticated={refreshSession} />
                        </div>
                      )
                    }
                  />
                  <Route
                    path="/home"
                    element={renderAuthenticated((me) => <HomePage me={me} />)}
                  />
                  <Route
                    path="/masks"
                    element={renderAuthenticated((me) => (
                      <MasksPage me={me} onRefresh={refreshSession} />
                    ))}
                  />
                  <Route
                    path="/rooms"
                    element={renderAuthenticated((me) => <RoomChatPage me={me} />)}
                  />
                  <Route
                    path="/rooms/:roomId"
                    element={renderAuthenticated((me) => <RoomChatPage me={me} />)}
                  />
                  <Route
                    path="/friends"
                    element={renderAuthenticated((me) => <FriendsPage me={me} />)}
                  />
                  <Route
                    path="/dm"
                    element={renderAuthenticated((me) => <DmPage me={me} />)}
                  />
                  <Route
                    path="/dm/:threadId"
                    element={renderAuthenticated((me) => <DmPage me={me} />)}
                  />
                  <Route
                    path="/servers"
                    element={renderAuthenticated((me) => <ServersPage me={me} />)}
                  />
                  <Route
                    path="/servers/:serverId"
                    element={renderAuthenticated((me) => <ServersPage me={me} />)}
                  />
                  <Route
                    path="/servers/:serverId/:channelId"
                    element={renderAuthenticated((me) => <ServersPage me={me} />)}
                  />
                  <Route
                    path="/narrative"
                    element={renderAuthenticated((me) => <NarrativePage me={me} />)}
                  />
                  <Route
                    path="/narrative/:roomId"
                    element={renderAuthenticated((me) => <NarrativePage me={me} />)}
                  />
                  <Route
                    path="/perks"
                    element={renderAuthenticated((me) => (
                      <PerksPage me={me} onRefresh={refreshSession} />
                    ))}
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            )}
          </div>
        </RuntimeErrorBoundary>
      </Router>
    </RtcProvider>
  );
}
