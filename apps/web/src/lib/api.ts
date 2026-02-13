import {
  AuthResponseSchema,
  CreateNarrativeRoomRequestSchema,
  CreateNarrativeRoomResponseSchema,
  CreateServerRequestSchema,
  CreateServerResponseSchema,
  CreateFriendRequestRequestSchema,
  CreateFriendRequestResponseSchema,
  CreateMaskRequestSchema,
  CreateMaskResponseSchema,
  DevGrantEntitlementRequestSchema,
  DevGrantEntitlementResponseSchema,
  SetMaskAvatarResponseSchema,
  CreateServerChannelRequestSchema,
  CreateServerChannelResponseSchema,
  CreateServerInviteRequestSchema,
  CreateServerInviteResponseSchema,
  CreateServerRoleRequestSchema,
  CreateRoomRequestSchema,
  CreateRoomResponseSchema,
  UpdateServerSettingsRequestSchema,
  UpdateServerSettingsResponseSchema,
  DeleteServerChannelResponseSchema,
  DeleteMaskResponseSchema,
  DmStartResponseSchema,
  GetServerResponseSchema,
  GetMaskAuraResponseSchema,
  GetNarrativeRoomResponseSchema,
  DmThreadResponseSchema,
  DmThreadsResponseSchema,
  ExileRoomMemberRequestSchema,
  FriendActionResponseSchema,
  FriendRequestsResponseSchema,
  FriendsListResponseSchema,
  JoinServerRequestSchema,
  JoinServerResponseSchema,
  JoinNarrativeRoomRequestSchema,
  JoinNarrativeRoomResponseSchema,
  JoinRoomRequestSchema,
  JoinRoomResponseSchema,
  LeaveNarrativeRoomRequestSchema,
  LeaveNarrativeRoomResponseSchema,
  SetNarrativeReadyRequestSchema,
  SetNarrativeReadyResponseSchema,
  ListNarrativeTemplatesResponseSchema,
  ListRoomsResponseSchema,
  ListServerRolesResponseSchema,
  ListServersResponseSchema,
  LockRoomRequestSchema,
  LoginRequestSchema,
  LogoutResponseSchema,
  MeResponseSchema,
  ModerateRoomResponseSchema,
  MuteRoomMemberRequestSchema,
  NarrativeActionResponseSchema,
  RegisterRequestSchema,
  UpdateRtcSettingsRequestSchema,
  UpdateRtcSettingsResponseSchema,
  UpdateServerRtcPolicyRequestSchema,
  UpdateServerRtcPolicyResponseSchema,
  SetServerMaskRequestSchema,
  SetServerMaskResponseSchema,
  SetChannelMaskRequestSchema,
  SetChannelMaskResponseSchema,
  SetServerMemberRolesRequestSchema,
  SetServerMemberRolesResponseSchema,
  SetDmMaskRequestSchema,
  SetDmMaskResponseSchema,
  UploadImageRequestSchema,
  UploadImageResponseSchema,
  CreateRtcSessionRequestSchema,
  CreateRtcSessionResponseSchema,
  LeaveRtcSessionResponseSchema,
  MuteRtcParticipantRequestSchema,
  MuteRtcParticipantResponseSchema,
  EndRtcSessionRequestSchema,
  EndRtcSessionResponseSchema,
  SendNarrativeMessageRequestSchema,
  SendNarrativeMessageResponseSchema,
  ServerRoleResponseSchema,
  StartDmRequestSchema,
  UpdateServerRoleRequestSchema,
  KickServerMemberResponseSchema,
  type AuthResponse,
  type CreateNarrativeRoomRequest,
  type CreateNarrativeRoomResponse,
  type CreateServerRequest,
  type CreateServerResponse,
  type CreateFriendRequestRequest,
  type CreateFriendRequestResponse,
  type CreateMaskRequest,
  type CreateMaskResponse,
  type DevGrantEntitlementRequest,
  type DevGrantEntitlementResponse,
  type SetMaskAvatarResponse,
  type CreateServerChannelRequest,
  type CreateServerChannelResponse,
  type CreateServerInviteRequest,
  type CreateServerInviteResponse,
  type CreateServerRoleRequest,
  type UpdateServerSettingsRequest,
  type UpdateServerSettingsResponse,
  type CreateRoomRequest,
  type CreateRoomResponse,
  type DeleteServerChannelResponse,
  type DeleteMaskResponse,
  type DmStartResponse,
  type GetServerResponse,
  type GetMaskAuraResponse,
  type GetNarrativeRoomResponse,
  type DmThreadResponse,
  type DmThreadsResponse,
  type ExileRoomMemberRequest,
  type FriendActionResponse,
  type FriendRequestsResponse,
  type FriendsListResponse,
  type JoinServerRequest,
  type JoinServerResponse,
  type JoinNarrativeRoomRequest,
  type JoinNarrativeRoomResponse,
  type JoinRoomRequest,
  type JoinRoomResponse,
  type LeaveNarrativeRoomRequest,
  type LeaveNarrativeRoomResponse,
  type SetNarrativeReadyRequest,
  type SetNarrativeReadyResponse,
  type ListNarrativeTemplatesResponse,
  type ListRoomsResponse,
  type ListServerRolesResponse,
  type ListServersResponse,
  type LockRoomRequest,
  type LoginRequest,
  type LogoutResponse,
  type MeResponse,
  type ModerateRoomResponse,
  type MuteRoomMemberRequest,
  type NarrativeActionResponse,
  type RegisterRequest,
  type UpdateRtcSettingsRequest,
  type UpdateRtcSettingsResponse,
  type UpdateServerRtcPolicyRequest,
  type UpdateServerRtcPolicyResponse,
  type SetServerMaskRequest,
  type SetServerMaskResponse,
  type SetChannelMaskRequest,
  type SetChannelMaskResponse,
  type SetServerMemberRolesRequest,
  type SetServerMemberRolesResponse,
  type SetDmMaskRequest,
  type SetDmMaskResponse,
  type UploadImageRequest,
  type UploadImageResponse,
  type CreateRtcSessionRequest,
  type CreateRtcSessionResponse,
  type LeaveRtcSessionResponse,
  type MuteRtcParticipantRequest,
  type MuteRtcParticipantResponse,
  type EndRtcSessionRequest,
  type EndRtcSessionResponse,
  type SendNarrativeMessageRequest,
  type SendNarrativeMessageResponse,
  type ServerRoleResponse,
  type StartDmRequest,
  type UpdateServerRoleRequest,
  type KickServerMemberResponse,
} from '@masq/shared';
import { z } from 'zod';

const apiBase = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const request = async <TInput, TOutput>(
  path: string,
  options: {
    method: 'GET' | 'POST' | 'DELETE' | 'PATCH';
    body?: TInput;
  },
  schema: z.ZodType<TOutput, z.ZodTypeDef, unknown>,
): Promise<TOutput> => {
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as Record<string, unknown>).message)
        : `Request failed (${response.status})`;

    throw new ApiError(message, response.status, payload);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError('Unexpected response payload', response.status, parsed.error.flatten());
  }

  return parsed.data;
};

const requestFormData = async <TOutput>(
  path: string,
  formData: FormData,
  schema: z.ZodType<TOutput, z.ZodTypeDef, unknown>,
): Promise<TOutput> => {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as Record<string, unknown>).message)
        : `Request failed (${response.status})`;

    throw new ApiError(message, response.status, payload);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError('Unexpected response payload', response.status, parsed.error.flatten());
  }

  return parsed.data;
};

export const register = async (input: RegisterRequest): Promise<AuthResponse> => {
  const payload = RegisterRequestSchema.parse(input);
  return request('/auth/register', { method: 'POST', body: payload }, AuthResponseSchema);
};

export const login = async (input: LoginRequest): Promise<AuthResponse> => {
  const payload = LoginRequestSchema.parse(input);
  return request('/auth/login', { method: 'POST', body: payload }, AuthResponseSchema);
};

export const logout = async (): Promise<LogoutResponse> => {
  return request('/auth/logout', { method: 'POST' }, LogoutResponseSchema);
};

export const getMe = async (): Promise<MeResponse> => {
  return request('/me', { method: 'GET' }, MeResponseSchema);
};

export const createServer = async (input: CreateServerRequest): Promise<CreateServerResponse> => {
  const payload = CreateServerRequestSchema.parse(input);
  return request('/servers', { method: 'POST', body: payload }, CreateServerResponseSchema);
};

export const listServers = async (): Promise<ListServersResponse> => {
  return request('/servers', { method: 'GET' }, ListServersResponseSchema);
};

export const getServer = async (serverId: string): Promise<GetServerResponse> => {
  return request(`/servers/${serverId}`, { method: 'GET' }, GetServerResponseSchema);
};

export const createServerChannel = async (
  serverId: string,
  input: CreateServerChannelRequest,
): Promise<CreateServerChannelResponse> => {
  const payload = CreateServerChannelRequestSchema.parse(input);
  return request(`/servers/${serverId}/channels`, { method: 'POST', body: payload }, CreateServerChannelResponseSchema);
};

export const deleteServerChannel = async (
  serverId: string,
  channelId: string,
): Promise<DeleteServerChannelResponse> => {
  return request(
    `/servers/${serverId}/channels/${channelId}`,
    { method: 'DELETE' },
    DeleteServerChannelResponseSchema,
  );
};

export const createServerInvite = async (
  serverId: string,
  input: CreateServerInviteRequest,
): Promise<CreateServerInviteResponse> => {
  const payload = CreateServerInviteRequestSchema.parse(input);
  return request(`/servers/${serverId}/invites`, { method: 'POST', body: payload }, CreateServerInviteResponseSchema);
};

export const joinServer = async (input: JoinServerRequest): Promise<JoinServerResponse> => {
  const payload = JoinServerRequestSchema.parse(input);
  return request('/servers/join', { method: 'POST', body: payload }, JoinServerResponseSchema);
};

export const setServerMask = async (
  serverId: string,
  input: SetServerMaskRequest,
): Promise<SetServerMaskResponse> => {
  const payload = SetServerMaskRequestSchema.parse(input);
  return request(`/servers/${serverId}/mask`, { method: 'POST', body: payload }, SetServerMaskResponseSchema);
};

export const updateServerSettings = async (
  serverId: string,
  input: UpdateServerSettingsRequest,
): Promise<UpdateServerSettingsResponse> => {
  const payload = UpdateServerSettingsRequestSchema.parse(input);
  return request(
    `/servers/${serverId}/settings`,
    { method: 'PATCH', body: payload },
    UpdateServerSettingsResponseSchema,
  );
};

export const setChannelMask = async (
  channelId: string,
  input: SetChannelMaskRequest,
): Promise<SetChannelMaskResponse> => {
  const payload = SetChannelMaskRequestSchema.parse(input);
  return request(`/channels/${channelId}/mask`, { method: 'POST', body: payload }, SetChannelMaskResponseSchema);
};

export const listServerRoles = async (serverId: string): Promise<ListServerRolesResponse> => {
  return request(`/servers/${serverId}/roles`, { method: 'GET' }, ListServerRolesResponseSchema);
};

export const createServerRole = async (
  serverId: string,
  input: CreateServerRoleRequest,
): Promise<ServerRoleResponse> => {
  const payload = CreateServerRoleRequestSchema.parse(input);
  return request(`/servers/${serverId}/roles`, { method: 'POST', body: payload }, ServerRoleResponseSchema);
};

export const updateServerRole = async (
  serverId: string,
  roleId: string,
  input: UpdateServerRoleRequest,
): Promise<ServerRoleResponse> => {
  const payload = UpdateServerRoleRequestSchema.parse(input);
  return request(
    `/servers/${serverId}/roles/${roleId}`,
    { method: 'PATCH', body: payload },
    ServerRoleResponseSchema,
  );
};

export const setServerMemberRoles = async (
  serverId: string,
  userId: string,
  input: SetServerMemberRolesRequest,
): Promise<SetServerMemberRolesResponse> => {
  const payload = SetServerMemberRolesRequestSchema.parse(input);
  return request(
    `/servers/${serverId}/members/${userId}/roles`,
    { method: 'POST', body: payload },
    SetServerMemberRolesResponseSchema,
  );
};

export const kickServerMember = async (
  serverId: string,
  userId: string,
): Promise<KickServerMemberResponse> => {
  return request(`/servers/${serverId}/members/${userId}`, { method: 'DELETE' }, KickServerMemberResponseSchema);
};

export const createMask = async (input: CreateMaskRequest): Promise<CreateMaskResponse> => {
  const payload = CreateMaskRequestSchema.parse(input);
  return request('/masks', { method: 'POST', body: payload }, CreateMaskResponseSchema);
};

export const deleteMask = async (maskId: string): Promise<DeleteMaskResponse> => {
  return request(`/masks/${maskId}`, { method: 'DELETE' }, DeleteMaskResponseSchema);
};

export const uploadImage = async (
  input: UploadImageRequest,
  file: File,
): Promise<UploadImageResponse> => {
  const payload = UploadImageRequestSchema.parse(input);
  const formData = new FormData();
  formData.append('contextType', payload.contextType);
  formData.append('contextId', payload.contextId);
  formData.append('file', file);
  return requestFormData('/uploads/image', formData, UploadImageResponseSchema);
};

export const setMaskAvatar = async (
  maskId: string,
  file: File,
): Promise<SetMaskAvatarResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  return requestFormData(`/masks/${maskId}/avatar`, formData, SetMaskAvatarResponseSchema);
};

export const buildUploadUrl = (uploadId: string): string => {
  if (!apiBase) {
    return `/uploads/${encodeURIComponent(uploadId)}`;
  }

  return `${apiBase}/uploads/${encodeURIComponent(uploadId)}`;
};

export const listRooms = async (maskId: string): Promise<ListRoomsResponse> => {
  return request(`/rooms?maskId=${encodeURIComponent(maskId)}`, { method: 'GET' }, ListRoomsResponseSchema);
};

export const createRoom = async (input: CreateRoomRequest): Promise<CreateRoomResponse> => {
  const payload = CreateRoomRequestSchema.parse(input);
  return request('/rooms', { method: 'POST', body: payload }, CreateRoomResponseSchema);
};

export const joinRoom = async (roomId: string, input: JoinRoomRequest): Promise<JoinRoomResponse> => {
  const payload = JoinRoomRequestSchema.parse(input);
  return request(`/rooms/${roomId}/join`, { method: 'POST', body: payload }, JoinRoomResponseSchema);
};

export const muteRoomMember = async (
  roomId: string,
  input: MuteRoomMemberRequest,
): Promise<ModerateRoomResponse> => {
  const payload = MuteRoomMemberRequestSchema.parse(input);
  return request(`/rooms/${roomId}/mute`, { method: 'POST', body: payload }, ModerateRoomResponseSchema);
};

export const exileRoomMember = async (
  roomId: string,
  input: ExileRoomMemberRequest,
): Promise<ModerateRoomResponse> => {
  const payload = ExileRoomMemberRequestSchema.parse(input);
  return request(`/rooms/${roomId}/exile`, { method: 'POST', body: payload }, ModerateRoomResponseSchema);
};

export const setRoomLocked = async (
  roomId: string,
  input: LockRoomRequest,
): Promise<ModerateRoomResponse> => {
  const payload = LockRoomRequestSchema.parse(input);
  return request(`/rooms/${roomId}/lock`, { method: 'POST', body: payload }, ModerateRoomResponseSchema);
};

export const sendFriendRequest = async (
  input: CreateFriendRequestRequest,
): Promise<CreateFriendRequestResponse> => {
  const payload = CreateFriendRequestRequestSchema.parse(input);
  return request('/friends/request', { method: 'POST', body: payload }, CreateFriendRequestResponseSchema);
};

export const acceptFriendRequest = async (requestId: string): Promise<FriendActionResponse> => {
  return request(`/friends/request/${requestId}/accept`, { method: 'POST' }, FriendActionResponseSchema);
};

export const declineFriendRequest = async (requestId: string): Promise<FriendActionResponse> => {
  return request(`/friends/request/${requestId}/decline`, { method: 'POST' }, FriendActionResponseSchema);
};

export const cancelFriendRequest = async (requestId: string): Promise<FriendActionResponse> => {
  return request(`/friends/request/${requestId}/cancel`, { method: 'POST' }, FriendActionResponseSchema);
};

export const unfriend = async (friendUserId: string): Promise<FriendActionResponse> => {
  return request(`/friends/${friendUserId}`, { method: 'DELETE' }, FriendActionResponseSchema);
};

export const listFriends = async (): Promise<FriendsListResponse> => {
  return request('/friends', { method: 'GET' }, FriendsListResponseSchema);
};

export const listFriendRequests = async (): Promise<FriendRequestsResponse> => {
  return request('/friends/requests', { method: 'GET' }, FriendRequestsResponseSchema);
};

export const startDm = async (input: StartDmRequest): Promise<DmStartResponse> => {
  const payload = StartDmRequestSchema.parse(input);
  return request('/dm/start', { method: 'POST', body: payload }, DmStartResponseSchema);
};

export const listDmThreads = async (): Promise<DmThreadsResponse> => {
  return request('/dm/threads', { method: 'GET' }, DmThreadsResponseSchema);
};

export const getDmThread = async (threadId: string): Promise<DmThreadResponse> => {
  return request(`/dm/${threadId}`, { method: 'GET' }, DmThreadResponseSchema);
};

export const setDmMask = async (threadId: string, input: SetDmMaskRequest): Promise<SetDmMaskResponse> => {
  const payload = SetDmMaskRequestSchema.parse(input);
  return request(`/dm/${threadId}/mask`, { method: 'POST', body: payload }, SetDmMaskResponseSchema);
};

export const createRtcSession = async (
  input: CreateRtcSessionRequest,
): Promise<CreateRtcSessionResponse> => {
  const payload = CreateRtcSessionRequestSchema.parse(input);
  return request('/rtc/session', { method: 'POST', body: payload }, CreateRtcSessionResponseSchema);
};

export const leaveRtcSession = async (sessionId: string): Promise<LeaveRtcSessionResponse> => {
  return request(`/rtc/session/${sessionId}/leave`, { method: 'POST' }, LeaveRtcSessionResponseSchema);
};

export const muteRtcParticipant = async (
  sessionId: string,
  input: MuteRtcParticipantRequest,
): Promise<MuteRtcParticipantResponse> => {
  const payload = MuteRtcParticipantRequestSchema.parse(input);
  return request(`/rtc/session/${sessionId}/mute`, { method: 'POST', body: payload }, MuteRtcParticipantResponseSchema);
};

export const endRtcSession = async (
  sessionId: string,
  input: EndRtcSessionRequest,
): Promise<EndRtcSessionResponse> => {
  const payload = EndRtcSessionRequestSchema.parse(input);
  return request(`/rtc/session/${sessionId}/end`, { method: 'POST', body: payload }, EndRtcSessionResponseSchema);
};

export const getMaskAura = async (maskId: string): Promise<GetMaskAuraResponse> => {
  return request(`/masks/${maskId}/aura`, { method: 'GET' }, GetMaskAuraResponseSchema);
};

export const listNarrativeTemplates = async (): Promise<ListNarrativeTemplatesResponse> => {
  return request('/narrative/templates', { method: 'GET' }, ListNarrativeTemplatesResponseSchema);
};

export const createNarrativeRoom = async (
  input: CreateNarrativeRoomRequest,
): Promise<CreateNarrativeRoomResponse> => {
  const payload = CreateNarrativeRoomRequestSchema.parse(input);
  return request('/narrative/rooms', { method: 'POST', body: payload }, CreateNarrativeRoomResponseSchema);
};

export const joinNarrativeRoom = async (
  input: JoinNarrativeRoomRequest,
): Promise<JoinNarrativeRoomResponse> => {
  const payload = JoinNarrativeRoomRequestSchema.parse(input);
  return request('/narrative/rooms/join', { method: 'POST', body: payload }, JoinNarrativeRoomResponseSchema);
};

export const leaveNarrativeRoom = async (
  roomId: string,
  input: LeaveNarrativeRoomRequest,
): Promise<LeaveNarrativeRoomResponse> => {
  const payload = LeaveNarrativeRoomRequestSchema.parse(input);
  return request(`/narrative/rooms/${roomId}/leave`, { method: 'POST', body: payload }, LeaveNarrativeRoomResponseSchema);
};

export const setNarrativeReady = async (
  roomId: string,
  input: SetNarrativeReadyRequest,
): Promise<SetNarrativeReadyResponse> => {
  const payload = SetNarrativeReadyRequestSchema.parse(input);
  return request(
    `/narrative/rooms/${roomId}/ready`,
    { method: 'POST', body: payload },
    SetNarrativeReadyResponseSchema,
  );
};

export const startNarrativeRoom = async (
  roomId: string,
  actorMaskId: string,
): Promise<NarrativeActionResponse> => {
  return request(
    `/narrative/rooms/${roomId}/start`,
    {
      method: 'POST',
      body: {
        actorMaskId,
      },
    },
    NarrativeActionResponseSchema,
  );
};

export const advanceNarrativeRoom = async (
  roomId: string,
  actorMaskId: string,
): Promise<NarrativeActionResponse> => {
  return request(
    `/narrative/rooms/${roomId}/advance`,
    {
      method: 'POST',
      body: {
        actorMaskId,
      },
    },
    NarrativeActionResponseSchema,
  );
};

export const getNarrativeRoom = async (roomId: string): Promise<GetNarrativeRoomResponse> => {
  return request(`/narrative/rooms/${roomId}`, { method: 'GET' }, GetNarrativeRoomResponseSchema);
};

export const sendNarrativeMessage = async (
  roomId: string,
  input: SendNarrativeMessageRequest,
): Promise<SendNarrativeMessageResponse> => {
  const payload = SendNarrativeMessageRequestSchema.parse(input);
  return request(
    `/narrative/rooms/${roomId}/message`,
    { method: 'POST', body: payload },
    SendNarrativeMessageResponseSchema,
  );
};

export const grantDevEntitlement = async (
  input: DevGrantEntitlementRequest,
): Promise<DevGrantEntitlementResponse> => {
  const payload = DevGrantEntitlementRequestSchema.parse(input);
  return request('/dev/entitlements/grant', { method: 'POST', body: payload }, DevGrantEntitlementResponseSchema);
};

export const updateRtcSettings = async (
  input: UpdateRtcSettingsRequest,
): Promise<UpdateRtcSettingsResponse> => {
  const payload = UpdateRtcSettingsRequestSchema.parse(input);
  return request('/settings/rtc', { method: 'PATCH', body: payload }, UpdateRtcSettingsResponseSchema);
};

export const updateServerRtcPolicy = async (
  serverId: string,
  input: UpdateServerRtcPolicyRequest,
): Promise<UpdateServerRtcPolicyResponse> => {
  const payload = UpdateServerRtcPolicyRequestSchema.parse(input);
  return request(
    `/servers/${serverId}/rtc-policy`,
    { method: 'PATCH', body: payload },
    UpdateServerRtcPolicyResponseSchema,
  );
};

