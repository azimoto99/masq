import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
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
      <BrowserRouter>
        <RtcAuthGuard sessionStatus={session.status} />
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(29,44,64,0.88),_rgba(8,10,14,1)_66%)] px-3 py-4 sm:px-4 sm:py-6 md:px-8 md:py-10">
          {session.status === 'loading' ? (
            <div className="mx-auto mt-20 max-w-5xl">
              <FullScreenLoading />
            </div>
          ) : (
            <Routes>
              <Route
                path="/"
                element={
                  session.status === 'authenticated' ? (
                    <Navigate to="/home" replace />
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
              <Route
                path="/login"
                element={
                  session.status === 'authenticated' ? (
                    <Navigate to="/home" replace />
                  ) : (
                    <div className="mx-auto mt-12 max-w-5xl">
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
                    <div className="mx-auto mt-12 max-w-5xl">
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
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </div>
      </BrowserRouter>
    </RtcProvider>
  );
}
