import { z } from 'zod';

export const MAX_MASKS_PER_USER = 3;
export const MAX_ROOM_MESSAGE_LENGTH = 1000;
export const MAX_RECENT_MESSAGES = 50;
export const MIN_FOG_LEVEL = 0;
export const MAX_FOG_LEVEL = 3;
export const DEFAULT_MESSAGE_DECAY_MINUTES = 8;
export const FOCUS_REVEAL_DURATION_SECONDS = 30;
export const DEFAULT_MUTE_MINUTES = 10;
export const MAX_MUTE_MINUTES = 60;
export const MAX_FRIEND_EMAIL_LENGTH = 255;
export const MAX_SERVER_NAME_LENGTH = 80;
export const MAX_CHANNEL_NAME_LENGTH = 60;
export const MAX_INVITE_CODE_LENGTH = 64;
export const MAX_INVITE_EXPIRY_MINUTES = 10_080;
export const MAX_INVITE_USES = 100_000;
export const MAX_SERVER_ROLE_NAME_LENGTH = 40;
export const MAX_SERVER_ROLE_ASSIGNMENTS = 24;
export const MAX_RTC_PARTICIPANT_DISPLAY_NAME_LENGTH = 40;
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_FILENAME_LENGTH = 180;

export const ALLOWED_IMAGE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const RoomKindSchema = z.enum(['EPHEMERAL', 'RITUAL', 'NARRATIVE']);
export type RoomKind = z.infer<typeof RoomKindSchema>;

export const MembershipRoleSchema = z.enum(['HOST', 'MEMBER']);
export type MembershipRole = z.infer<typeof MembershipRoleSchema>;

export const FriendRequestStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED']);
export type FriendRequestStatus = z.infer<typeof FriendRequestStatusSchema>;

export const ServerMemberRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER']);
export type ServerMemberRole = z.infer<typeof ServerMemberRoleSchema>;

export const ChannelTypeSchema = z.enum(['TEXT']);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;

export const ChannelIdentityModeSchema = z.enum(['SERVER_MASK', 'CHANNEL_MASK']);
export type ChannelIdentityMode = z.infer<typeof ChannelIdentityModeSchema>;

export const RtcContextTypeSchema = z.enum(['SERVER_CHANNEL', 'DM_THREAD', 'EPHEMERAL_ROOM']);
export type RtcContextType = z.infer<typeof RtcContextTypeSchema>;

export const UploadKindSchema = z.enum(['MESSAGE_IMAGE', 'MASK_AVATAR']);
export type UploadKind = z.infer<typeof UploadKindSchema>;

export const UploadContextTypeSchema = z.enum(['SERVER_CHANNEL', 'DM_THREAD', 'EPHEMERAL_ROOM']);
export type UploadContextType = z.infer<typeof UploadContextTypeSchema>;

export const ServerPermissionSchema = z.enum([
  'ManageChannels',
  'ManageMembers',
  'CreateInvites',
  'ModerateChat',
]);
export type ServerPermission = z.infer<typeof ServerPermissionSchema>;

export const ALL_SERVER_PERMISSIONS = ServerPermissionSchema.options;
export const DEFAULT_SERVER_ROLE_ADMIN_NAME = 'ADMIN';
export const DEFAULT_SERVER_ROLE_MEMBER_NAME = 'MEMBER';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export const MaskSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string().min(1).max(40),
  color: z.string().min(1).max(32),
  avatarSeed: z.string().min(1).max(80),
  avatarUploadId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
});

export const RoomSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(80),
  kind: RoomKindSchema,
  locked: z.boolean(),
  fogLevel: z.number().int().min(MIN_FOG_LEVEL).max(MAX_FOG_LEVEL),
  messageDecayMinutes: z.number().int().min(1).max(180),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const RoomMembershipSchema = z.object({
  roomId: z.string().uuid(),
  maskId: z.string().uuid(),
  role: MembershipRoleSchema,
  joinedAt: z.string().datetime(),
});

export const MessageSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
  maskId: z.string().uuid(),
  body: z.string().max(MAX_ROOM_MESSAGE_LENGTH),
  imageUploadId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
});

export const AuthResponseSchema = z.object({
  user: UserSchema,
});

export const LogoutResponseSchema = z.object({
  success: z.literal(true),
});

export const MeResponseSchema = z.object({
  user: UserSchema,
  masks: z.array(MaskSchema),
});

export const DefaultMaskSummarySchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1).max(40),
  color: z.string().min(1).max(32),
  avatarSeed: z.string().min(1).max(80),
  avatarUploadId: z.string().uuid().nullable().optional(),
});

export const FriendUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  defaultMask: DefaultMaskSummarySchema.nullable(),
});

export const FriendRequestSchema = z.object({
  id: z.string().uuid(),
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  status: FriendRequestStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateFriendRequestRequestSchema = z
  .object({
    toEmail: z.string().email().max(MAX_FRIEND_EMAIL_LENGTH).optional(),
    toUserId: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.toEmail) !== Boolean(value.toUserId), {
    message: 'Provide exactly one of toEmail or toUserId',
    path: ['toEmail'],
  });

export const FriendRequestParamsSchema = z.object({
  id: z.string().uuid(),
});

export const FriendUserParamsSchema = z.object({
  friendUserId: z.string().uuid(),
});

export const FriendActionResponseSchema = z.object({
  success: z.literal(true),
});

export const CreateFriendRequestResponseSchema = z.object({
  request: FriendRequestSchema,
});

export const FriendsListResponseSchema = z.object({
  friends: z.array(FriendUserSchema),
});

export const IncomingFriendRequestItemSchema = z.object({
  request: FriendRequestSchema,
  fromUser: FriendUserSchema,
});

export const OutgoingFriendRequestItemSchema = z.object({
  request: FriendRequestSchema,
  toUser: FriendUserSchema,
});

export const FriendRequestsResponseSchema = z.object({
  incoming: z.array(IncomingFriendRequestItemSchema),
  outgoing: z.array(OutgoingFriendRequestItemSchema),
});

export const StartDmRequestSchema = z.object({
  friendUserId: z.string().uuid(),
  initialMaskId: z.string().uuid(),
});

export const DmThreadParamsSchema = z.object({
  threadId: z.string().uuid(),
});

export const SetDmMaskRequestSchema = z.object({
  maskId: z.string().uuid(),
});

export const ServerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(MAX_SERVER_NAME_LENGTH),
  ownerUserId: z.string().uuid(),
  channelIdentityMode: ChannelIdentityModeSchema,
  createdAt: z.string().datetime(),
});

export const ServerInviteSchema = z.object({
  id: z.string().uuid(),
  serverId: z.string().uuid(),
  code: z.string().min(1).max(MAX_INVITE_CODE_LENGTH),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  maxUses: z.number().int().min(1).max(MAX_INVITE_USES).nullable(),
  uses: z.number().int().min(0),
});

export const ServerRoleSchema = z.object({
  id: z.string().uuid(),
  serverId: z.string().uuid(),
  name: z.string().min(1).max(MAX_SERVER_ROLE_NAME_LENGTH),
  permissions: z.array(ServerPermissionSchema),
  createdAt: z.string().datetime(),
});

export const ServerMemberSchema = z.object({
  serverId: z.string().uuid(),
  userId: z.string().uuid(),
  role: ServerMemberRoleSchema,
  roleIds: z.array(z.string().uuid()),
  permissions: z.array(ServerPermissionSchema),
  joinedAt: z.string().datetime(),
  serverMask: DefaultMaskSummarySchema,
});

export const ChannelSchema = z.object({
  id: z.string().uuid(),
  serverId: z.string().uuid(),
  name: z.string().min(1).max(MAX_CHANNEL_NAME_LENGTH),
  type: ChannelTypeSchema,
  createdAt: z.string().datetime(),
});

export const ServerListItemSchema = z.object({
  server: ServerSchema,
  role: ServerMemberRoleSchema,
  joinedAt: z.string().datetime(),
  serverMask: DefaultMaskSummarySchema,
});

export const CreateServerRequestSchema = z.object({
  name: z.string().min(1).max(MAX_SERVER_NAME_LENGTH),
});

export const CreateServerResponseSchema = z.object({
  server: ServerSchema,
});

export const ListServersResponseSchema = z.object({
  servers: z.array(ServerListItemSchema),
});

export const ServerParamsSchema = z.object({
  serverId: z.string().uuid(),
});

export const GetServerResponseSchema = z.object({
  server: ServerSchema,
  channels: z.array(ChannelSchema),
  members: z.array(ServerMemberSchema),
  myPermissions: z.array(ServerPermissionSchema),
});

export const CreateServerChannelRequestSchema = z.object({
  name: z.string().min(1).max(MAX_CHANNEL_NAME_LENGTH),
});

export const ServerChannelParamsSchema = z.object({
  serverId: z.string().uuid(),
  channelId: z.string().uuid(),
});

export const CreateServerChannelResponseSchema = z.object({
  channel: ChannelSchema,
});

export const DeleteServerChannelResponseSchema = z.object({
  success: z.literal(true),
});

export const CreateServerInviteRequestSchema = z.object({
  expiresMinutes: z.number().int().min(1).max(MAX_INVITE_EXPIRY_MINUTES).optional(),
  maxUses: z.number().int().min(1).max(MAX_INVITE_USES).optional(),
});

export const CreateServerInviteResponseSchema = z.object({
  invite: ServerInviteSchema,
});

export const JoinServerRequestSchema = z.object({
  inviteCode: z.string().min(4).max(MAX_INVITE_CODE_LENGTH),
  serverMaskId: z.string().uuid(),
});

export const JoinServerResponseSchema = z.object({
  success: z.literal(true),
  serverId: z.string().uuid(),
});

export const SetServerMaskRequestSchema = z.object({
  serverMaskId: z.string().uuid(),
});

export const SetServerMaskResponseSchema = z.object({
  success: z.literal(true),
  member: ServerMemberSchema,
});

export const UpdateServerSettingsRequestSchema = z.object({
  channelIdentityMode: ChannelIdentityModeSchema,
});

export const UpdateServerSettingsResponseSchema = z.object({
  success: z.literal(true),
  server: ServerSchema,
});

export const ServerRoleParamsSchema = z.object({
  serverId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export const CreateServerRoleRequestSchema = z.object({
  name: z.string().min(1).max(MAX_SERVER_ROLE_NAME_LENGTH),
  permissions: z
    .array(ServerPermissionSchema)
    .max(ALL_SERVER_PERMISSIONS.length)
    .default([]),
});

export const UpdateServerRoleRequestSchema = z
  .object({
    name: z.string().min(1).max(MAX_SERVER_ROLE_NAME_LENGTH).optional(),
    permissions: z.array(ServerPermissionSchema).max(ALL_SERVER_PERMISSIONS.length).optional(),
  })
  .refine((value) => value.name !== undefined || value.permissions !== undefined, {
    message: 'Provide at least one field',
    path: ['name'],
  });

export const ServerRoleResponseSchema = z.object({
  role: ServerRoleSchema,
});

export const ListServerRolesResponseSchema = z.object({
  roles: z.array(ServerRoleSchema),
  myPermissions: z.array(ServerPermissionSchema),
});

export const SetServerMemberRolesRequestSchema = z.object({
  roleIds: z.array(z.string().uuid()).max(MAX_SERVER_ROLE_ASSIGNMENTS),
});

export const SetServerMemberRolesResponseSchema = z.object({
  success: z.literal(true),
  member: ServerMemberSchema,
});

export const ServerMemberParamsSchema = z.object({
  serverId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const KickServerMemberResponseSchema = z.object({
  success: z.literal(true),
});

export const ChannelMaskParamsSchema = z.object({
  channelId: z.string().uuid(),
});

export const SetChannelMaskRequestSchema = z.object({
  maskId: z.string().uuid(),
});

export const SetChannelMaskResponseSchema = z.object({
  success: z.literal(true),
  mask: z.object({
    maskId: z.string().uuid(),
    displayName: z.string().min(1).max(40),
    avatarSeed: z.string().min(1).max(80),
    color: z.string().min(1).max(32),
  }),
});

export const CreateMaskRequestSchema = z.object({
  displayName: z.string().min(1).max(40),
  color: z.string().min(1).max(32).optional(),
  avatarSeed: z.string().min(1).max(80).optional(),
});

export const CreateMaskResponseSchema = z.object({
  mask: MaskSchema,
});

export const DeleteMaskParamsSchema = z.object({
  maskId: z.string().uuid(),
});

export const DeleteMaskResponseSchema = z.object({
  success: z.literal(true),
});

export const ListRoomsQuerySchema = z.object({
  maskId: z.string().uuid(),
});

export const RoomListItemSchema = RoomSchema.extend({
  role: MembershipRoleSchema,
  joinedAt: z.string().datetime(),
});

export const ListRoomsResponseSchema = z.object({
  rooms: z.array(RoomListItemSchema),
});

export const CreateRoomRequestSchema = z.object({
  maskId: z.string().uuid(),
  title: z.string().min(1).max(80),
  kind: RoomKindSchema,
  expiresAt: z.string().datetime().nullable().optional(),
  locked: z.boolean().optional(),
  fogLevel: z.number().int().min(MIN_FOG_LEVEL).max(MAX_FOG_LEVEL).optional(),
  messageDecayMinutes: z.number().int().min(1).max(180).optional(),
});

export const CreateRoomResponseSchema = z.object({
  room: RoomSchema,
});

export const JoinRoomParamsSchema = z.object({
  roomId: z.string().uuid(),
});

export const JoinRoomRequestSchema = z.object({
  maskId: z.string().uuid(),
});

export const JoinRoomResponseSchema = z.object({
  success: z.literal(true),
});

export const ModerateRoomParamsSchema = z.object({
  roomId: z.string().uuid(),
});

export const RoomModerationActionTypeSchema = z.enum(['MUTE', 'EXILE']);
export type RoomModerationActionType = z.infer<typeof RoomModerationActionTypeSchema>;

export const RoomModerationSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
  targetMaskId: z.string().uuid(),
  actionType: RoomModerationActionTypeSchema,
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  actorMaskId: z.string().uuid(),
});

export const MuteRoomMemberRequestSchema = z.object({
  actorMaskId: z.string().uuid(),
  targetMaskId: z.string().uuid(),
  minutes: z.number().int().min(1).max(MAX_MUTE_MINUTES),
});

export const ExileRoomMemberRequestSchema = z.object({
  actorMaskId: z.string().uuid(),
  targetMaskId: z.string().uuid(),
});

export const LockRoomRequestSchema = z.object({
  actorMaskId: z.string().uuid(),
  locked: z.boolean(),
});

export const ModerateRoomResponseSchema = z.object({
  success: z.literal(true),
  moderation: RoomModerationSchema.optional(),
  room: RoomSchema.optional(),
});

export const ImageAttachmentSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string().min(1).max(MAX_IMAGE_FILENAME_LENGTH),
  contentType: z.enum(ALLOWED_IMAGE_CONTENT_TYPES),
  sizeBytes: z.number().int().min(1).max(MAX_IMAGE_UPLOAD_BYTES),
});

export const UploadImageRequestSchema = z.object({
  contextType: UploadContextTypeSchema,
  contextId: z.string().uuid(),
});

export const UploadedImageSchema = z.object({
  id: z.string().uuid(),
  ownerUserId: z.string().uuid(),
  kind: UploadKindSchema,
  contextType: UploadContextTypeSchema.nullable(),
  contextId: z.string().uuid().nullable(),
  fileName: z.string().min(1).max(MAX_IMAGE_FILENAME_LENGTH),
  contentType: z.enum(ALLOWED_IMAGE_CONTENT_TYPES),
  sizeBytes: z.number().int().min(1).max(MAX_IMAGE_UPLOAD_BYTES),
  createdAt: z.string().datetime(),
});

export const UploadImageResponseSchema = z.object({
  upload: UploadedImageSchema,
});

export const UploadParamsSchema = z.object({
  uploadId: z.string().uuid(),
});

export const SetMaskAvatarParamsSchema = z.object({
  maskId: z.string().uuid(),
});

export const SetMaskAvatarResponseSchema = z.object({
  success: z.literal(true),
  mask: MaskSchema,
});

export const SocketMaskIdentitySchema = z.object({
  maskId: z.string().uuid(),
  displayName: z.string().min(1).max(40),
  avatarSeed: z.string().min(1).max(80),
  color: z.string().min(1).max(32),
  avatarUploadId: z.string().uuid().nullable().optional(),
});

export const RoomMemberStateSchema = SocketMaskIdentitySchema.extend({
  role: MembershipRoleSchema,
});

export const ServerChannelMemberStateSchema = z.object({
  userId: z.string().uuid(),
  role: ServerMemberRoleSchema,
  mask: SocketMaskIdentitySchema,
});

export const RoomMessageSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
  body: z.string().max(MAX_ROOM_MESSAGE_LENGTH),
  image: ImageAttachmentSchema.nullable().optional(),
  createdAt: z.string().datetime(),
  mask: SocketMaskIdentitySchema,
});

export const ChannelMessageSchema = z.object({
  id: z.string().uuid(),
  channelId: z.string().uuid(),
  body: z.string().max(MAX_ROOM_MESSAGE_LENGTH),
  image: ImageAttachmentSchema.nullable().optional(),
  createdAt: z.string().datetime(),
  mask: SocketMaskIdentitySchema,
});

export const DmThreadSchema = z.object({
  id: z.string().uuid(),
  userAId: z.string().uuid(),
  userBId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export const DmParticipantStateSchema = z.object({
  userId: z.string().uuid(),
  mask: SocketMaskIdentitySchema,
});

export const DmMessageSchema = z.object({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  body: z.string().max(MAX_ROOM_MESSAGE_LENGTH),
  image: ImageAttachmentSchema.nullable().optional(),
  createdAt: z.string().datetime(),
  mask: SocketMaskIdentitySchema,
});

export const DmStartResponseSchema = z.object({
  thread: DmThreadSchema,
  participants: z.array(DmParticipantStateSchema),
  recentMessages: z.array(DmMessageSchema),
});

export const DmThreadListItemSchema = z.object({
  thread: DmThreadSchema,
  peer: FriendUserSchema,
  activeMask: SocketMaskIdentitySchema,
  lastMessage: DmMessageSchema.nullable(),
});

export const DmThreadsResponseSchema = z.object({
  threads: z.array(DmThreadListItemSchema),
});

export const DmThreadResponseSchema = z.object({
  thread: DmThreadSchema,
  peer: FriendUserSchema,
  participants: z.array(DmParticipantStateSchema),
  messages: z.array(DmMessageSchema),
  activeMask: SocketMaskIdentitySchema,
});

export const SetDmMaskResponseSchema = z.object({
  success: z.literal(true),
  activeMask: SocketMaskIdentitySchema,
});

export const VoiceSessionSchema = z.object({
  id: z.string().uuid(),
  contextType: RtcContextTypeSchema,
  contextId: z.string().uuid(),
  livekitRoomName: z.string().min(1),
  createdAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
});

export const VoiceParticipantSchema = z.object({
  id: z.string().uuid(),
  voiceSessionId: z.string().uuid(),
  userId: z.string().uuid(),
  maskId: z.string().uuid(),
  joinedAt: z.string().datetime(),
  leftAt: z.string().datetime().nullable(),
  isServerMuted: z.boolean(),
  mask: z.object({
    id: z.string().uuid(),
    displayName: z.string().min(1).max(MAX_RTC_PARTICIPANT_DISPLAY_NAME_LENGTH),
    color: z.string().min(1).max(32),
    avatarSeed: z.string().min(1).max(80),
  }),
});

export const CreateRtcSessionRequestSchema = z.object({
  contextType: RtcContextTypeSchema,
  contextId: z.string().uuid(),
  maskId: z.string().uuid(),
});

export const CreateRtcSessionResponseSchema = z.object({
  voiceSessionId: z.string().uuid(),
  livekitRoomName: z.string().min(1),
  token: z.string().min(1),
  livekitUrl: z.string().url(),
  participants: z.array(VoiceParticipantSchema),
});

export const RtcSessionParamsSchema = z.object({
  id: z.string().uuid(),
});

export const LeaveRtcSessionResponseSchema = z.object({
  success: z.literal(true),
});

export const MuteRtcParticipantRequestSchema = z.object({
  actorMaskId: z.string().uuid(),
  targetMaskId: z.string().uuid(),
});

export const MuteRtcParticipantResponseSchema = z.object({
  success: z.literal(true),
  participants: z.array(VoiceParticipantSchema),
});

export const EndRtcSessionRequestSchema = z.object({
  actorMaskId: z.string().uuid(),
});

export const EndRtcSessionResponseSchema = z.object({
  success: z.literal(true),
  session: VoiceSessionSchema,
});

export const JoinRoomSocketPayloadSchema = z.object({
  roomId: z.string().uuid(),
  maskId: z.string().uuid(),
});

export const SendMessageSocketPayloadSchema = z.object({
  roomId: z.string().uuid(),
  maskId: z.string().uuid(),
  body: z.string().max(MAX_ROOM_MESSAGE_LENGTH).default(''),
  imageUploadId: z.string().uuid().optional(),
}).refine((value) => value.body.trim().length > 0 || Boolean(value.imageUploadId), {
  message: 'Message body or imageUploadId is required',
  path: ['body'],
});

export const JoinDmSocketPayloadSchema = z.object({
  threadId: z.string().uuid(),
  maskId: z.string().uuid(),
});

export const SendDmSocketPayloadSchema = z.object({
  threadId: z.string().uuid(),
  maskId: z.string().uuid(),
  body: z.string().max(MAX_ROOM_MESSAGE_LENGTH).default(''),
  imageUploadId: z.string().uuid().optional(),
}).refine((value) => value.body.trim().length > 0 || Boolean(value.imageUploadId), {
  message: 'Message body or imageUploadId is required',
  path: ['body'],
});

export const JoinChannelSocketPayloadSchema = z.object({
  channelId: z.string().uuid(),
});

export const SendChannelMessageSocketPayloadSchema = z.object({
  channelId: z.string().uuid(),
  body: z.string().max(MAX_ROOM_MESSAGE_LENGTH).default(''),
  imageUploadId: z.string().uuid().optional(),
}).refine((value) => value.body.trim().length > 0 || Boolean(value.imageUploadId), {
  message: 'Message body or imageUploadId is required',
  path: ['body'],
});

export const ClientSocketEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('JOIN_ROOM'),
    data: JoinRoomSocketPayloadSchema,
  }),
  z.object({
    type: z.literal('SEND_MESSAGE'),
    data: SendMessageSocketPayloadSchema,
  }),
  z.object({
    type: z.literal('JOIN_DM'),
    data: JoinDmSocketPayloadSchema,
  }),
  z.object({
    type: z.literal('SEND_DM'),
    data: SendDmSocketPayloadSchema,
  }),
  z.object({
    type: z.literal('JOIN_CHANNEL'),
    data: JoinChannelSocketPayloadSchema,
  }),
  z.object({
    type: z.literal('SEND_CHANNEL_MESSAGE'),
    data: SendChannelMessageSocketPayloadSchema,
  }),
]);

export const RoomStateSocketPayloadSchema = z.object({
  room: RoomSchema,
  members: z.array(RoomMemberStateSchema),
  recentMessages: z.array(RoomMessageSchema),
  serverTime: z.string().datetime(),
});

export const NewMessageSocketPayloadSchema = z.object({
  message: RoomMessageSchema,
});

export const RoomMemberJoinedSocketPayloadSchema = z.object({
  roomId: z.string().uuid(),
  member: RoomMemberStateSchema,
});

export const RoomMemberLeftSocketPayloadSchema = z.object({
  roomId: z.string().uuid(),
  member: RoomMemberStateSchema,
});

export const RoomExpiredSocketPayloadSchema = z.object({
  roomId: z.string().uuid(),
});

export const ChannelMemberJoinedSocketPayloadSchema = z.object({
  channelId: z.string().uuid(),
  member: ServerChannelMemberStateSchema,
});

export const ChannelMemberLeftSocketPayloadSchema = z.object({
  channelId: z.string().uuid(),
  member: ServerChannelMemberStateSchema,
});

export const MemberJoinedSocketPayloadSchema = z.union([
  RoomMemberJoinedSocketPayloadSchema,
  ChannelMemberJoinedSocketPayloadSchema,
]);

export const MemberLeftSocketPayloadSchema = z.union([
  RoomMemberLeftSocketPayloadSchema,
  ChannelMemberLeftSocketPayloadSchema,
]);

export const ChannelStateSocketPayloadSchema = z.object({
  channel: ChannelSchema,
  members: z.array(ServerChannelMemberStateSchema),
  recentMessages: z.array(ChannelMessageSchema),
});

export const NewChannelMessageSocketPayloadSchema = z.object({
  message: ChannelMessageSchema,
});

export const DmStateSocketPayloadSchema = z.object({
  threadId: z.string().uuid(),
  participants: z.array(DmParticipantStateSchema),
  recentMessages: z.array(DmMessageSchema),
});

export const NewDmMessageSocketPayloadSchema = z.object({
  threadId: z.string().uuid(),
  message: DmMessageSchema,
});

export const SocketModerationEventTypeSchema = z.enum(['MUTE', 'EXILE', 'LOCK']);
export type SocketModerationEventType = z.infer<typeof SocketModerationEventTypeSchema>;

export const ModerationEventSocketPayloadSchema = z.object({
  roomId: z.string().uuid(),
  actionType: SocketModerationEventTypeSchema,
  actorMaskId: z.string().uuid(),
  targetMaskId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  locked: z.boolean().optional(),
  createdAt: z.string().datetime(),
});

export const SocketErrorPayloadSchema = z.object({
  message: z.string().min(1),
});

export const ServerSocketEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ROOM_STATE'),
    data: RoomStateSocketPayloadSchema,
  }),
  z.object({
    type: z.literal('NEW_MESSAGE'),
    data: NewMessageSocketPayloadSchema,
  }),
  z.object({
    type: z.literal('MEMBER_JOINED'),
    data: MemberJoinedSocketPayloadSchema,
  }),
  z.object({
    type: z.literal('MEMBER_LEFT'),
    data: MemberLeftSocketPayloadSchema,
  }),
  z.object({
    type: z.literal('ROOM_EXPIRED'),
    data: RoomExpiredSocketPayloadSchema,
  }),
  z.object({
    type: z.literal('CHANNEL_STATE'),
    data: ChannelStateSocketPayloadSchema,
  }),
  z.object({
    type: z.literal('NEW_CHANNEL_MESSAGE'),
    data: NewChannelMessageSocketPayloadSchema,
  }),
  z.object({
    type: z.literal('DM_STATE'),
    data: DmStateSocketPayloadSchema,
  }),
  z.object({
    type: z.literal('NEW_DM_MESSAGE'),
    data: NewDmMessageSocketPayloadSchema,
  }),
  z.object({
    type: z.literal('MODERATION_EVENT'),
    data: ModerationEventSocketPayloadSchema,
  }),
  z.object({
    type: z.literal('ERROR'),
    data: SocketErrorPayloadSchema,
  }),
]);

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  db: z.boolean(),
  redis: z.boolean(),
  time: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type Mask = z.infer<typeof MaskSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type RoomMembership = z.infer<typeof RoomMembershipSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;
export type DefaultMaskSummary = z.infer<typeof DefaultMaskSummarySchema>;
export type FriendUser = z.infer<typeof FriendUserSchema>;
export type FriendRequest = z.infer<typeof FriendRequestSchema>;
export type CreateFriendRequestRequest = z.infer<typeof CreateFriendRequestRequestSchema>;
export type FriendRequestParams = z.infer<typeof FriendRequestParamsSchema>;
export type FriendUserParams = z.infer<typeof FriendUserParamsSchema>;
export type FriendActionResponse = z.infer<typeof FriendActionResponseSchema>;
export type CreateFriendRequestResponse = z.infer<typeof CreateFriendRequestResponseSchema>;
export type FriendsListResponse = z.infer<typeof FriendsListResponseSchema>;
export type IncomingFriendRequestItem = z.infer<typeof IncomingFriendRequestItemSchema>;
export type OutgoingFriendRequestItem = z.infer<typeof OutgoingFriendRequestItemSchema>;
export type FriendRequestsResponse = z.infer<typeof FriendRequestsResponseSchema>;
export type StartDmRequest = z.infer<typeof StartDmRequestSchema>;
export type DmThreadParams = z.infer<typeof DmThreadParamsSchema>;
export type SetDmMaskRequest = z.infer<typeof SetDmMaskRequestSchema>;
export type Server = z.infer<typeof ServerSchema>;
export type ServerInvite = z.infer<typeof ServerInviteSchema>;
export type ServerRole = z.infer<typeof ServerRoleSchema>;
export type ServerMember = z.infer<typeof ServerMemberSchema>;
export type Channel = z.infer<typeof ChannelSchema>;
export type ServerListItem = z.infer<typeof ServerListItemSchema>;
export type CreateServerRequest = z.infer<typeof CreateServerRequestSchema>;
export type CreateServerResponse = z.infer<typeof CreateServerResponseSchema>;
export type ListServersResponse = z.infer<typeof ListServersResponseSchema>;
export type ServerParams = z.infer<typeof ServerParamsSchema>;
export type GetServerResponse = z.infer<typeof GetServerResponseSchema>;
export type ServerRoleParams = z.infer<typeof ServerRoleParamsSchema>;
export type CreateServerRoleRequest = z.infer<typeof CreateServerRoleRequestSchema>;
export type UpdateServerRoleRequest = z.infer<typeof UpdateServerRoleRequestSchema>;
export type ServerRoleResponse = z.infer<typeof ServerRoleResponseSchema>;
export type ListServerRolesResponse = z.infer<typeof ListServerRolesResponseSchema>;
export type SetServerMemberRolesRequest = z.infer<typeof SetServerMemberRolesRequestSchema>;
export type SetServerMemberRolesResponse = z.infer<typeof SetServerMemberRolesResponseSchema>;
export type CreateServerChannelRequest = z.infer<typeof CreateServerChannelRequestSchema>;
export type ServerChannelParams = z.infer<typeof ServerChannelParamsSchema>;
export type CreateServerChannelResponse = z.infer<typeof CreateServerChannelResponseSchema>;
export type DeleteServerChannelResponse = z.infer<typeof DeleteServerChannelResponseSchema>;
export type CreateServerInviteRequest = z.infer<typeof CreateServerInviteRequestSchema>;
export type CreateServerInviteResponse = z.infer<typeof CreateServerInviteResponseSchema>;
export type JoinServerRequest = z.infer<typeof JoinServerRequestSchema>;
export type JoinServerResponse = z.infer<typeof JoinServerResponseSchema>;
export type SetServerMaskRequest = z.infer<typeof SetServerMaskRequestSchema>;
export type SetServerMaskResponse = z.infer<typeof SetServerMaskResponseSchema>;
export type UpdateServerSettingsRequest = z.infer<typeof UpdateServerSettingsRequestSchema>;
export type UpdateServerSettingsResponse = z.infer<typeof UpdateServerSettingsResponseSchema>;
export type ServerMemberParams = z.infer<typeof ServerMemberParamsSchema>;
export type KickServerMemberResponse = z.infer<typeof KickServerMemberResponseSchema>;
export type ChannelMaskParams = z.infer<typeof ChannelMaskParamsSchema>;
export type SetChannelMaskRequest = z.infer<typeof SetChannelMaskRequestSchema>;
export type SetChannelMaskResponse = z.infer<typeof SetChannelMaskResponseSchema>;
export type CreateMaskRequest = z.infer<typeof CreateMaskRequestSchema>;
export type CreateMaskResponse = z.infer<typeof CreateMaskResponseSchema>;
export type SetMaskAvatarParams = z.infer<typeof SetMaskAvatarParamsSchema>;
export type SetMaskAvatarResponse = z.infer<typeof SetMaskAvatarResponseSchema>;
export type DeleteMaskParams = z.infer<typeof DeleteMaskParamsSchema>;
export type DeleteMaskResponse = z.infer<typeof DeleteMaskResponseSchema>;
export type ListRoomsQuery = z.infer<typeof ListRoomsQuerySchema>;
export type RoomListItem = z.infer<typeof RoomListItemSchema>;
export type ListRoomsResponse = z.infer<typeof ListRoomsResponseSchema>;
export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;
export type CreateRoomResponse = z.infer<typeof CreateRoomResponseSchema>;
export type JoinRoomParams = z.infer<typeof JoinRoomParamsSchema>;
export type JoinRoomRequest = z.infer<typeof JoinRoomRequestSchema>;
export type JoinRoomResponse = z.infer<typeof JoinRoomResponseSchema>;
export type ModerateRoomParams = z.infer<typeof ModerateRoomParamsSchema>;
export type RoomModeration = z.infer<typeof RoomModerationSchema>;
export type MuteRoomMemberRequest = z.infer<typeof MuteRoomMemberRequestSchema>;
export type ExileRoomMemberRequest = z.infer<typeof ExileRoomMemberRequestSchema>;
export type LockRoomRequest = z.infer<typeof LockRoomRequestSchema>;
export type ModerateRoomResponse = z.infer<typeof ModerateRoomResponseSchema>;
export type ImageAttachment = z.infer<typeof ImageAttachmentSchema>;
export type UploadImageRequest = z.infer<typeof UploadImageRequestSchema>;
export type UploadedImage = z.infer<typeof UploadedImageSchema>;
export type UploadImageResponse = z.infer<typeof UploadImageResponseSchema>;
export type UploadParams = z.infer<typeof UploadParamsSchema>;
export type SocketMaskIdentity = z.infer<typeof SocketMaskIdentitySchema>;
export type RoomMemberState = z.infer<typeof RoomMemberStateSchema>;
export type RoomMessage = z.infer<typeof RoomMessageSchema>;
export type ServerChannelMemberState = z.infer<typeof ServerChannelMemberStateSchema>;
export type ChannelMessage = z.infer<typeof ChannelMessageSchema>;
export type DmThread = z.infer<typeof DmThreadSchema>;
export type DmParticipantState = z.infer<typeof DmParticipantStateSchema>;
export type DmMessage = z.infer<typeof DmMessageSchema>;
export type DmStartResponse = z.infer<typeof DmStartResponseSchema>;
export type DmThreadListItem = z.infer<typeof DmThreadListItemSchema>;
export type DmThreadsResponse = z.infer<typeof DmThreadsResponseSchema>;
export type DmThreadResponse = z.infer<typeof DmThreadResponseSchema>;
export type SetDmMaskResponse = z.infer<typeof SetDmMaskResponseSchema>;
export type VoiceSession = z.infer<typeof VoiceSessionSchema>;
export type VoiceParticipant = z.infer<typeof VoiceParticipantSchema>;
export type CreateRtcSessionRequest = z.infer<typeof CreateRtcSessionRequestSchema>;
export type CreateRtcSessionResponse = z.infer<typeof CreateRtcSessionResponseSchema>;
export type RtcSessionParams = z.infer<typeof RtcSessionParamsSchema>;
export type LeaveRtcSessionResponse = z.infer<typeof LeaveRtcSessionResponseSchema>;
export type MuteRtcParticipantRequest = z.infer<typeof MuteRtcParticipantRequestSchema>;
export type MuteRtcParticipantResponse = z.infer<typeof MuteRtcParticipantResponseSchema>;
export type EndRtcSessionRequest = z.infer<typeof EndRtcSessionRequestSchema>;
export type EndRtcSessionResponse = z.infer<typeof EndRtcSessionResponseSchema>;
export type JoinRoomSocketPayload = z.infer<typeof JoinRoomSocketPayloadSchema>;
export type SendMessageSocketPayload = z.infer<typeof SendMessageSocketPayloadSchema>;
export type JoinDmSocketPayload = z.infer<typeof JoinDmSocketPayloadSchema>;
export type SendDmSocketPayload = z.infer<typeof SendDmSocketPayloadSchema>;
export type JoinChannelSocketPayload = z.infer<typeof JoinChannelSocketPayloadSchema>;
export type SendChannelMessageSocketPayload = z.infer<typeof SendChannelMessageSocketPayloadSchema>;
export type ClientSocketEvent = z.infer<typeof ClientSocketEventSchema>;
export type RoomStateSocketPayload = z.infer<typeof RoomStateSocketPayloadSchema>;
export type NewMessageSocketPayload = z.infer<typeof NewMessageSocketPayloadSchema>;
export type RoomMemberJoinedSocketPayload = z.infer<typeof RoomMemberJoinedSocketPayloadSchema>;
export type RoomMemberLeftSocketPayload = z.infer<typeof RoomMemberLeftSocketPayloadSchema>;
export type ChannelMemberJoinedSocketPayload = z.infer<typeof ChannelMemberJoinedSocketPayloadSchema>;
export type ChannelMemberLeftSocketPayload = z.infer<typeof ChannelMemberLeftSocketPayloadSchema>;
export type MemberJoinedSocketPayload = z.infer<typeof MemberJoinedSocketPayloadSchema>;
export type MemberLeftSocketPayload = z.infer<typeof MemberLeftSocketPayloadSchema>;
export type RoomExpiredSocketPayload = z.infer<typeof RoomExpiredSocketPayloadSchema>;
export type ChannelStateSocketPayload = z.infer<typeof ChannelStateSocketPayloadSchema>;
export type NewChannelMessageSocketPayload = z.infer<typeof NewChannelMessageSocketPayloadSchema>;
export type DmStateSocketPayload = z.infer<typeof DmStateSocketPayloadSchema>;
export type NewDmMessageSocketPayload = z.infer<typeof NewDmMessageSocketPayloadSchema>;
export type ModerationEventSocketPayload = z.infer<typeof ModerationEventSocketPayloadSchema>;
export type SocketErrorPayload = z.infer<typeof SocketErrorPayloadSchema>;
export type ServerSocketEvent = z.infer<typeof ServerSocketEventSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;


