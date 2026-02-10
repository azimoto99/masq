import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { MeResponse } from '@masq/shared';
import { ApiError, getMe, logout } from './lib/api';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { MasksPage } from './pages/MasksPage';
import { RegisterPage } from './pages/RegisterPage';
import { RoomChatPage } from './pages/RoomChatPage';
import { FriendsPage } from './pages/FriendsPage';
import { DmPage } from './pages/DmPage';
import { ServersPage } from './pages/ServersPage';

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

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(39,48,68,0.85),_rgba(9,10,14,1)_65%)] px-4 py-10 md:px-8">
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
              element={
                session.status === 'authenticated' ? (
                  <div className="mx-auto max-w-6xl">
                    <HomePage me={session.me} />
                  </div>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/masks"
              element={
                session.status === 'authenticated' ? (
                  <div className="mx-auto max-w-5xl">
                    <MasksPage me={session.me} onRefresh={refreshSession} onLogout={handleLogout} />
                  </div>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/rooms"
              element={
                session.status === 'authenticated' ? (
                  <div className="mx-auto max-w-6xl">
                    <RoomChatPage me={session.me} />
                  </div>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/rooms/:roomId"
              element={
                session.status === 'authenticated' ? (
                  <div className="mx-auto max-w-6xl">
                    <RoomChatPage me={session.me} />
                  </div>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/friends"
              element={
                session.status === 'authenticated' ? (
                  <div className="mx-auto max-w-6xl">
                    <FriendsPage me={session.me} />
                  </div>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/dm"
              element={
                session.status === 'authenticated' ? (
                  <div className="mx-auto max-w-6xl">
                    <DmPage me={session.me} />
                  </div>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/dm/:threadId"
              element={
                session.status === 'authenticated' ? (
                  <div className="mx-auto max-w-6xl">
                    <DmPage me={session.me} />
                  </div>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/servers"
              element={
                session.status === 'authenticated' ? (
                  <div className="mx-auto max-w-7xl">
                    <ServersPage me={session.me} />
                  </div>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/servers/:serverId"
              element={
                session.status === 'authenticated' ? (
                  <div className="mx-auto max-w-7xl">
                    <ServersPage me={session.me} />
                  </div>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/servers/:serverId/:channelId"
              element={
                session.status === 'authenticated' ? (
                  <div className="mx-auto max-w-7xl">
                    <ServersPage me={session.me} />
                  </div>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </div>
    </BrowserRouter>
  );
}
