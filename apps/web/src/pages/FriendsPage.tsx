import { type FormEvent, useEffect, useState } from 'react';
import {
  type FriendUser,
  type IncomingFriendRequestItem,
  type MeResponse,
  type OutgoingFriendRequestItem,
} from '@masq/shared';
import { useNavigate } from 'react-router-dom';
import {
  ApiError,
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  listFriendRequests,
  listFriends,
  sendFriendRequest,
  startDm,
  unfriend,
} from '../lib/api';
import { BrandLogo } from '../components/BrandLogo';
import { MaskAvatar } from '../components/MaskAvatar';

interface FriendsPageProps {
  me: MeResponse;
}

export function FriendsPage({ me }: FriendsPageProps) {
  const navigate = useNavigate();
  const [friendCode, setFriendCode] = useState('');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incoming, setIncoming] = useState<IncomingFriendRequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingFriendRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [busyFriendUserId, setBusyFriendUserId] = useState<string | null>(null);
  const [busyStartDmUserId, setBusyStartDmUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const resolveInitialMaskId = () => {
    if (me.masks.length === 0) {
      return null;
    }

    const persistedMaskId = window.localStorage.getItem('masq.activeMaskId');
    if (persistedMaskId && me.masks.some((mask) => mask.id === persistedMaskId)) {
      return persistedMaskId;
    }

    return me.masks[0].id;
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [friendsResponse, requestsResponse] = await Promise.all([
        listFriends(),
        listFriendRequests(),
      ]);
      setFriends(friendsResponse.friends);
      setIncoming(requestsResponse.incoming);
      setOutgoing(requestsResponse.outgoing);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSendRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedFriendCode = friendCode.trim().toUpperCase();
    if (!normalizedFriendCode) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await sendFriendRequest({ friendCode: normalizedFriendCode });
      setFriendCode('');
      setNotice('Friend request sent');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send friend request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyFriendCode = async () => {
    setError(null);
    setNotice(null);
    try {
      await navigator.clipboard.writeText(me.user.friendCode);
      setNotice('Friend code copied');
    } catch {
      setError('Could not copy friend code');
    }
  };

  const handleAccept = async (requestId: string) => {
    setBusyRequestId(requestId);
    setError(null);
    setNotice(null);
    try {
      await acceptFriendRequest(requestId);
      setNotice('Friend request accepted');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to accept request');
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleDecline = async (requestId: string) => {
    setBusyRequestId(requestId);
    setError(null);
    setNotice(null);
    try {
      await declineFriendRequest(requestId);
      setNotice('Friend request declined');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to decline request');
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    setBusyRequestId(requestId);
    setError(null);
    setNotice(null);
    try {
      await cancelFriendRequest(requestId);
      setNotice('Friend request canceled');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to cancel request');
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleUnfriend = async (friendUserId: string) => {
    setBusyFriendUserId(friendUserId);
    setError(null);
    setNotice(null);
    try {
      await unfriend(friendUserId);
      setNotice('Friend removed');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to unfriend user');
    } finally {
      setBusyFriendUserId(null);
    }
  };

  const handleStartDm = async (friendUserId: string) => {
    const initialMaskId = resolveInitialMaskId();
    if (!initialMaskId) {
      setError('Create a mask before starting DMs');
      return;
    }

    setBusyStartDmUserId(friendUserId);
    setError(null);
    setNotice(null);

    try {
      const response = await startDm({
        friendUserId,
        initialMaskId,
      });
      navigate(`/dm/${response.thread.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start DM');
    } finally {
      setBusyStartDmUserId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <header className="masq-panel rounded-2xl p-5">
        <div>
          <BrandLogo />
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Social Graph</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Friends</h1>
          <p className="mt-2 text-sm text-slate-400">Account-level relationships, mask-level presence stays contextual.</p>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.1fr,1fr]">
        <div className="space-y-6">
          <form onSubmit={handleSendRequest} className="masq-panel rounded-xl p-5">
            <h2 className="text-sm uppercase tracking-[0.28em] text-slate-500">Add Friend</h2>
            <p className="mt-2 text-xs text-slate-400">Signed in as {me.user.email}</p>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-ink-700 bg-ink-900/70 px-3 py-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Your Friend Code</p>
                <p className="font-mono text-sm text-cyan-200">{me.user.friendCode}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleCopyFriendCode();
                }}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.15em] text-cyan-200 hover:border-cyan-400"
              >
                Copy
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-neon-400"
                placeholder="Friend code (e.g. AB12CD34)"
                value={friendCode}
                onChange={(event) => setFriendCode(event.target.value.toUpperCase())}
                type="text"
                data-testid="friends-add-code-input"
                required
              />
              <button
                type="submit"
                disabled={submitting}
                data-testid="friends-add-submit-button"
                className="rounded-xl border border-neon-400/40 bg-neon-400/10 px-4 py-2 text-sm font-medium text-neon-300 transition hover:border-neon-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </form>

          <div className="masq-panel rounded-xl p-5">
            <h2 className="text-sm uppercase tracking-[0.28em] text-slate-500">Incoming Requests</h2>
            <div className="mt-4 space-y-3">
              {loading ? <p className="text-sm text-slate-500">Loading...</p> : null}
              {!loading && incoming.length === 0 ? (
                <p className="text-sm text-slate-500">No incoming requests.</p>
              ) : null}
              {incoming.map((item) => (
                <article key={item.request.id} className="masq-panel-muted rounded-lg p-3.5">
                  <p className="text-sm text-white">{item.fromUser.email}</p>
                  <p className="mt-1 font-mono text-[11px] text-cyan-200">Code: {item.fromUser.friendCode}</p>
                  {item.fromUser.defaultMask ? (
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <MaskAvatar
                        displayName={item.fromUser.defaultMask.displayName}
                        color={item.fromUser.defaultMask.color}
                        avatarUploadId={item.fromUser.defaultMask.avatarUploadId}
                        sizeClassName="h-5 w-5"
                        textClassName="text-[8px]"
                      />
                      <span>
                        default mask: {item.fromUser.defaultMask.displayName} ({item.fromUser.defaultMask.avatarSeed})
                      </span>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">default mask: none</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void handleAccept(item.request.id);
                      }}
                      disabled={busyRequestId === item.request.id}
                      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.15em] text-emerald-200 hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDecline(item.request.id);
                      }}
                      disabled={busyRequestId === item.request.id}
                      className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs uppercase tracking-[0.15em] text-rose-200 hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="masq-panel rounded-xl p-5">
            <h2 className="text-sm uppercase tracking-[0.28em] text-slate-500">Outgoing Requests</h2>
            <div className="mt-4 space-y-3">
              {loading ? <p className="text-sm text-slate-500">Loading...</p> : null}
              {!loading && outgoing.length === 0 ? (
                <p className="text-sm text-slate-500">No outgoing requests.</p>
              ) : null}
              {outgoing.map((item) => (
                <article key={item.request.id} className="masq-panel-muted rounded-lg p-3.5">
                  <p className="text-sm text-white">{item.toUser.email}</p>
                  <p className="mt-1 font-mono text-[11px] text-cyan-200">Code: {item.toUser.friendCode}</p>
                  <button
                    type="button"
                    onClick={() => {
                      void handleCancel(item.request.id);
                    }}
                    disabled={busyRequestId === item.request.id}
                    className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs uppercase tracking-[0.15em] text-amber-200 hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </article>
              ))}
            </div>
          </div>
        </div>

        <aside className="masq-panel rounded-xl p-5">
          <h2 className="text-sm uppercase tracking-[0.28em] text-slate-500">Friends</h2>
          <div className="mt-4 space-y-3">
            {loading ? <p className="text-sm text-slate-500">Loading...</p> : null}
            {!loading && friends.length === 0 ? <p className="text-sm text-slate-500">No friends yet.</p> : null}
            {friends.map((friend) => (
              <article key={friend.id} className="masq-panel-muted rounded-lg p-3.5">
                <p className="text-sm text-white">
                  {friend.defaultMask?.displayName ?? 'Masked Contact'}
                </p>
                <p className="mt-1 font-mono text-[11px] text-cyan-200">Code: {friend.friendCode}</p>
                {friend.defaultMask ? (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <MaskAvatar
                      displayName={friend.defaultMask.displayName}
                      color={friend.defaultMask.color}
                      avatarUploadId={friend.defaultMask.avatarUploadId}
                      sizeClassName="h-5 w-5"
                      textClassName="text-[8px]"
                    />
                    <span>{friend.defaultMask.displayName}</span>
                    <span>{friend.defaultMask.avatarSeed}</span>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">default mask: none</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setNotice('Profile view is not implemented yet')}
                    className="rounded-lg border border-ink-700 px-3 py-1 text-xs uppercase tracking-[0.15em] text-slate-300 hover:border-slate-500 hover:text-white"
                  >
                    Open Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleStartDm(friend.id);
                    }}
                    disabled={busyStartDmUserId === friend.id}
                    className="rounded-lg border border-neon-400/40 bg-neon-400/10 px-3 py-1 text-xs uppercase tracking-[0.15em] text-neon-300 hover:border-neon-400 hover:text-white"
                  >
                    {busyStartDmUserId === friend.id ? 'Starting...' : 'Start DM'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleUnfriend(friend.id);
                    }}
                    disabled={busyFriendUserId === friend.id}
                    className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs uppercase tracking-[0.15em] text-rose-200 hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Unfriend
                  </button>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </section>

      {notice ? (
        <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}
