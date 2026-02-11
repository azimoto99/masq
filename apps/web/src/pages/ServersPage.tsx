import {
  ALL_SERVER_PERMISSIONS,
  ClientSocketEventSchema,
  MAX_ROOM_MESSAGE_LENGTH,
  ServerSocketEventSchema,
  type ChannelMessage,
  type GetServerResponse,
  type ListServerRolesResponse,
  type MeResponse,
  type ServerPermission,
  type ServerChannelMemberState,
  type ServerListItem,
  type ServerMember,
  type ServerMemberRole,
} from '@masq/shared';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ApiError,
  buildUploadUrl,
  createServerRole,
  createServer,
  createServerChannel,
  createServerInvite,
  deleteServerChannel,
  getServer,
  joinServer,
  kickServerMember,
  listServerRoles,
  listServers,
  setChannelMask,
  sendFriendRequest,
  setServerMemberRoles,
  setServerMask,
  uploadImage,
  updateServerSettings,
  updateServerRole,
} from '../lib/api';
import { createRealtimeSocket } from '../lib/realtime';
import { MaskAvatar } from '../components/MaskAvatar';
import { SpacesSidebar } from '../components/SpacesSidebar';
import { CallBar } from '../components/rtc/CallBar';
import { CallPanel } from '../components/rtc/CallPanel';
import { VideoStage } from '../components/rtc/VideoStage';
import { useRtcScope } from '../rtc/RtcProvider';

interface ServersPageProps {
  me: MeResponse;
}

const ACTIVE_MASK_STORAGE_KEY = 'masq.activeMaskId';

const formatTimestamp = (isoDate: string) =>
  new Date(isoDate).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

const hasPermission = (permissions: readonly ServerPermission[], permission: ServerPermission) =>
  permissions.includes(permission);

export function ServersPage({ me }: ServersPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams<{ serverId: string; channelId: string }>();
  const selectedServerId = params.serverId ?? null;
  const selectedChannelId = params.channelId ?? null;

  const socketRef = useRef<WebSocket | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);

  const [servers, setServers] = useState<ServerListItem[]>([]);
  const [serversLoading, setServersLoading] = useState(false);
  const [serversError, setServersError] = useState<string | null>(null);

  const [serverDetails, setServerDetails] = useState<GetServerResponse | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [channelMembers, setChannelMembers] = useState<ServerChannelMemberState[]>([]);
  const [channelMessages, setChannelMessages] = useState<ChannelMessage[]>([]);

  const [createServerName, setCreateServerName] = useState('Masq Guild');
  const [createServerPending, setCreateServerPending] = useState(false);

  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [inviteMaskId, setInviteMaskId] = useState<string>(
    () => window.localStorage.getItem(ACTIVE_MASK_STORAGE_KEY) ?? me.masks[0]?.id ?? '',
  );
  const [joinPending, setJoinPending] = useState(false);

  const [createChannelName, setCreateChannelName] = useState('general-chat');
  const [createChannelPending, setCreateChannelPending] = useState(false);
  const [deleteChannelPendingId, setDeleteChannelPendingId] = useState<string | null>(null);

  const [createInvitePending, setCreateInvitePending] = useState(false);
  const [latestInviteCode, setLatestInviteCode] = useState<string | null>(null);

  const [composerBody, setComposerBody] = useState('');
  const [composerImageFile, setComposerImageFile] = useState<File | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [socketStatus, setSocketStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>(
    'idle',
  );
  const [socketError, setSocketError] = useState<string | null>(null);
  const [settingsPending, setSettingsPending] = useState(false);
  const [channelMaskPending, setChannelMaskPending] = useState(false);
  const [maskChangePending, setMaskChangePending] = useState(false);
  const [kickPendingUserId, setKickPendingUserId] = useState<string | null>(null);
  const [friendRequestPendingUserId, setFriendRequestPendingUserId] = useState<string | null>(null);
  const [friendRequestNotice, setFriendRequestNotice] = useState<string | null>(null);
  const [memberActionMenuUserId, setMemberActionMenuUserId] = useState<string | null>(null);
  const [rolesPayload, setRolesPayload] = useState<ListServerRolesResponse | null>(null);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [createRoleName, setCreateRoleName] = useState('Moderator');
  const [createRolePermissions, setCreateRolePermissions] = useState<ServerPermission[]>([]);
  const [createRolePending, setCreateRolePending] = useState(false);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, { name: string; permissions: ServerPermission[] }>>(
    {},
  );
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [memberRoleSelections, setMemberRoleSelections] = useState<Record<string, string[]>>({});
  const [memberBaseRoles, setMemberBaseRoles] = useState<Record<string, ServerMemberRole>>({});
  const [saveMemberRolesPendingUserId, setSaveMemberRolesPendingUserId] = useState<string | null>(null);
  const [contextTab, setContextTab] = useState<'members' | 'roles' | 'call'>('members');
  const [serverDialogOpen, setServerDialogOpen] = useState(false);
  const [serverDialogTab, setServerDialogTab] = useState<'create' | 'join'>('create');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileContextOpen, setMobileContextOpen] = useState(false);
  const globalActiveMaskId = window.localStorage.getItem(ACTIVE_MASK_STORAGE_KEY) ?? me.masks[0]?.id ?? null;
  const serverDialogQuery = searchParams.get('serverDialog');

  const selectedChannel = useMemo(
    () => serverDetails?.channels.find((channel) => channel.id === selectedChannelId) ?? null,
    [selectedChannelId, serverDetails],
  );

  const myServerMember = useMemo(
    () => serverDetails?.members.find((member) => member.userId === me.user.id) ?? null,
    [me.user.id, serverDetails],
  );

  const myPermissions = serverDetails?.myPermissions ?? [];
  const canManageChannels = hasPermission(myPermissions, 'ManageChannels');
  const canManageInvites = hasPermission(myPermissions, 'CreateInvites');
  const canManageMembers = hasPermission(myPermissions, 'ManageMembers');
  const canModerateChat = hasPermission(myPermissions, 'ModerateChat');
  const canKickMembers = canManageMembers || canModerateChat;
  const serverRoles = rolesPayload?.roles ?? [];
  const channelIdentityMode = serverDetails?.server.channelIdentityMode ?? 'SERVER_MASK';
  const isChannelMaskMode = channelIdentityMode === 'CHANNEL_MASK';
  const myChannelMember = useMemo(
    () => channelMembers.find((member) => member.userId === me.user.id) ?? null,
    [channelMembers, me.user.id],
  );
  const currentChannelMaskId = myChannelMember?.mask.maskId ?? myServerMember?.serverMask.id ?? '';
  const canModerateRtc = myServerMember?.role === 'OWNER' || myServerMember?.role === 'ADMIN';
  const rtc = useRtcScope({
    contextType: 'SERVER_CHANNEL',
    contextId: selectedChannel?.id ?? null,
    maskId: currentChannelMaskId || null,
    actorMaskId: currentChannelMaskId || null,
    canModerate: canModerateRtc,
    canEndCall: canModerateRtc,
    disabled: !selectedChannel || !currentChannelMaskId,
    disabledReason: 'Select a channel mask before joining call.',
    label:
      selectedChannel && serverDetails
        ? `${serverDetails.server.name} - #${selectedChannel.name}`
        : selectedChannel
          ? `#${selectedChannel.name}`
          : 'Server Voice',
  });
  const showVideoStage = rtc.isCurrentContext && rtc.hasVisualMedia;

  const onlineUserIds = useMemo(
    () => new Set(channelMembers.map((member) => member.userId)),
    [channelMembers],
  );

  useEffect(() => {
    if (!messageListRef.current) {
      return;
    }

    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [channelMessages]);

  const reloadServers = useCallback(async () => {
    setServersLoading(true);
    setServersError(null);
    try {
      const response = await listServers();
      setServers(response.servers);
    } catch (err) {
      setServersError(err instanceof ApiError ? err.message : 'Failed to load servers');
    } finally {
      setServersLoading(false);
    }
  }, []);

  const reloadServerDetails = useCallback(async (serverId: string) => {
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const response = await getServer(serverId);
      setServerDetails(response);
      if (response.channels.length > 0) {
        const hasSelected = response.channels.some((channel) => channel.id === selectedChannelId);
        if (!selectedChannelId || !hasSelected) {
          navigate(`/servers/${serverId}/${response.channels[0].id}`, { replace: true });
        }
      }
      if (response.channels.length === 0 && selectedChannelId) {
        navigate(`/servers/${serverId}`, { replace: true });
      }
    } catch (err) {
      setServerDetails(null);
      setDetailsError(err instanceof ApiError ? err.message : 'Failed to load server');
    } finally {
      setDetailsLoading(false);
    }
  }, [navigate, selectedChannelId]);

  const reloadServerRoles = useCallback(async (serverId: string) => {
    setRolesLoading(true);
    setRolesError(null);
    try {
      const response = await listServerRoles(serverId);
      setRolesPayload(response);
      setRoleDrafts(
        Object.fromEntries(
          response.roles.map((role) => [
            role.id,
            {
              name: role.name,
              permissions: [...role.permissions],
            },
          ]),
        ),
      );
    } catch (err) {
      setRolesPayload(null);
      setRolesError(err instanceof ApiError ? err.message : 'Failed to load server roles');
    } finally {
      setRolesLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadServers();
  }, [reloadServers]);

  useEffect(() => {
    if (!selectedServerId) {
      setServerDetails(null);
      setDetailsError(null);
      setRolesPayload(null);
      setRolesError(null);
      setRoleDrafts({});
      setMemberRoleSelections({});
      setChannelMembers([]);
      setChannelMessages([]);
      return;
    }

    void reloadServerDetails(selectedServerId);
    void reloadServerRoles(selectedServerId);
  }, [reloadServerDetails, reloadServerRoles, selectedServerId]);

  useEffect(() => {
    if (!serverDetails) {
      setMemberRoleSelections({});
      setMemberBaseRoles({});
      return;
    }

    setMemberRoleSelections(
      Object.fromEntries(
        serverDetails.members.map((member) => [member.userId, [...member.roleIds]]),
      ),
    );
    setMemberBaseRoles(
      Object.fromEntries(serverDetails.members.map((member) => [member.userId, member.role])),
    );
  }, [serverDetails]);

  useEffect(() => {
    if (contextTab === 'roles' && !canManageMembers) {
      setContextTab('members');
    }
  }, [canManageMembers, contextTab]);

  useEffect(() => {
    if (serverDialogQuery !== 'create' && serverDialogQuery !== 'join') {
      return;
    }

    setServerDialogTab(serverDialogQuery);
    setServerDialogOpen(true);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('serverDialog');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, serverDialogQuery, setSearchParams]);

  useEffect(() => {
    setMobileSidebarOpen(false);
    setMobileContextOpen(false);
  }, [selectedServerId, selectedChannelId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (socket) {
      socket.close();
      socketRef.current = null;
    }

    setChannelMembers([]);
    setChannelMessages([]);
    setSocketError(null);

    if (!selectedChannel) {
      setSocketStatus('idle');
      return;
    }

    let ws: WebSocket;
    try {
      ws = createRealtimeSocket();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Socket URL is invalid';
      setSocketStatus('disconnected');
      setSocketError(`Realtime connection failed: ${message}`);
      return;
    }

    socketRef.current = ws;
    setSocketStatus('connecting');

    ws.onopen = () => {
      setSocketStatus('connected');
      const joinEvent = ClientSocketEventSchema.parse({
        type: 'JOIN_CHANNEL',
        data: {
          channelId: selectedChannel.id,
        },
      });
      ws.send(JSON.stringify(joinEvent));
    };

    ws.onmessage = (event) => {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(event.data as string);
      } catch {
        setSocketError('Socket payload could not be parsed');
        return;
      }

      const parsedEvent = ServerSocketEventSchema.safeParse(parsedJson);
      if (!parsedEvent.success) {
        setSocketError('Unexpected socket event payload');
        return;
      }

      const socketEvent = parsedEvent.data;
      switch (socketEvent.type) {
        case 'CHANNEL_STATE': {
          if (socketEvent.data.channel.id !== selectedChannel.id) {
            return;
          }

          setChannelMembers(socketEvent.data.members);
          setChannelMessages(socketEvent.data.recentMessages);
          setSocketError(null);
          break;
        }
        case 'NEW_CHANNEL_MESSAGE': {
          if (socketEvent.data.message.channelId !== selectedChannel.id) {
            return;
          }

          setChannelMessages((current) => [...current, socketEvent.data.message]);
          break;
        }
        case 'MEMBER_JOINED': {
          const payload = socketEvent.data;
          if (!('channelId' in payload) || payload.channelId !== selectedChannel.id) {
            return;
          }
          const joinedMember = payload.member;

          setChannelMembers((current) => {
            const exists = current.some((member) => member.userId === joinedMember.userId);
            if (exists) {
              return current;
            }
            return [...current, joinedMember];
          });
          break;
        }
        case 'MEMBER_LEFT': {
          const payload = socketEvent.data;
          if (!('channelId' in payload) || payload.channelId !== selectedChannel.id) {
            return;
          }
          const leftMember = payload.member;

          setChannelMembers((current) =>
            current.filter((member) => member.userId !== leftMember.userId),
          );
          break;
        }
        case 'ERROR': {
          setSocketError(socketEvent.data.message);
          break;
        }
        default:
          break;
      }
    };

    ws.onclose = () => {
      setSocketStatus('disconnected');
    };

    return () => {
      ws.close();
    };
  }, [selectedChannel]);

  const onCreateServer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateServerPending(true);
    setServersError(null);
    try {
      const response = await createServer({ name: createServerName });
      await reloadServers();
      navigate(`/servers/${response.server.id}`);
      setServerDialogOpen(false);
    } catch (err) {
      setServersError(err instanceof ApiError ? err.message : 'Failed to create server');
    } finally {
      setCreateServerPending(false);
    }
  };

  const onJoinServer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteMaskId) {
      setServersError('Select a mask to join server');
      return;
    }

    setJoinPending(true);
    setServersError(null);
    try {
      const response = await joinServer({
        inviteCode: inviteCodeInput.trim().toUpperCase(),
        serverMaskId: inviteMaskId,
      });
      setInviteCodeInput('');
      await reloadServers();
      navigate(`/servers/${response.serverId}`);
      setServerDialogOpen(false);
    } catch (err) {
      setServersError(err instanceof ApiError ? err.message : 'Failed to join server');
    } finally {
      setJoinPending(false);
    }
  };

  const onCreateChannel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedServerId) {
      return;
    }

    setCreateChannelPending(true);
    setDetailsError(null);
    try {
      const response = await createServerChannel(selectedServerId, { name: createChannelName });
      await reloadServerDetails(selectedServerId);
      navigate(`/servers/${selectedServerId}/${response.channel.id}`);
      setCreateChannelName('new-channel');
    } catch (err) {
      setDetailsError(err instanceof ApiError ? err.message : 'Failed to create channel');
    } finally {
      setCreateChannelPending(false);
    }
  };

  const onDeleteChannel = async (channelId: string) => {
    if (!selectedServerId) {
      return;
    }

    setDeleteChannelPendingId(channelId);
    setDetailsError(null);
    try {
      await deleteServerChannel(selectedServerId, channelId);
      await reloadServerDetails(selectedServerId);
    } catch (err) {
      setDetailsError(err instanceof ApiError ? err.message : 'Failed to delete channel');
    } finally {
      setDeleteChannelPendingId(null);
    }
  };

  const onCreateInvite = async () => {
    if (!selectedServerId) {
      return;
    }

    setCreateInvitePending(true);
    setDetailsError(null);
    try {
      const response = await createServerInvite(selectedServerId, {
        expiresMinutes: 120,
        maxUses: 25,
      });
      setLatestInviteCode(response.invite.code);
    } catch (err) {
      setDetailsError(err instanceof ApiError ? err.message : 'Failed to create invite');
    } finally {
      setCreateInvitePending(false);
    }
  };

  const onChangeServerMask = async (nextMaskId: string) => {
    if (!selectedServerId) {
      return;
    }

    setMaskChangePending(true);
    setDetailsError(null);
    try {
      await setServerMask(selectedServerId, { serverMaskId: nextMaskId });
      window.localStorage.setItem(ACTIVE_MASK_STORAGE_KEY, nextMaskId);
      await Promise.all([reloadServers(), reloadServerDetails(selectedServerId)]);
    } catch (err) {
      setDetailsError(err instanceof ApiError ? err.message : 'Failed to change server mask');
    } finally {
      setMaskChangePending(false);
    }
  };

  const onUpdateChannelIdentityMode = async (nextMode: 'SERVER_MASK' | 'CHANNEL_MASK') => {
    if (!selectedServerId) {
      return;
    }

    setSettingsPending(true);
    setDetailsError(null);
    try {
      await updateServerSettings(selectedServerId, {
        channelIdentityMode: nextMode,
      });
      await Promise.all([reloadServers(), reloadServerDetails(selectedServerId), reloadServerRoles(selectedServerId)]);
    } catch (err) {
      setDetailsError(err instanceof ApiError ? err.message : 'Failed to update server settings');
    } finally {
      setSettingsPending(false);
    }
  };

  const onChangeChannelMask = async (nextMaskId: string) => {
    if (!selectedChannel) {
      return;
    }

    setChannelMaskPending(true);
    setSocketError(null);
    try {
      await setChannelMask(selectedChannel.id, {
        maskId: nextMaskId,
      });
    } catch (err) {
      setSocketError(err instanceof ApiError ? err.message : 'Failed to set channel mask');
    } finally {
      setChannelMaskPending(false);
    }
  };

  const togglePermission = (
    current: readonly ServerPermission[],
    permission: ServerPermission,
  ): ServerPermission[] => {
    if (current.includes(permission)) {
      return current.filter((value) => value !== permission);
    }
    return [...current, permission];
  };

  const onCreateRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedServerId) {
      return;
    }

    setCreateRolePending(true);
    setRolesError(null);
    try {
      await createServerRole(selectedServerId, {
        name: createRoleName,
        permissions: createRolePermissions,
      });
      setCreateRoleName('Role');
      setCreateRolePermissions([]);
      await Promise.all([reloadServerRoles(selectedServerId), reloadServerDetails(selectedServerId)]);
    } catch (err) {
      setRolesError(err instanceof ApiError ? err.message : 'Failed to create role');
    } finally {
      setCreateRolePending(false);
    }
  };

  const onSaveRole = async (roleId: string) => {
    if (!selectedServerId) {
      return;
    }

    const draft = roleDrafts[roleId];
    if (!draft) {
      return;
    }

    setSavingRoleId(roleId);
    setRolesError(null);
    try {
      await updateServerRole(selectedServerId, roleId, {
        name: draft.name,
        permissions: draft.permissions,
      });
      await Promise.all([reloadServerRoles(selectedServerId), reloadServerDetails(selectedServerId)]);
    } catch (err) {
      setRolesError(err instanceof ApiError ? err.message : 'Failed to update role');
    } finally {
      setSavingRoleId(null);
    }
  };

  const onSaveMemberRoles = async (targetUserId: string) => {
    if (!selectedServerId) {
      return;
    }

    const roleIds = memberRoleSelections[targetUserId] ?? [];
    const selectedMemberRole = memberBaseRoles[targetUserId];
    setSaveMemberRolesPendingUserId(targetUserId);
    setDetailsError(null);
    try {
      await setServerMemberRoles(selectedServerId, targetUserId, {
        roleIds,
        ...(selectedMemberRole === 'ADMIN' || selectedMemberRole === 'MEMBER'
          ? { memberRole: selectedMemberRole }
          : {}),
      });
      await Promise.all([reloadServerRoles(selectedServerId), reloadServerDetails(selectedServerId)]);
    } catch (err) {
      setDetailsError(err instanceof ApiError ? err.message : 'Failed to update member roles');
    } finally {
      setSaveMemberRolesPendingUserId(null);
    }
  };

  const canKickMember = (target: ServerMember) => {
    if (!canKickMembers) {
      return false;
    }

    if (target.userId === me.user.id) {
      return false;
    }

    if (target.role === 'OWNER') {
      return false;
    }

    return true;
  };

  const onKickMember = async (targetUserId: string) => {
    if (!selectedServerId) {
      return;
    }

    setKickPendingUserId(targetUserId);
    setDetailsError(null);
    try {
      await kickServerMember(selectedServerId, targetUserId);
      await Promise.all([reloadServerRoles(selectedServerId), reloadServerDetails(selectedServerId)]);
    } catch (err) {
      setDetailsError(err instanceof ApiError ? err.message : 'Failed to kick member');
    } finally {
      setKickPendingUserId(null);
    }
  };

  const onSendFriendRequestByUserId = async (targetUserId: string) => {
    if (targetUserId === me.user.id) {
      return;
    }

    setFriendRequestPendingUserId(targetUserId);
    setFriendRequestNotice(null);
    setDetailsError(null);
    try {
      await sendFriendRequest({ toUserId: targetUserId });
      setFriendRequestNotice('Friend request sent');
      setMemberActionMenuUserId(null);
    } catch (err) {
      setDetailsError(err instanceof ApiError ? err.message : 'Failed to send friend request');
    } finally {
      setFriendRequestPendingUserId(null);
    }
  };

  const onSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedChannel || (!composerBody.trim() && !composerImageFile)) {
      return;
    }

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setSocketError('Socket is not connected');
      return;
    }

    setSendingMessage(true);
    setSocketError(null);
    try {
      let imageUploadId: string | undefined;
      if (composerImageFile) {
        const upload = await uploadImage(
          {
            contextType: 'SERVER_CHANNEL',
            contextId: selectedChannel.id,
          },
          composerImageFile,
        );
        imageUploadId = upload.upload.id;
      }

      const messageEvent = ClientSocketEventSchema.parse({
        type: 'SEND_CHANNEL_MESSAGE',
        data: {
          channelId: selectedChannel.id,
          body: composerBody,
          imageUploadId,
        },
      });

      socketRef.current.send(JSON.stringify(messageEvent));
      setComposerBody('');
      setComposerImageFile(null);
    } catch (err) {
      setSocketError(err instanceof ApiError ? err.message : 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const canJoinRtc = Boolean(selectedChannel && currentChannelMaskId);
  const isConnectedRtc =
    rtc.connectionState === 'connected' || rtc.connectionState === 'reconnecting' || rtc.inAnotherCall;

  return (
    <>
      <div className="mx-auto w-full max-w-[1520px]">
        <div className="mb-3 flex flex-wrap items-center gap-2 xl:hidden">
          <button
            type="button"
            onClick={() => {
              setMobileSidebarOpen((current) => !current);
            }}
            className={`rounded-md border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] transition ${
              mobileSidebarOpen
                ? 'border-neon-400/45 bg-neon-400/10 text-neon-100'
                : 'border-ink-700 bg-ink-900/80 text-slate-300'
            }`}
          >
            {mobileSidebarOpen ? 'Hide Spaces' : 'Show Spaces'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileContextOpen((current) => !current);
            }}
            className={`rounded-md border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] transition ${
              mobileContextOpen
                ? 'border-neon-400/45 bg-neon-400/10 text-neon-100'
                : 'border-ink-700 bg-ink-900/80 text-slate-300'
            }`}
          >
            {mobileContextOpen ? 'Hide Context' : 'Show Context'}
          </button>
        </div>
        <div className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <div className={`${mobileSidebarOpen ? 'block' : 'hidden'} order-2 xl:order-1 xl:block xl:sticky xl:top-4 xl:h-[calc(100vh-3rem)] xl:overflow-hidden`}>
            <div className="flex h-full flex-col gap-3">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="rounded-md border border-ink-700 bg-ink-900/80 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-300 xl:hidden"
              >
                Close Spaces
              </button>
              <SpacesSidebar
                className="flex-1 min-h-0"
                servers={servers}
                serversLoading={serversLoading}
                serversError={serversError}
                selectedServerId={selectedServerId}
                activeMaskId={globalActiveMaskId}
                onOpenServerDialog={() => {
                  setServerDialogTab('create');
                  setServerDialogOpen(true);
                }}
              />

              {selectedServerId && serverDetails ? (
                <div className="masq-panel-muted mt-auto space-y-2 rounded-xl p-2.5">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Active Server</p>
                    <p className="truncate text-sm font-medium text-white">{serverDetails.server.name}</p>
                    <p className="truncate text-[10px] uppercase tracking-[0.12em] text-slate-500">
                      {myServerMember
                        ? `${myServerMember.role} - ${myServerMember.serverMask.displayName}`
                        : 'No membership'}
                    </p>
                  </div>

                  {myServerMember ? (
                    <>
                      <label className="block">
                        <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-slate-500">
                          Server Mask
                        </span>
                        <select
                          className="w-full rounded-lg border border-ink-700 bg-ink-900 px-2 py-1.5 text-xs text-white focus:border-neon-400"
                          value={myServerMember.serverMask.id}
                          onChange={(event) => {
                            void onChangeServerMask(event.target.value);
                          }}
                          disabled={maskChangePending}
                        >
                          {me.masks.map((mask) => (
                            <option key={mask.id} value={mask.id}>
                              {mask.displayName}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-slate-500">
                          Identity Mode
                        </span>
                        <select
                          className="w-full rounded-lg border border-ink-700 bg-ink-900 px-2 py-1.5 text-xs text-white focus:border-neon-400"
                          value={channelIdentityMode}
                          onChange={(event) => {
                            void onUpdateChannelIdentityMode(event.target.value as 'SERVER_MASK' | 'CHANNEL_MASK');
                          }}
                          disabled={!canManageMembers || settingsPending}
                        >
                          <option value="SERVER_MASK">SERVER_MASK</option>
                          <option value="CHANNEL_MASK">CHANNEL_MASK</option>
                        </select>
                      </label>
                    </>
                  ) : null}

                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Channels</p>
                    </div>
                    <div className="space-y-1.5">
                      {serverDetails.channels.map((channel) => (
                        <div key={channel.id} className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => navigate(`/servers/${serverDetails.server.id}/${channel.id}`)}
                            className={`flex-1 rounded-md border px-2 py-1 text-left text-xs ${
                              selectedChannel?.id === channel.id
                                ? 'border-neon-400/45 bg-neon-400/10 text-white'
                                : 'border-ink-700 bg-ink-900/80 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            # {channel.name}
                          </button>
                          {canManageChannels ? (
                            <button
                              type="button"
                              onClick={() => {
                                void onDeleteChannel(channel.id);
                              }}
                              disabled={deleteChannelPendingId === channel.id}
                              className="rounded-md border border-rose-500/40 bg-rose-500/10 px-1.5 py-1 text-[10px] uppercase tracking-[0.11em] text-rose-200 hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Del
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  {canManageChannels ? (
                    <form onSubmit={onCreateChannel} className="space-y-1.5">
                      <input
                        className="w-full rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-white focus:border-neon-400"
                        value={createChannelName}
                        onChange={(event) => setCreateChannelName(event.target.value)}
                        maxLength={60}
                        required
                      />
                      <button
                        type="submit"
                        disabled={createChannelPending}
                        className="w-full rounded-md border border-neon-400/40 bg-neon-400/10 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-neon-200 hover:border-neon-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {createChannelPending ? 'Creating...' : 'New Channel'}
                      </button>
                    </form>
                  ) : null}

                  {canManageInvites ? (
                    <div className="space-y-1.5 rounded-md border border-ink-700 bg-ink-900/70 p-2">
                      <button
                        type="button"
                        onClick={() => {
                          void onCreateInvite();
                        }}
                        disabled={createInvitePending}
                        className="w-full rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-200 hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {createInvitePending ? 'Creating Invite...' : 'Create Invite'}
                      </button>
                      {latestInviteCode ? (
                        <p className="text-[11px] text-cyan-100">
                          Invite: <span className="font-mono">{latestInviteCode}</span>
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

            </div>
          </div>

          <main className="order-1 xl:order-2 masq-panel rounded-2xl p-3 xl:h-[calc(100vh-3rem)] xl:overflow-hidden">
            <div className="flex h-full flex-col gap-3">
              {!selectedServerId ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-ink-700 bg-ink-900/70 p-6 text-sm text-slate-400">
                  Select a server or create one to start chatting.
                </div>
              ) : detailsLoading ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-ink-700 bg-ink-900/70 p-6 text-sm text-slate-400">
                  Loading server...
                </div>
              ) : !serverDetails ? (
                <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {detailsError ?? 'Server unavailable'}
                </div>
              ) : !selectedChannel ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-ink-700 bg-ink-900/70 p-6 text-sm text-slate-400">
                  Select a channel from the server sidebar.
                </div>
              ) : (
                <>
                  <header className="rounded-lg border border-ink-700 bg-ink-900/75 px-2.5 py-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h2 className="text-base font-semibold text-white"># {selectedChannel.name}</h2>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                          {socketStatus} - {isChannelMaskMode ? 'Channel mask mode' : 'Server mask mode'}
                        </p>
                      </div>
                      {isChannelMaskMode ? (
                        <label className="block">
                          <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-slate-500">
                            Speaking As
                          </span>
                          <select
                            className="rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-white focus:border-neon-400"
                            value={currentChannelMaskId}
                            onChange={(event) => {
                              void onChangeChannelMask(event.target.value);
                            }}
                            disabled={channelMaskPending}
                          >
                            {me.masks.map((mask) => (
                              <option key={mask.id} value={mask.id}>
                                {mask.displayName}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                  </header>

                  {rtc.inAnotherCall && rtc.activeContext ? (
                    <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-100">
                      Active call is running in {rtc.activeContext.label}. Joining here will ask to switch.
                    </p>
                  ) : null}

                  <CallBar
                    connectionState={rtc.connectionState}
                    sessionId={rtc.sessionId}
                    canJoin={rtc.canJoin}
                    micEnabled={rtc.micEnabled}
                    cameraEnabled={rtc.cameraEnabled}
                    screenEnabled={rtc.screenEnabled}
                    deafened={rtc.deafened}
                    selfServerMuted={rtc.selfServerMuted}
                    speakingCount={rtc.speakingCount}
                    hasActiveScreenShare={Boolean(rtc.activeScreenShare)}
                    error={rtc.error}
                    disabledReason={canJoinRtc ? undefined : 'Select a channel mask before joining call.'}
                    canEndCall={rtc.canEndCall}
                    onJoin={() => {
                      void rtc.joinCall();
                    }}
                    onLeave={() => {
                      void rtc.leaveCall();
                    }}
                    onToggleMic={() => {
                      void rtc.toggleMic();
                    }}
                    onToggleCamera={() => {
                      void rtc.toggleCamera();
                    }}
                    onToggleScreenShare={() => {
                      void rtc.toggleScreenShare();
                    }}
                    onToggleDeafened={rtc.toggleDeafened}
                    onOpenDevices={() => {
                      rtc.openDevicePicker();
                    }}
                    onEndCall={() => {
                      void rtc.endCall();
                    }}
                  />

                  {showVideoStage ? (
                    <VideoStage
                      participants={rtc.participants}
                      activeScreenShare={rtc.activeScreenShare}
                      deafened={rtc.deafened}
                      canModerate={rtc.canModerate}
                      localMaskId={rtc.activeContext?.maskId ?? currentChannelMaskId}
                      onMuteParticipant={(targetMaskId) => {
                        void rtc.muteParticipant(targetMaskId);
                      }}
                    />
                  ) : null}

                  <div
                    ref={messageListRef}
                    className={`flex-1 overflow-y-auto rounded-xl border border-ink-700 bg-ink-900/70 p-2.5 ${
                      showVideoStage ? 'min-h-[220px]' : 'min-h-[300px] lg:min-h-[420px]'
                    }`}
                  >
                    <div className="space-y-2">
                      {channelMessages.length === 0 ? (
                        <p className="px-2 py-1 text-sm text-slate-500">No messages yet.</p>
                      ) : null}
                      {channelMessages.map((message) => (
                        <article key={message.id} className="rounded-lg border border-ink-700 bg-ink-800/70 p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm">
                              <MaskAvatar
                                displayName={message.mask.displayName}
                                color={message.mask.color}
                                avatarUploadId={message.mask.avatarUploadId}
                                sizeClassName="h-6 w-6"
                                textClassName="text-[9px]"
                              />
                              <span className="font-medium text-white">{message.mask.displayName}</span>
                              <span className="text-xs text-slate-500">{message.mask.avatarSeed}</span>
                            </div>
                            <span className="text-xs text-slate-500">{formatTimestamp(message.createdAt)}</span>
                          </div>
                          {message.body ? (
                            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-slate-200">{message.body}</p>
                          ) : null}
                          {message.image ? (
                            <a
                              className="mt-2 block max-w-md overflow-hidden rounded-lg border border-ink-700 bg-ink-900/70"
                              href={buildUploadUrl(message.image.id)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img
                                src={buildUploadUrl(message.image.id)}
                                alt={message.image.fileName}
                                className="max-h-80 w-full object-contain"
                                loading="lazy"
                              />
                            </a>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={onSendMessage} className="rounded-xl border border-ink-700 bg-ink-900/70 p-2.5">
                    <textarea
                      className="h-20 w-full resize-none rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-2 text-sm text-white focus:border-neon-400"
                      value={composerBody}
                      onChange={(event) => setComposerBody(event.target.value)}
                      placeholder="Speak as your selected mask"
                      maxLength={MAX_ROOM_MESSAGE_LENGTH}
                      disabled={socketStatus !== 'connected' || sendingMessage}
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <label className="cursor-pointer rounded-md border border-ink-700 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-300 hover:border-neon-400 hover:text-neon-100">
                        Attach Image
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                          disabled={socketStatus !== 'connected' || sendingMessage}
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            setComposerImageFile(file);
                            event.currentTarget.value = '';
                          }}
                        />
                      </label>
                      {composerImageFile ? (
                        <button
                          type="button"
                          onClick={() => setComposerImageFile(null)}
                          className="rounded-md border border-ink-700 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-300 hover:border-slate-500 hover:text-white"
                        >
                          Clear Image
                        </button>
                      ) : null}
                    </div>
                    {composerImageFile ? (
                      <p className="mt-1 text-xs text-slate-400">Attachment: {composerImageFile.name}</p>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-slate-500">
                        {composerBody.length}/{MAX_ROOM_MESSAGE_LENGTH}
                      </p>
                      <button
                        type="submit"
                        disabled={
                          socketStatus !== 'connected' ||
                          sendingMessage ||
                          (!composerBody.trim() && !composerImageFile)
                        }
                        className="rounded-md border border-neon-400/40 bg-neon-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-neon-200 hover:border-neon-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {sendingMessage ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {detailsError ? (
                <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-2.5 py-2 text-xs text-rose-200">
                  {detailsError}
                </div>
              ) : null}

              {socketError ? (
                <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-2.5 py-2 text-xs text-rose-200">
                  {socketError}
                </div>
              ) : null}

              {friendRequestNotice ? (
                <div className="rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-2 text-xs text-cyan-200">
                  {friendRequestNotice}
                </div>
              ) : null}
            </div>
          </main>

          <aside className={`${mobileContextOpen ? 'block' : 'hidden'} order-3 xl:order-3 xl:block masq-panel rounded-2xl p-3 xl:h-[calc(100vh-3rem)] xl:overflow-hidden`}>
            <div className="flex h-full flex-col gap-3">
              <button
                type="button"
                onClick={() => setMobileContextOpen(false)}
                className="rounded-md border border-ink-700 bg-ink-900/80 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-300 xl:hidden"
              >
                Close Context
              </button>
              {!selectedServerId || !serverDetails ? (
                <div className="rounded-xl border border-ink-700 bg-ink-900/70 p-3 text-sm text-slate-500">
                  Select a server to view members, roles, and call details.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-1 rounded-xl border border-ink-700 bg-ink-900/70 p-1">
                    <button
                      type="button"
                      onClick={() => setContextTab('members')}
                      className={`rounded-md px-2 py-1 text-[10px] uppercase tracking-[0.12em] transition ${
                        contextTab === 'members'
                          ? 'border border-neon-400/45 bg-neon-400/10 text-neon-100'
                          : 'border border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Members
                    </button>
                    <button
                      type="button"
                      onClick={() => setContextTab('roles')}
                      disabled={!canManageMembers}
                      className={`rounded-md px-2 py-1 text-[10px] uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        contextTab === 'roles'
                          ? 'border border-neon-400/45 bg-neon-400/10 text-neon-100'
                          : 'border border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Roles
                    </button>
                    <button
                      type="button"
                      onClick={() => setContextTab('call')}
                      className={`rounded-md px-2 py-1 text-[10px] uppercase tracking-[0.12em] transition ${
                        contextTab === 'call'
                          ? 'border border-neon-400/45 bg-neon-400/10 text-neon-100'
                          : 'border border-transparent text-slate-400 hover:text-slate-200'
                      } ${isConnectedRtc ? 'masq-live-ring' : ''}`}
                    >
                      Call
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {contextTab === 'members' ? (
                      <div className="space-y-2">
                        {serverDetails.members.map((member) => (
                          <article key={member.userId} className="rounded-lg border border-ink-700 bg-ink-900/75 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              {member.userId === me.user.id ? (
                                <div className="flex min-w-0 items-center gap-2">
                                  <MaskAvatar
                                    displayName={member.serverMask.displayName}
                                    color={member.serverMask.color}
                                    avatarUploadId={member.serverMask.avatarUploadId}
                                    sizeClassName="h-6 w-6"
                                    textClassName="text-[9px]"
                                  />
                                  <p className="truncate text-sm font-medium text-white">{member.serverMask.displayName}</p>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMemberActionMenuUserId((current) =>
                                      current === member.userId ? null : member.userId,
                                    )
                                  }
                                  className="flex min-w-0 items-center gap-2 rounded-md border border-transparent px-1 py-0.5 text-left hover:border-ink-600"
                                  title="Open member actions"
                                >
                                  <MaskAvatar
                                    displayName={member.serverMask.displayName}
                                    color={member.serverMask.color}
                                    avatarUploadId={member.serverMask.avatarUploadId}
                                    sizeClassName="h-6 w-6"
                                    textClassName="text-[9px]"
                                  />
                                  <p className="truncate text-sm font-medium text-white">{member.serverMask.displayName}</p>
                                </button>
                              )}
                              <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                                {member.role}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-[10px] uppercase tracking-[0.12em] text-slate-500">
                              {onlineUserIds.has(member.userId) ? 'online in channel' : 'offline'}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-400">
                              Roles:{' '}
                              {member.roleIds.length === 0
                                ? 'none'
                                : member.roleIds
                                    .map((roleId) => serverRoles.find((role) => role.id === roleId)?.name ?? 'unknown')
                                    .join(', ')}
                            </p>

                            {memberActionMenuUserId === member.userId && member.userId !== me.user.id ? (
                              <div className="mt-2 rounded-md border border-ink-700 bg-ink-800/80 p-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    void onSendFriendRequestByUserId(member.userId);
                                  }}
                                  disabled={friendRequestPendingUserId === member.userId}
                                  className="w-full rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-200 hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {friendRequestPendingUserId === member.userId ? 'Sending...' : 'Add Friend'}
                                </button>
                              </div>
                            ) : null}

                            {canManageMembers && member.role !== 'OWNER' ? (
                              <div className="mt-2 rounded-md border border-ink-700 bg-ink-800/80 p-2">
                                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Assign Roles</p>
                                <label className="mt-1 block text-[10px] uppercase tracking-[0.12em] text-slate-500">
                                  Membership Role
                                </label>
                                <select
                                  className="mt-1 w-full rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-white focus:border-neon-400"
                                  value={memberBaseRoles[member.userId] ?? member.role}
                                  onChange={(event) => {
                                    const nextRole = event.target.value as ServerMemberRole;
                                    if (nextRole === 'OWNER') {
                                      return;
                                    }
                                    setMemberBaseRoles((current) => ({
                                      ...current,
                                      [member.userId]: nextRole,
                                    }));
                                  }}
                                >
                                  <option value="MEMBER">MEMBER</option>
                                  <option value="ADMIN">ADMIN</option>
                                </select>
                                <div className="mt-1 space-y-1">
                                  {serverRoles.map((role) => {
                                    const selected = memberRoleSelections[member.userId] ?? member.roleIds;
                                    const checked = selected.includes(role.id);
                                    return (
                                      <label key={role.id} className="flex items-center gap-2 text-[11px] text-slate-300">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => {
                                            setMemberRoleSelections((current) => {
                                              const currentRoleIds = current[member.userId] ?? member.roleIds;
                                              const nextRoleIds = currentRoleIds.includes(role.id)
                                                ? currentRoleIds.filter((value) => value !== role.id)
                                                : [...currentRoleIds, role.id];
                                              return {
                                                ...current,
                                                [member.userId]: nextRoleIds,
                                              };
                                            });
                                          }}
                                        />
                                        <span>{role.name}</span>
                                      </label>
                                    );
                                  })}
                                  {serverRoles.length === 0 ? (
                                    <p className="text-[11px] text-slate-500">No custom roles yet.</p>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void onSaveMemberRoles(member.userId);
                                  }}
                                  disabled={saveMemberRolesPendingUserId === member.userId}
                                  className="mt-2 w-full rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-200 hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {saveMemberRolesPendingUserId === member.userId ? 'Saving...' : 'Save Roles'}
                                </button>
                              </div>
                            ) : null}

                            {canKickMember(member) ? (
                              <button
                                type="button"
                                onClick={() => {
                                  void onKickMember(member.userId);
                                }}
                                disabled={kickPendingUserId === member.userId}
                                className="mt-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-rose-200 hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Kick
                              </button>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    ) : null}

                    {contextTab === 'roles' ? (
                      <div className="space-y-2">
                        {rolesLoading ? <p className="text-xs text-slate-500">Loading roles...</p> : null}
                        {rolesError ? (
                          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
                            {rolesError}
                          </p>
                        ) : null}
                        {!canManageMembers ? (
                          <p className="text-xs text-slate-500">ManageMembers permission required.</p>
                        ) : (
                          <>
                            <form onSubmit={onCreateRole} className="space-y-2 rounded-lg border border-ink-700 bg-ink-900/75 p-2">
                              <input
                                className="w-full rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-white focus:border-neon-400"
                                value={createRoleName}
                                onChange={(event) => setCreateRoleName(event.target.value)}
                                placeholder="Role name"
                                maxLength={40}
                                required
                              />
                              <div className="grid grid-cols-2 gap-1">
                                {ALL_SERVER_PERMISSIONS.map((permission) => (
                                  <label key={permission} className="flex items-center gap-1 text-[11px] text-slate-300">
                                    <input
                                      type="checkbox"
                                      checked={createRolePermissions.includes(permission)}
                                      onChange={() =>
                                        setCreateRolePermissions((current) => togglePermission(current, permission))
                                      }
                                    />
                                    <span>{permission}</span>
                                  </label>
                                ))}
                              </div>
                              <button
                                type="submit"
                                disabled={createRolePending}
                                className="w-full rounded-md border border-neon-400/40 bg-neon-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-neon-200 hover:border-neon-400 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {createRolePending ? 'Creating...' : 'Create Role'}
                              </button>
                            </form>

                            {serverRoles.map((role) => {
                              const draft = roleDrafts[role.id] ?? {
                                name: role.name,
                                permissions: [...role.permissions],
                              };

                              return (
                                <article key={role.id} className="rounded-lg border border-ink-700 bg-ink-900/75 p-2">
                                  <input
                                    className="w-full rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-white focus:border-neon-400"
                                    value={draft.name}
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      setRoleDrafts((current) => ({
                                        ...current,
                                        [role.id]: {
                                          name: value,
                                          permissions: current[role.id]?.permissions ?? [...role.permissions],
                                        },
                                      }));
                                    }}
                                    maxLength={40}
                                  />
                                  <div className="mt-2 grid grid-cols-2 gap-1">
                                    {ALL_SERVER_PERMISSIONS.map((permission) => (
                                      <label key={permission} className="flex items-center gap-1 text-[11px] text-slate-300">
                                        <input
                                          type="checkbox"
                                          checked={draft.permissions.includes(permission)}
                                          onChange={() => {
                                            setRoleDrafts((current) => ({
                                              ...current,
                                              [role.id]: {
                                                name: current[role.id]?.name ?? role.name,
                                                permissions: togglePermission(
                                                  current[role.id]?.permissions ?? role.permissions,
                                                  permission,
                                                ),
                                              },
                                            }));
                                          }}
                                        />
                                        <span>{permission}</span>
                                      </label>
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void onSaveRole(role.id);
                                    }}
                                    disabled={savingRoleId === role.id}
                                    className="mt-2 w-full rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-200 hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {savingRoleId === role.id ? 'Saving...' : 'Save'}
                                  </button>
                                </article>
                              );
                            })}
                          </>
                        )}
                      </div>
                    ) : null}

                    {contextTab === 'call' ? (
                      selectedChannel ? (
                        <CallPanel
                          connectionState={rtc.connectionState}
                          sessionId={rtc.sessionId}
                          roomName={rtc.livekitRoomName}
                          participants={rtc.participants}
                          canJoin={rtc.canJoin}
                          canModerate={rtc.canModerate}
                          onJoin={() => {
                            void rtc.joinCall();
                          }}
                          onLeave={() => {
                            void rtc.leaveCall();
                          }}
                          onMuteParticipant={(targetMaskId) => {
                            void rtc.muteParticipant(targetMaskId);
                          }}
                        />
                      ) : (
                        <div className="rounded-xl border border-ink-700 bg-ink-900/70 p-3 text-xs text-slate-500">
                          Select a channel to open call controls.
                        </div>
                      )
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>

      {serverDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="masq-surface w-full max-w-xl rounded-2xl border border-ink-700 bg-ink-900 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-white">Server Access</h2>
              <button
                type="button"
                onClick={() => setServerDialogOpen(false)}
                className="rounded-md border border-ink-700 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-300 hover:border-slate-500 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-ink-700 bg-ink-800/70 p-1">
              <button
                type="button"
                onClick={() => setServerDialogTab('create')}
                className={`rounded-md px-2 py-1 text-xs uppercase tracking-[0.12em] ${
                  serverDialogTab === 'create'
                    ? 'border border-neon-400/45 bg-neon-400/10 text-neon-100'
                    : 'border border-transparent text-slate-400'
                }`}
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setServerDialogTab('join')}
                className={`rounded-md px-2 py-1 text-xs uppercase tracking-[0.12em] ${
                  serverDialogTab === 'join'
                    ? 'border border-neon-400/45 bg-neon-400/10 text-neon-100'
                    : 'border border-transparent text-slate-400'
                }`}
              >
                Join
              </button>
            </div>

            {serverDialogTab === 'create' ? (
              <form onSubmit={onCreateServer} className="mt-3 space-y-2 rounded-lg border border-ink-700 bg-ink-800/70 p-3">
                <label className="block text-xs text-slate-400">
                  <span className="mb-1 block uppercase tracking-[0.12em] text-slate-500">Server Name</span>
                  <input
                    className="w-full rounded-md border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-white focus:border-neon-400"
                    value={createServerName}
                    onChange={(event) => setCreateServerName(event.target.value)}
                    maxLength={80}
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={createServerPending || me.masks.length === 0}
                  className="w-full rounded-md border border-neon-400/40 bg-neon-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-neon-200 hover:border-neon-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createServerPending ? 'Creating...' : 'Create Server'}
                </button>
                {me.masks.length === 0 ? (
                  <p className="text-xs text-amber-200">Create a mask first before creating a server.</p>
                ) : null}
              </form>
            ) : (
              <form onSubmit={onJoinServer} className="mt-3 space-y-2 rounded-lg border border-ink-700 bg-ink-800/70 p-3">
                <label className="block text-xs text-slate-400">
                  <span className="mb-1 block uppercase tracking-[0.12em] text-slate-500">Invite Code</span>
                  <input
                    className="w-full rounded-md border border-ink-700 bg-ink-900 px-2 py-1.5 font-mono text-sm text-white focus:border-neon-400"
                    value={inviteCodeInput}
                    onChange={(event) => setInviteCodeInput(event.target.value)}
                    placeholder="INVITECODE"
                    required
                  />
                </label>
                <label className="block text-xs text-slate-400">
                  <span className="mb-1 block uppercase tracking-[0.12em] text-slate-500">Server Mask</span>
                  <select
                    className="w-full rounded-md border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-white focus:border-neon-400"
                    value={inviteMaskId}
                    onChange={(event) => setInviteMaskId(event.target.value)}
                  >
                    {me.masks.map((mask) => (
                      <option key={mask.id} value={mask.id}>
                        {mask.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={joinPending || !inviteMaskId}
                  className="w-full rounded-md border border-neon-400/40 bg-neon-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-neon-200 hover:border-neon-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {joinPending ? 'Joining...' : 'Join Server'}
                </button>
              </form>
            )}

            {serversError ? (
              <p className="mt-3 rounded-md border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
                {serversError}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

    </>
  );
}
