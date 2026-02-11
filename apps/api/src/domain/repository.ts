import type {
  ChannelIdentityMode,
  ChannelType,
  FriendRequestStatus,
  MembershipRole,
  RtcContextType,
  RoomKind,
  UploadContextType,
  UploadKind,
  ServerPermission,
  ServerMemberRole,
} from '@masq/shared';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  defaultMaskId: string | null;
  createdAt: Date;
}

export interface MaskRecord {
  id: string;
  userId: string;
  displayName: string;
  color: string;
  avatarSeed: string;
  avatarUploadId: string | null;
  createdAt: Date;
}

export interface RoomRecord {
  id: string;
  title: string;
  kind: RoomKind;
  locked: boolean;
  fogLevel: number;
  messageDecayMinutes: number;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface RoomMembershipRecord {
  roomId: string;
  maskId: string;
  role: MembershipRole;
  joinedAt: Date;
  mask: MaskRecord;
}

export interface RoomListItemRecord {
  room: RoomRecord;
  role: MembershipRole;
  joinedAt: Date;
}

export interface MessageRecord {
  id: string;
  roomId: string;
  maskId: string;
  body: string;
  imageUpload: UploadRecord | null;
  createdAt: Date;
  mask: MaskRecord;
}

export interface RoomModerationRecord {
  id: string;
  roomId: string;
  targetMaskId: string;
  actionType: 'MUTE' | 'EXILE';
  expiresAt: Date | null;
  createdAt: Date;
  actorMaskId: string;
}

export interface FriendDefaultMaskRecord {
  id: string;
  displayName: string;
  color: string;
  avatarSeed: string;
  avatarUploadId: string | null;
}

export interface FriendUserRecord {
  id: string;
  email: string;
  defaultMask: FriendDefaultMaskRecord | null;
}

export interface FriendRequestRecord {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: FriendRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IncomingFriendRequestRecord {
  request: FriendRequestRecord;
  fromUser: FriendUserRecord;
}

export interface OutgoingFriendRequestRecord {
  request: FriendRequestRecord;
  toUser: FriendUserRecord;
}

export interface ServerRecord {
  id: string;
  name: string;
  ownerUserId: string;
  channelIdentityMode: ChannelIdentityMode;
  createdAt: Date;
}

export interface ServerInviteRecord {
  id: string;
  serverId: string;
  code: string;
  createdAt: Date;
  expiresAt: Date | null;
  maxUses: number | null;
  uses: number;
}

export interface ServerRoleRecord {
  id: string;
  serverId: string;
  name: string;
  permissions: ServerPermission[];
  createdAt: Date;
}

export interface ServerMemberRecord {
  serverId: string;
  userId: string;
  role: ServerMemberRole;
  roleIds: string[];
  permissions: ServerPermission[];
  joinedAt: Date;
  serverMaskId: string;
  serverMask: MaskRecord;
}

export interface ServerListItemRecord {
  server: ServerRecord;
  role: ServerMemberRole;
  joinedAt: Date;
  serverMask: MaskRecord;
}

export interface ChannelRecord {
  id: string;
  serverId: string;
  name: string;
  type: ChannelType;
  createdAt: Date;
}

export interface ChannelMemberIdentityRecord {
  channelId: string;
  userId: string;
  maskId: string;
  mask: MaskRecord;
}

export interface ServerMessageRecord {
  id: string;
  channelId: string;
  maskId: string;
  body: string;
  imageUpload: UploadRecord | null;
  createdAt: Date;
  mask: MaskRecord;
}

export interface DmThreadRecord {
  id: string;
  userAId: string;
  userBId: string;
  createdAt: Date;
}

export interface DmParticipantRecord {
  threadId: string;
  userId: string;
  activeMaskId: string;
  activeMask: MaskRecord;
}

export interface DmMessageRecord {
  id: string;
  threadId: string;
  maskId: string;
  body: string;
  imageUpload: UploadRecord | null;
  createdAt: Date;
  mask: MaskRecord;
}

export interface UploadRecord {
  id: string;
  ownerUserId: string;
  kind: UploadKind;
  contextType: UploadContextType | null;
  contextId: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: Date;
}

export interface VoiceSessionRecord {
  id: string;
  contextType: RtcContextType;
  contextId: string;
  livekitRoomName: string;
  createdAt: Date;
  endedAt: Date | null;
}

export interface VoiceParticipantRecord {
  id: string;
  voiceSessionId: string;
  userId: string;
  maskId: string;
  joinedAt: Date;
  leftAt: Date | null;
  isServerMuted: boolean;
  mask: MaskRecord;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
}

export interface CreateMaskInput {
  userId: string;
  displayName: string;
  color: string;
  avatarSeed: string;
  avatarUploadId?: string | null;
}

export interface CreateRoomInput {
  title: string;
  kind: RoomKind;
  locked: boolean;
  fogLevel: number;
  messageDecayMinutes: number;
  expiresAt: Date | null;
}

export interface CreateServerInput {
  name: string;
  ownerUserId: string;
}

export interface AddRoomMembershipInput {
  roomId: string;
  maskId: string;
  role: MembershipRole;
}

export interface AddServerMemberInput {
  serverId: string;
  userId: string;
  role: ServerMemberRole;
  serverMaskId: string;
}

export interface CreateMessageInput {
  roomId: string;
  maskId: string;
  body: string;
  imageUploadId?: string | null;
}

export interface CreateServerInviteInput {
  serverId: string;
  code: string;
  expiresAt: Date | null;
  maxUses: number | null;
}

export interface CreateServerRoleInput {
  serverId: string;
  name: string;
  permissions: ServerPermission[];
}

export interface CreateChannelInput {
  serverId: string;
  name: string;
  type: ChannelType;
}

export interface CreateRoomModerationInput {
  roomId: string;
  targetMaskId: string;
  actionType: 'MUTE' | 'EXILE';
  expiresAt: Date | null;
  actorMaskId: string;
}

export interface UpsertDmParticipantInput {
  threadId: string;
  userId: string;
  activeMaskId: string;
}

export interface UpsertFriendRequestInput {
  fromUserId: string;
  toUserId: string;
  status: FriendRequestStatus;
}

export interface CreateDmMessageInput {
  threadId: string;
  maskId: string;
  body: string;
  imageUploadId?: string | null;
}

export interface CreateServerMessageInput {
  channelId: string;
  maskId: string;
  body: string;
  imageUploadId?: string | null;
}

export interface CreateUploadInput {
  ownerUserId: string;
  kind: UploadKind;
  contextType: UploadContextType | null;
  contextId: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
}

export interface CreateVoiceSessionInput {
  contextType: RtcContextType;
  contextId: string;
  livekitRoomName: string;
}

export interface CreateVoiceParticipantInput {
  voiceSessionId: string;
  userId: string;
  maskId: string;
  isServerMuted?: boolean;
}

export interface MasqRepository {
  pingDb(): Promise<void>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  updateUserDefaultMask(userId: string, defaultMaskId: string | null): Promise<UserRecord>;
  createUser(input: CreateUserInput): Promise<UserRecord>;
  listMasksByUser(userId: string): Promise<MaskRecord[]>;
  countMasksByUser(userId: string): Promise<number>;
  createMask(input: CreateMaskInput): Promise<MaskRecord>;
  setMaskAvatarUpload(maskId: string, avatarUploadId: string | null): Promise<MaskRecord>;
  findMaskByIdForUser(maskId: string, userId: string): Promise<MaskRecord | null>;
  createServer(input: CreateServerInput): Promise<ServerRecord>;
  updateServerSettings(serverId: string, settings: { channelIdentityMode: ChannelIdentityMode }): Promise<ServerRecord>;
  listServersForUser(userId: string): Promise<ServerListItemRecord[]>;
  findServerById(serverId: string): Promise<ServerRecord | null>;
  findServerMember(serverId: string, userId: string): Promise<ServerMemberRecord | null>;
  listServerMembers(serverId: string): Promise<ServerMemberRecord[]>;
  addServerMember(input: AddServerMemberInput): Promise<ServerMemberRecord>;
  updateServerMemberMask(serverId: string, userId: string, serverMaskId: string): Promise<ServerMemberRecord>;
  setServerMemberRoles(serverId: string, userId: string, roleIds: string[]): Promise<ServerMemberRecord>;
  removeServerMember(serverId: string, userId: string): Promise<boolean>;
  createServerRole(input: CreateServerRoleInput): Promise<ServerRoleRecord>;
  updateServerRole(
    serverId: string,
    roleId: string,
    updates: { name?: string; permissions?: ServerPermission[] },
  ): Promise<ServerRoleRecord>;
  findServerRoleByName(serverId: string, name: string): Promise<ServerRoleRecord | null>;
  findServerRoleById(serverId: string, roleId: string): Promise<ServerRoleRecord | null>;
  listServerRoles(serverId: string): Promise<ServerRoleRecord[]>;
  createServerInvite(input: CreateServerInviteInput): Promise<ServerInviteRecord>;
  findServerInviteByCode(code: string): Promise<ServerInviteRecord | null>;
  incrementServerInviteUses(inviteId: string): Promise<ServerInviteRecord>;
  createServerChannel(input: CreateChannelInput): Promise<ChannelRecord>;
  deleteServerChannel(serverId: string, channelId: string): Promise<boolean>;
  findChannelById(channelId: string): Promise<ChannelRecord | null>;
  findChannelMemberIdentity(channelId: string, userId: string): Promise<ChannelMemberIdentityRecord | null>;
  upsertChannelMemberIdentity(channelId: string, userId: string, maskId: string): Promise<ChannelMemberIdentityRecord>;
  listServerChannels(serverId: string): Promise<ChannelRecord[]>;
  listServerMessages(channelId: string): Promise<ServerMessageRecord[]>;
  createServerMessage(input: CreateServerMessageInput): Promise<ServerMessageRecord>;
  createUpload(input: CreateUploadInput): Promise<UploadRecord>;
  findUploadById(uploadId: string): Promise<UploadRecord | null>;
  maskHasActiveRoomMembership(maskId: string, now: Date): Promise<boolean>;
  deleteMask(maskId: string): Promise<void>;
  listRoomsForMask(maskId: string, now: Date): Promise<RoomListItemRecord[]>;
  createRoom(input: CreateRoomInput): Promise<RoomRecord>;
  addRoomMembership(input: AddRoomMembershipInput): Promise<RoomMembershipRecord>;
  removeRoomMembership(roomId: string, maskId: string): Promise<void>;
  findRoomById(roomId: string): Promise<RoomRecord | null>;
  setRoomLocked(roomId: string, locked: boolean): Promise<RoomRecord>;
  findRoomMembershipWithMask(roomId: string, maskId: string): Promise<RoomMembershipRecord | null>;
  listRoomMessages(roomId: string): Promise<MessageRecord[]>;
  createMessage(input: CreateMessageInput): Promise<MessageRecord>;
  createRoomModeration(input: CreateRoomModerationInput): Promise<RoomModerationRecord>;
  findActiveMute(roomId: string, targetMaskId: string, now: Date): Promise<RoomModerationRecord | null>;
  findFriendRequestById(id: string): Promise<FriendRequestRecord | null>;
  findFriendRequestBetweenUsers(userAId: string, userBId: string): Promise<FriendRequestRecord | null>;
  upsertFriendRequest(input: UpsertFriendRequestInput): Promise<FriendRequestRecord>;
  updateFriendRequestStatus(id: string, status: FriendRequestStatus): Promise<FriendRequestRecord>;
  findFriendshipBetweenUsers(userAId: string, userBId: string): Promise<{ id: string } | null>;
  createFriendship(userAId: string, userBId: string): Promise<{ id: string; userAId: string; userBId: string; createdAt: Date }>;
  deleteFriendshipBetweenUsers(userAId: string, userBId: string): Promise<boolean>;
  listFriendsForUser(userId: string): Promise<FriendUserRecord[]>;
  listIncomingFriendRequests(userId: string): Promise<IncomingFriendRequestRecord[]>;
  listOutgoingFriendRequests(userId: string): Promise<OutgoingFriendRequestRecord[]>;
  findDmThreadById(threadId: string): Promise<DmThreadRecord | null>;
  findDmThreadBetweenUsers(userAId: string, userBId: string): Promise<DmThreadRecord | null>;
  createDmThread(userAId: string, userBId: string): Promise<DmThreadRecord>;
  listDmThreadsForUser(userId: string): Promise<DmThreadRecord[]>;
  upsertDmParticipant(input: UpsertDmParticipantInput): Promise<DmParticipantRecord>;
  findDmParticipant(threadId: string, userId: string): Promise<DmParticipantRecord | null>;
  listDmParticipants(threadId: string): Promise<DmParticipantRecord[]>;
  listDmMessages(threadId: string): Promise<DmMessageRecord[]>;
  createDmMessage(input: CreateDmMessageInput): Promise<DmMessageRecord>;
  findVoiceSessionById(voiceSessionId: string): Promise<VoiceSessionRecord | null>;
  findActiveVoiceSessionByContext(contextType: RtcContextType, contextId: string): Promise<VoiceSessionRecord | null>;
  createVoiceSession(input: CreateVoiceSessionInput): Promise<VoiceSessionRecord>;
  endVoiceSession(voiceSessionId: string, endedAt: Date): Promise<VoiceSessionRecord>;
  createVoiceParticipant(input: CreateVoiceParticipantInput): Promise<VoiceParticipantRecord>;
  listActiveVoiceParticipants(voiceSessionId: string): Promise<VoiceParticipantRecord[]>;
  markVoiceParticipantsLeft(voiceSessionId: string, userId: string, leftAt: Date): Promise<number>;
  setVoiceParticipantsMuted(
    voiceSessionId: string,
    targetMaskId: string,
    isServerMuted: boolean,
  ): Promise<number>;
}

export interface RedisClient {
  ping(): Promise<string>;
  quit(): Promise<string>;
}


