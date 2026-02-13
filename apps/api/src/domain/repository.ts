import type {
  AuraEventKind,
  AuraTier,
  ChannelIdentityMode,
  ChannelType,
  EntitlementKind,
  EntitlementSource,
  PushToTalkMode,
  FriendRequestStatus,
  MembershipRole,
  NarrativeRoomStatus,
  RtcContextType,
  RoomKind,
  ScreenshareQuality,
  UploadContextType,
  UploadKind,
  ServerPermission,
  ServerMemberRole,
} from '@masq/shared';

export interface UserRecord {
  id: string;
  email: string;
  friendCode: string;
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

export interface MaskAuraRecord {
  id: string;
  maskId: string;
  score: number;
  tier: AuraTier;
  color: string;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuraEventRecord {
  id: string;
  maskId: string;
  kind: AuraEventKind;
  weight: number;
  meta: unknown | null;
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
  friendCode: string;
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
  stageModeEnabled: boolean;
  screenshareMinimumRole: ServerMemberRole;
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

export interface NarrativeTemplateRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  phases: unknown;
  roles: unknown;
  requiresEntitlement: EntitlementKind | null;
  createdAt: Date;
}

export interface NarrativeRoomRecord {
  id: string;
  templateId: string;
  code: string;
  hostMaskId: string;
  seed: number;
  status: NarrativeRoomStatus;
  createdAt: Date;
  endedAt: Date | null;
}

export interface NarrativeMembershipRecord {
  id: string;
  roomId: string;
  maskId: string;
  isReady: boolean;
  joinedAt: Date;
  leftAt: Date | null;
  mask: MaskRecord;
}

export interface NarrativeSessionStateRecord {
  roomId: string;
  phaseIndex: number;
  phaseEndsAt: Date | null;
  startedAt: Date;
  updatedAt: Date;
}

export interface NarrativeRoleAssignmentRecord {
  id: string;
  roomId: string;
  maskId: string;
  roleKey: string;
  secretPayload: unknown | null;
  createdAt: Date;
}

export interface NarrativeMessageRecord {
  id: string;
  roomId: string;
  maskId: string;
  body: string;
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

export interface EntitlementRecord {
  id: string;
  userId: string;
  kind: EntitlementKind;
  source: EntitlementSource;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface CosmeticUnlockRecord {
  id: string;
  userId: string;
  key: string;
  unlockedAt: Date;
}

export interface UserRtcSettingsRecord {
  userId: string;
  advancedNoiseSuppression: boolean;
  pushToTalkMode: PushToTalkMode;
  pushToTalkHotkey: string;
  multiPinEnabled: boolean;
  pictureInPictureEnabled: boolean;
  defaultScreenshareFps: 30 | 60;
  defaultScreenshareQuality: ScreenshareQuality;
  cursorHighlight: boolean;
  selectedAuraStyle: string;
  createdAt: Date;
  updatedAt: Date;
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
  friendCode: string;
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

export interface CreateAuraEventInput {
  maskId: string;
  kind: AuraEventKind;
  weight: number;
  meta?: unknown;
}

export interface CreateNarrativeRoomInput {
  templateId: string;
  code: string;
  hostMaskId: string;
  seed: number;
}

export interface UpsertNarrativeTemplateInput {
  slug: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  phases: unknown;
  roles: unknown;
  requiresEntitlement: EntitlementKind | null;
}

export interface AddNarrativeMembershipInput {
  roomId: string;
  maskId: string;
  isReady?: boolean;
}

export interface CreateNarrativeSessionStateInput {
  roomId: string;
  phaseIndex: number;
  phaseEndsAt: Date | null;
  startedAt?: Date;
}

export interface UpsertNarrativeRoleAssignmentInput {
  roomId: string;
  maskId: string;
  roleKey: string;
  secretPayload?: unknown;
}

export interface CreateNarrativeMessageInput {
  roomId: string;
  maskId: string;
  body: string;
}

export interface CreateEntitlementInput {
  userId: string;
  kind: EntitlementKind;
  source: EntitlementSource;
  expiresAt: Date | null;
}

export interface UpdateUserRtcSettingsInput {
  advancedNoiseSuppression?: boolean;
  pushToTalkMode?: PushToTalkMode;
  pushToTalkHotkey?: string;
  multiPinEnabled?: boolean;
  pictureInPictureEnabled?: boolean;
  defaultScreenshareFps?: 30 | 60;
  defaultScreenshareQuality?: ScreenshareQuality;
  cursorHighlight?: boolean;
  selectedAuraStyle?: string;
}

export interface MasqRepository {
  pingDb(): Promise<void>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserByFriendCode(friendCode: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  updateUserDefaultMask(userId: string, defaultMaskId: string | null): Promise<UserRecord>;
  createUser(input: CreateUserInput): Promise<UserRecord>;
  listMasksByUser(userId: string): Promise<MaskRecord[]>;
  countMasksByUser(userId: string): Promise<number>;
  createMask(input: CreateMaskInput): Promise<MaskRecord>;
  setMaskAvatarUpload(maskId: string, avatarUploadId: string | null): Promise<MaskRecord>;
  findMaskById?(maskId: string): Promise<MaskRecord | null>;
  findMaskByIdForUser(maskId: string, userId: string): Promise<MaskRecord | null>;
  createServer(input: CreateServerInput): Promise<ServerRecord>;
  updateServerSettings(serverId: string, settings: { channelIdentityMode: ChannelIdentityMode }): Promise<ServerRecord>;
  updateServerRtcPolicy?(
    serverId: string,
    settings: { stageModeEnabled?: boolean; screenshareMinimumRole?: ServerMemberRole },
  ): Promise<ServerRecord>;
  listServersForUser(userId: string): Promise<ServerListItemRecord[]>;
  findServerById(serverId: string): Promise<ServerRecord | null>;
  findServerMember(serverId: string, userId: string): Promise<ServerMemberRecord | null>;
  listServerMembers(serverId: string): Promise<ServerMemberRecord[]>;
  addServerMember(input: AddServerMemberInput): Promise<ServerMemberRecord>;
  updateServerMemberMask(serverId: string, userId: string, serverMaskId: string): Promise<ServerMemberRecord>;
  updateServerMemberRole(serverId: string, userId: string, role: ServerMemberRole): Promise<ServerMemberRecord>;
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
  findMaskAuraByMaskId?(maskId: string): Promise<MaskAuraRecord | null>;
  upsertMaskAura?(maskId: string): Promise<MaskAuraRecord>;
  updateMaskAura?(
    maskId: string,
    updates: {
      score?: number;
      tier?: AuraTier;
      color?: string;
      lastActivityAt?: Date;
    },
  ): Promise<MaskAuraRecord>;
  listAuraEventsByMask?(maskId: string, options?: { limit?: number; kind?: AuraEventKind; since?: Date }): Promise<AuraEventRecord[]>;
  countAuraEventsByMaskKindSince?(maskId: string, kind: AuraEventKind, since: Date): Promise<number>;
  createAuraEvent?(input: CreateAuraEventInput): Promise<AuraEventRecord>;
  listNarrativeTemplates?(): Promise<NarrativeTemplateRecord[]>;
  upsertNarrativeTemplateBySlug?(input: UpsertNarrativeTemplateInput): Promise<NarrativeTemplateRecord>;
  findNarrativeTemplateById?(templateId: string): Promise<NarrativeTemplateRecord | null>;
  createNarrativeRoom?(input: CreateNarrativeRoomInput): Promise<NarrativeRoomRecord>;
  findNarrativeRoomById?(roomId: string): Promise<NarrativeRoomRecord | null>;
  findNarrativeRoomByCode?(code: string): Promise<NarrativeRoomRecord | null>;
  listNarrativeRoomsByStatus?(status: NarrativeRoomStatus): Promise<NarrativeRoomRecord[]>;
  updateNarrativeRoom?(
    roomId: string,
    updates: {
      status?: NarrativeRoomStatus;
      endedAt?: Date | null;
    },
  ): Promise<NarrativeRoomRecord>;
  addNarrativeMembership?(input: AddNarrativeMembershipInput): Promise<NarrativeMembershipRecord>;
  updateNarrativeMembershipReady?(roomId: string, maskId: string, isReady: boolean): Promise<NarrativeMembershipRecord>;
  removeNarrativeMembership?(roomId: string, maskId: string, leftAt: Date): Promise<void>;
  findNarrativeMembership?(roomId: string, maskId: string): Promise<NarrativeMembershipRecord | null>;
  listNarrativeMemberships?(roomId: string, includeInactive?: boolean): Promise<NarrativeMembershipRecord[]>;
  upsertNarrativeSessionState?(input: CreateNarrativeSessionStateInput): Promise<NarrativeSessionStateRecord>;
  findNarrativeSessionState?(roomId: string): Promise<NarrativeSessionStateRecord | null>;
  createNarrativeRoleAssignment?(input: UpsertNarrativeRoleAssignmentInput): Promise<NarrativeRoleAssignmentRecord>;
  listNarrativeRoleAssignments?(roomId: string): Promise<NarrativeRoleAssignmentRecord[]>;
  findNarrativeRoleAssignment?(roomId: string, maskId: string): Promise<NarrativeRoleAssignmentRecord | null>;
  createNarrativeMessage?(input: CreateNarrativeMessageInput): Promise<NarrativeMessageRecord>;
  listNarrativeMessages?(roomId: string, limit?: number): Promise<NarrativeMessageRecord[]>;
  listEntitlementsByUser?(userId: string): Promise<EntitlementRecord[]>;
  createEntitlement?(input: CreateEntitlementInput): Promise<EntitlementRecord>;
  listCosmeticUnlocksByUser?(userId: string): Promise<CosmeticUnlockRecord[]>;
  findUserRtcSettings?(userId: string): Promise<UserRtcSettingsRecord | null>;
  upsertUserRtcSettings?(userId: string, updates: UpdateUserRtcSettingsInput): Promise<UserRtcSettingsRecord>;
}

export interface RedisClient {
  ping(): Promise<string>;
  quit(): Promise<string>;
}


