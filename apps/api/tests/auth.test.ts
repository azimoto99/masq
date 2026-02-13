import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CreateServerChannelResponseSchema,
  CreateServerInviteResponseSchema,
  CreateServerResponseSchema,
  ClientSocketEventSchema,
  FriendRequestsResponseSchema,
  FriendsListResponseSchema,
  GetMaskAuraResponseSchema,
  ListServerRolesResponseSchema,
  CreateMaskResponseSchema,
  CreateRoomResponseSchema,
  DmStartResponseSchema,
  DmThreadsResponseSchema,
  DmThreadResponseSchema,
  CreateRtcSessionResponseSchema,
  GetServerResponseSchema,
  ListRoomsResponseSchema,
  ServerRoleResponseSchema,
  SetServerMemberRolesResponseSchema,
  ListServersResponseSchema,
  MeResponseSchema,
  ModerateRoomResponseSchema,
  ServerSocketEventSchema,
  type RtcContextType,
  type ServerPermission,
} from '@masq/shared';
import WebSocket, { type RawData } from 'ws';
import { buildApp } from '../src/app.js';
import type {
  AddRoomMembershipInput,
  AddServerMemberInput,
  AuraEventRecord,
  CreateChannelInput,
  CreateAuraEventInput,
  CreateDmMessageInput,
  CreateMaskInput,
  CreateMessageInput,
  CreateServerRoleInput,
  CreateServerInput,
  CreateServerInviteInput,
  CreateServerMessageInput,
  CreateEntitlementInput,
  CreateUploadInput,
  CreateVoiceParticipantInput,
  CreateVoiceSessionInput,
  CreateRoomInput,
  CreateRoomModerationInput,
  CreateUserInput,
  ChannelRecord,
  ServerInviteRecord,
  ServerListItemRecord,
  ServerMemberRecord,
  ServerMessageRecord,
  ServerRoleRecord,
  ServerRecord,
  DmMessageRecord,
  DmParticipantRecord,
  DmThreadRecord,
  EntitlementRecord,
  CosmeticUnlockRecord,
  FriendRequestRecord,
  FriendUserRecord,
  IncomingFriendRequestRecord,
  MaskRecord,
  MaskAuraRecord,
  MasqRepository,
  MessageRecord,
  OutgoingFriendRequestRecord,
  RoomListItemRecord,
  RoomMembershipRecord,
  RoomModerationRecord,
  RoomRecord,
  UploadRecord,
  UpsertDmParticipantInput,
  UpsertFriendRequestInput,
  UserRecord,
  UserRtcSettingsRecord,
  VoiceParticipantRecord,
  VoiceSessionRecord,
} from '../src/domain/repository.js';
import type { Env } from '../src/env.js';

class InMemoryRepository implements MasqRepository {
  private usersById = new Map<string, UserRecord>();
  private userIdByEmail = new Map<string, string>();
  private userIdByFriendCode = new Map<string, string>();
  private masksById = new Map<string, MaskRecord>();
  private maskIdsByUser = new Map<string, string[]>();
  private roomsById = new Map<string, RoomRecord>();
  private roomMembershipByComposite = new Map<
    string,
    { roomId: string; maskId: string; role: 'HOST' | 'MEMBER'; joinedAt: Date }
  >();
  private messagesByRoom = new Map<string, MessageRecord[]>();
  private moderationsByRoom = new Map<string, RoomModerationRecord[]>();
  private serversById = new Map<string, ServerRecord>();
  private serverInvitesById = new Map<string, ServerInviteRecord>();
  private serverInviteIdByCode = new Map<string, string>();
  private serverMembersByComposite = new Map<
    string,
    {
      serverId: string;
      userId: string;
      role: 'OWNER' | 'ADMIN' | 'MEMBER';
      joinedAt: Date;
      serverMaskId: string;
    }
  >();
  private serverRolesById = new Map<string, ServerRoleRecord>();
  private serverRoleIdsByServer = new Map<string, string[]>();
  private serverRoleIdsByMember = new Map<string, string[]>();
  private channelsById = new Map<string, ChannelRecord>();
  private channelMemberIdentityMaskIdByComposite = new Map<string, string>();
  private serverMessagesByChannel = new Map<string, ServerMessageRecord[]>();
  private friendRequestsById = new Map<string, FriendRequestRecord>();
  private friendRequestIdByPair = new Map<string, string>();
  private friendshipsByPair = new Map<string, { id: string; userAId: string; userBId: string; createdAt: Date }>();
  private dmThreadsById = new Map<string, DmThreadRecord>();
  private dmThreadIdByPair = new Map<string, string>();
  private dmParticipantsByComposite = new Map<string, { threadId: string; userId: string; activeMaskId: string }>();
  private dmMessagesByThread = new Map<string, DmMessageRecord[]>();
  private uploadsById = new Map<string, UploadRecord>();
  private voiceSessionsById = new Map<string, VoiceSessionRecord>();
  private voiceParticipantsById = new Map<string, VoiceParticipantRecord>();
  private auraByMaskId = new Map<string, MaskAuraRecord>();
  private auraEventsByMaskId = new Map<string, AuraEventRecord[]>();
  private entitlementsByUser = new Map<string, EntitlementRecord[]>();
  private cosmeticUnlocksByUser = new Map<string, CosmeticUnlockRecord[]>();
  private rtcSettingsByUser = new Map<string, UserRtcSettingsRecord>();

  private compositeKey(roomId: string, maskId: string) {
    return `${roomId}:${maskId}`;
  }

  private orderedUserPair(userAId: string, userBId: string) {
    if (userAId <= userBId) {
      return {
        userAId,
        userBId,
      };
    }

    return {
      userAId: userBId,
      userBId: userAId,
    };
  }

  private directedUserPairKey(fromUserId: string, toUserId: string) {
    return `${fromUserId}:${toUserId}`;
  }

  private dmParticipantKey(threadId: string, userId: string) {
    return `${threadId}:${userId}`;
  }

  private serverMemberKey(serverId: string, userId: string) {
    return `${serverId}:${userId}`;
  }

  private channelMemberIdentityKey(channelId: string, userId: string) {
    return `${channelId}:${userId}`;
  }

  private serverPermissionsForRoleIds(roleIds: string[]): ServerPermission[] {
    const permissions = new Set<ServerPermission>();
    for (const roleId of roleIds) {
      const role = this.serverRolesById.get(roleId);
      if (!role) {
        continue;
      }
      for (const permission of role.permissions) {
        permissions.add(permission);
      }
    }
    return Array.from(permissions.values());
  }

  private resolveUpload(uploadId?: string | null): UploadRecord | null {
    if (!uploadId) {
      return null;
    }

    return this.uploadsById.get(uploadId) ?? null;
  }

  async pingDb() {
    return;
  }

  async findUserByEmail(email: string) {
    const id = this.userIdByEmail.get(email);
    return id ? this.usersById.get(id) ?? null : null;
  }

  async findUserByFriendCode(friendCode: string) {
    const id = this.userIdByFriendCode.get(friendCode);
    return id ? this.usersById.get(id) ?? null : null;
  }

  async findUserById(id: string) {
    return this.usersById.get(id) ?? null;
  }

  async updateUserDefaultMask(userId: string, defaultMaskId: string | null) {
    const user = this.usersById.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const updated: UserRecord = {
      ...user,
      defaultMaskId,
    };

    this.usersById.set(userId, updated);
    return updated;
  }

  async createUser(input: CreateUserInput) {
    if (this.userIdByEmail.has(input.email) || this.userIdByFriendCode.has(input.friendCode)) {
      const duplicate = new Error('Duplicate user');
      (duplicate as Error & { code?: string }).code = 'P2002';
      throw duplicate;
    }

    const user: UserRecord = {
      id: randomUUID(),
      email: input.email,
      friendCode: input.friendCode,
      passwordHash: input.passwordHash,
      defaultMaskId: null,
      createdAt: new Date(),
    };

    this.usersById.set(user.id, user);
    this.userIdByEmail.set(user.email, user.id);
    this.userIdByFriendCode.set(user.friendCode, user.id);
    this.maskIdsByUser.set(user.id, []);

    return user;
  }

  async listMasksByUser(userId: string) {
    const ids = this.maskIdsByUser.get(userId) ?? [];
    return ids.map((id) => this.masksById.get(id)).filter((mask): mask is MaskRecord => Boolean(mask));
  }

  async countMasksByUser(userId: string) {
    return (this.maskIdsByUser.get(userId) ?? []).length;
  }

  async createMask(input: CreateMaskInput) {
    const mask: MaskRecord = {
      id: randomUUID(),
      userId: input.userId,
      displayName: input.displayName,
      color: input.color,
      avatarSeed: input.avatarSeed,
      avatarUploadId: input.avatarUploadId ?? null,
      createdAt: new Date(),
    };

    this.masksById.set(mask.id, mask);
    const current = this.maskIdsByUser.get(mask.userId) ?? [];
    current.push(mask.id);
    this.maskIdsByUser.set(mask.userId, current);
    return mask;
  }

  async setMaskAvatarUpload(maskId: string, avatarUploadId: string | null) {
    const mask = this.masksById.get(maskId);
    if (!mask) {
      throw new Error('Mask not found');
    }

    const updated: MaskRecord = {
      ...mask,
      avatarUploadId,
    };
    this.masksById.set(maskId, updated);
    return updated;
  }

  async createServer(input: CreateServerInput) {
    const server: ServerRecord = {
      id: randomUUID(),
      name: input.name,
      ownerUserId: input.ownerUserId,
      channelIdentityMode: 'SERVER_MASK',
      stageModeEnabled: false,
      screenshareMinimumRole: 'MEMBER',
      createdAt: new Date(),
    };

    this.serversById.set(server.id, server);
    return server;
  }

  async updateServerSettings(serverId: string, settings: { channelIdentityMode: 'SERVER_MASK' | 'CHANNEL_MASK' }) {
    const server = this.serversById.get(serverId);
    if (!server) {
      throw new Error('Server not found');
    }

    const updated: ServerRecord = {
      ...server,
      channelIdentityMode: settings.channelIdentityMode,
    };
    this.serversById.set(serverId, updated);
    return updated;
  }

  async listServersForUser(userId: string): Promise<ServerListItemRecord[]> {
    const list: ServerListItemRecord[] = [];

    for (const membership of this.serverMembersByComposite.values()) {
      if (membership.userId !== userId) {
        continue;
      }

      const [server, serverMask] = [
        this.serversById.get(membership.serverId) ?? null,
        this.masksById.get(membership.serverMaskId) ?? null,
      ];
      if (!server || !serverMask) {
        continue;
      }

      list.push({
        server,
        role: membership.role,
        joinedAt: membership.joinedAt,
        serverMask,
      });
    }

    list.sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime());
    return list;
  }

  async findServerById(serverId: string) {
    return this.serversById.get(serverId) ?? null;
  }

  async findServerMember(serverId: string, userId: string) {
    const membership = this.serverMembersByComposite.get(this.serverMemberKey(serverId, userId));
    if (!membership) {
      return null;
    }

    const mask = this.masksById.get(membership.serverMaskId);
    if (!mask) {
      return null;
    }

    const roleIds = [...(this.serverRoleIdsByMember.get(this.serverMemberKey(serverId, userId)) ?? [])];
    const permissions = this.serverPermissionsForRoleIds(roleIds);

    return {
      serverId: membership.serverId,
      userId: membership.userId,
      role: membership.role,
      roleIds,
      permissions,
      joinedAt: membership.joinedAt,
      serverMaskId: membership.serverMaskId,
      serverMask: mask,
    };
  }

  async listServerMembers(serverId: string) {
    const members: ServerMemberRecord[] = [];

    for (const membership of this.serverMembersByComposite.values()) {
      if (membership.serverId !== serverId) {
        continue;
      }

      const mask = this.masksById.get(membership.serverMaskId);
      if (!mask) {
        continue;
      }

      const roleIds = [
        ...(this.serverRoleIdsByMember.get(this.serverMemberKey(membership.serverId, membership.userId)) ?? []),
      ];
      const permissions = this.serverPermissionsForRoleIds(roleIds);

      members.push({
        serverId: membership.serverId,
        userId: membership.userId,
        role: membership.role,
        roleIds,
        permissions,
        joinedAt: membership.joinedAt,
        serverMaskId: membership.serverMaskId,
        serverMask: mask,
      });
    }

    members.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
    return members;
  }

  async addServerMember(input: AddServerMemberInput) {
    const key = this.serverMemberKey(input.serverId, input.userId);
    const existing = this.serverMembersByComposite.get(key);
    if (!existing) {
      this.serverMembersByComposite.set(key, {
        serverId: input.serverId,
        userId: input.userId,
        role: input.role,
        joinedAt: new Date(),
        serverMaskId: input.serverMaskId,
      });
    } else {
      existing.role = input.role;
      existing.serverMaskId = input.serverMaskId;
      this.serverMembersByComposite.set(key, existing);
    }

    const membership = this.serverMembersByComposite.get(key);
    if (!membership) {
      throw new Error('Server membership creation failed');
    }

    const mask = this.masksById.get(membership.serverMaskId);
    if (!mask) {
      throw new Error('Mask not found for server membership');
    }

    return {
      serverId: membership.serverId,
      userId: membership.userId,
      role: membership.role,
      roleIds: [...(this.serverRoleIdsByMember.get(key) ?? [])],
      permissions: this.serverPermissionsForRoleIds(this.serverRoleIdsByMember.get(key) ?? []),
      joinedAt: membership.joinedAt,
      serverMaskId: membership.serverMaskId,
      serverMask: mask,
    };
  }

  async updateServerMemberMask(serverId: string, userId: string, serverMaskId: string) {
    const key = this.serverMemberKey(serverId, userId);
    const membership = this.serverMembersByComposite.get(key);
    if (!membership) {
      throw new Error('Server membership not found');
    }

    membership.serverMaskId = serverMaskId;
    this.serverMembersByComposite.set(key, membership);

    const mask = this.masksById.get(serverMaskId);
    if (!mask) {
      throw new Error('Mask not found');
    }

    return {
      serverId: membership.serverId,
      userId: membership.userId,
      role: membership.role,
      roleIds: [...(this.serverRoleIdsByMember.get(key) ?? [])],
      permissions: this.serverPermissionsForRoleIds(this.serverRoleIdsByMember.get(key) ?? []),
      joinedAt: membership.joinedAt,
      serverMaskId: membership.serverMaskId,
      serverMask: mask,
    };
  }

  async updateServerMemberRole(serverId: string, userId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER') {
    const key = this.serverMemberKey(serverId, userId);
    const membership = this.serverMembersByComposite.get(key);
    if (!membership) {
      throw new Error('Server membership not found');
    }

    membership.role = role;
    this.serverMembersByComposite.set(key, membership);

    const mask = this.masksById.get(membership.serverMaskId);
    if (!mask) {
      throw new Error('Mask not found for server membership');
    }

    const updatedRoleIds = [...(this.serverRoleIdsByMember.get(key) ?? [])];
    return {
      serverId: membership.serverId,
      userId: membership.userId,
      role: membership.role,
      roleIds: updatedRoleIds,
      permissions: this.serverPermissionsForRoleIds(updatedRoleIds),
      joinedAt: membership.joinedAt,
      serverMaskId: membership.serverMaskId,
      serverMask: mask,
    };
  }

  async setServerMemberRoles(serverId: string, userId: string, roleIds: string[]) {
    const key = this.serverMemberKey(serverId, userId);
    const membership = this.serverMembersByComposite.get(key);
    if (!membership) {
      throw new Error('Server membership not found');
    }

    this.serverRoleIdsByMember.set(key, [...roleIds]);
    const mask = this.masksById.get(membership.serverMaskId);
    if (!mask) {
      throw new Error('Mask not found for server membership');
    }

    const updatedRoleIds = [...(this.serverRoleIdsByMember.get(key) ?? [])];
    return {
      serverId: membership.serverId,
      userId: membership.userId,
      role: membership.role,
      roleIds: updatedRoleIds,
      permissions: this.serverPermissionsForRoleIds(updatedRoleIds),
      joinedAt: membership.joinedAt,
      serverMaskId: membership.serverMaskId,
      serverMask: mask,
    };
  }

  async removeServerMember(serverId: string, userId: string) {
    const key = this.serverMemberKey(serverId, userId);
    this.serverRoleIdsByMember.delete(key);
    for (const identityKey of Array.from(this.channelMemberIdentityMaskIdByComposite.keys())) {
      if (identityKey.endsWith(`:${userId}`)) {
        const [channelId] = identityKey.split(':');
        const channel = this.channelsById.get(channelId);
        if (channel && channel.serverId === serverId) {
          this.channelMemberIdentityMaskIdByComposite.delete(identityKey);
        }
      }
    }
    return this.serverMembersByComposite.delete(key);
  }

  async createServerRole(input: CreateServerRoleInput) {
    const existing = Array.from(this.serverRolesById.values()).find(
      (role) => role.serverId === input.serverId && role.name.toLowerCase() === input.name.toLowerCase(),
    );
    if (existing) {
      const duplicate = new Error('Role name already exists');
      (duplicate as Error & { code?: string }).code = 'P2002';
      throw duplicate;
    }

    const role: ServerRoleRecord = {
      id: randomUUID(),
      serverId: input.serverId,
      name: input.name,
      permissions: [...new Set(input.permissions)],
      createdAt: new Date(),
    };

    this.serverRolesById.set(role.id, role);
    const serverRoleIds = this.serverRoleIdsByServer.get(input.serverId) ?? [];
    serverRoleIds.push(role.id);
    this.serverRoleIdsByServer.set(input.serverId, serverRoleIds);
    return role;
  }

  async updateServerRole(
    serverId: string,
    roleId: string,
    updates: { name?: string; permissions?: ServerPermission[] },
  ) {
    const role = this.serverRolesById.get(roleId);
    if (!role || role.serverId !== serverId) {
      throw new Error('Server role not found');
    }

    if (updates.name !== undefined) {
      const duplicate = Array.from(this.serverRolesById.values()).find(
        (candidate) =>
          candidate.id !== roleId &&
          candidate.serverId === serverId &&
          candidate.name.toLowerCase() === updates.name?.toLowerCase(),
      );
      if (duplicate) {
        const duplicateError = new Error('Role name already exists');
        (duplicateError as Error & { code?: string }).code = 'P2002';
        throw duplicateError;
      }
    }

    const updated: ServerRoleRecord = {
      ...role,
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.permissions !== undefined ? { permissions: [...new Set(updates.permissions)] } : {}),
    };
    this.serverRolesById.set(roleId, updated);
    return updated;
  }

  async findServerRoleByName(serverId: string, name: string) {
    return (
      Array.from(this.serverRolesById.values()).find(
        (role) => role.serverId === serverId && role.name.toLowerCase() === name.toLowerCase(),
      ) ?? null
    );
  }

  async findServerRoleById(serverId: string, roleId: string) {
    const role = this.serverRolesById.get(roleId);
    if (!role || role.serverId !== serverId) {
      return null;
    }

    return role;
  }

  async listServerRoles(serverId: string) {
    return Array.from(this.serverRolesById.values())
      .filter((role) => role.serverId === serverId)
      .sort((a, b) => a.name.localeCompare(b.name) || a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createServerInvite(input: CreateServerInviteInput) {
    if (this.serverInviteIdByCode.has(input.code)) {
      const duplicate = new Error('Invite code already exists');
      (duplicate as Error & { code?: string }).code = 'P2002';
      throw duplicate;
    }

    const invite: ServerInviteRecord = {
      id: randomUUID(),
      serverId: input.serverId,
      code: input.code,
      createdAt: new Date(),
      expiresAt: input.expiresAt,
      maxUses: input.maxUses,
      uses: 0,
    };

    this.serverInvitesById.set(invite.id, invite);
    this.serverInviteIdByCode.set(invite.code, invite.id);
    return invite;
  }

  async findServerInviteByCode(code: string) {
    const inviteId = this.serverInviteIdByCode.get(code);
    if (!inviteId) {
      return null;
    }

    return this.serverInvitesById.get(inviteId) ?? null;
  }

  async incrementServerInviteUses(inviteId: string) {
    const invite = this.serverInvitesById.get(inviteId);
    if (!invite) {
      throw new Error('Invite not found');
    }

    const updated: ServerInviteRecord = {
      ...invite,
      uses: invite.uses + 1,
    };
    this.serverInvitesById.set(inviteId, updated);
    return updated;
  }

  async createServerChannel(input: CreateChannelInput) {
    const duplicate = Array.from(this.channelsById.values()).find(
      (channel) => channel.serverId === input.serverId && channel.name === input.name,
    );
    if (duplicate) {
      const error = new Error('Channel name already exists');
      (error as Error & { code?: string }).code = 'P2002';
      throw error;
    }

    const channel: ChannelRecord = {
      id: randomUUID(),
      serverId: input.serverId,
      name: input.name,
      type: input.type,
      createdAt: new Date(),
    };
    this.channelsById.set(channel.id, channel);
    return channel;
  }

  async deleteServerChannel(serverId: string, channelId: string) {
    const channel = this.channelsById.get(channelId);
    if (!channel || channel.serverId !== serverId) {
      return false;
    }

    this.channelsById.delete(channelId);
    this.serverMessagesByChannel.delete(channelId);
    for (const identityKey of Array.from(this.channelMemberIdentityMaskIdByComposite.keys())) {
      if (identityKey.startsWith(`${channelId}:`)) {
        this.channelMemberIdentityMaskIdByComposite.delete(identityKey);
      }
    }
    return true;
  }

  async findChannelById(channelId: string) {
    return this.channelsById.get(channelId) ?? null;
  }

  async findChannelMemberIdentity(channelId: string, userId: string) {
    const maskId = this.channelMemberIdentityMaskIdByComposite.get(
      this.channelMemberIdentityKey(channelId, userId),
    );
    if (!maskId) {
      return null;
    }

    const mask = this.masksById.get(maskId);
    if (!mask) {
      return null;
    }

    return {
      channelId,
      userId,
      maskId,
      mask,
    };
  }

  async upsertChannelMemberIdentity(channelId: string, userId: string, maskId: string) {
    const mask = this.masksById.get(maskId);
    if (!mask) {
      throw new Error('Mask not found');
    }

    this.channelMemberIdentityMaskIdByComposite.set(
      this.channelMemberIdentityKey(channelId, userId),
      maskId,
    );

    return {
      channelId,
      userId,
      maskId,
      mask,
    };
  }

  async listServerChannels(serverId: string) {
    return Array.from(this.channelsById.values())
      .filter((channel) => channel.serverId === serverId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async listServerMessages(channelId: string) {
    return [...(this.serverMessagesByChannel.get(channelId) ?? [])];
  }

  async createServerMessage(input: CreateServerMessageInput) {
    const mask = this.masksById.get(input.maskId);
    if (!mask) {
      throw new Error('Mask missing');
    }

    const message: ServerMessageRecord = {
      id: randomUUID(),
      channelId: input.channelId,
      maskId: input.maskId,
      body: input.body,
      imageUpload: this.resolveUpload(input.imageUploadId),
      createdAt: new Date(),
      mask,
    };
    const current = this.serverMessagesByChannel.get(input.channelId) ?? [];
    current.push(message);
    this.serverMessagesByChannel.set(input.channelId, current);
    return message;
  }

  async createUpload(input: CreateUploadInput) {
    const upload: UploadRecord = {
      id: randomUUID(),
      ownerUserId: input.ownerUserId,
      kind: input.kind,
      contextType: input.contextType,
      contextId: input.contextId,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      storagePath: input.storagePath,
      createdAt: new Date(),
    };
    this.uploadsById.set(upload.id, upload);
    return upload;
  }

  async findUploadById(uploadId: string) {
    return this.uploadsById.get(uploadId) ?? null;
  }

  async findMaskByIdForUser(maskId: string, userId: string) {
    const mask = this.masksById.get(maskId);
    if (!mask || mask.userId !== userId) {
      return null;
    }

    return mask;
  }

  async maskHasActiveRoomMembership(maskId: string, now: Date) {
    for (const membership of this.roomMembershipByComposite.values()) {
      if (membership.maskId !== maskId) {
        continue;
      }

      const room = this.roomsById.get(membership.roomId);
      if (!room) {
        continue;
      }

      if (!room.expiresAt || room.expiresAt.getTime() > now.getTime()) {
        return true;
      }
    }

    return false;
  }

  async deleteMask(maskId: string) {
    const mask = this.masksById.get(maskId);
    if (!mask) {
      return;
    }

    this.masksById.delete(maskId);
    const current = this.maskIdsByUser.get(mask.userId) ?? [];
    this.maskIdsByUser.set(
      mask.userId,
      current.filter((id) => id !== maskId),
    );

    for (const key of Array.from(this.roomMembershipByComposite.keys())) {
      if (key.endsWith(`:${maskId}`)) {
        this.roomMembershipByComposite.delete(key);
      }
    }
  }

  async listRoomsForMask(maskId: string, now: Date): Promise<RoomListItemRecord[]> {
    const list: RoomListItemRecord[] = [];

    for (const membership of this.roomMembershipByComposite.values()) {
      if (membership.maskId !== maskId) {
        continue;
      }

      const room = this.roomsById.get(membership.roomId);
      if (!room) {
        continue;
      }

      if (room.expiresAt && room.expiresAt.getTime() <= now.getTime()) {
        continue;
      }

      list.push({
        room,
        role: membership.role,
        joinedAt: membership.joinedAt,
      });
    }

    list.sort((a, b) => b.room.createdAt.getTime() - a.room.createdAt.getTime());
    return list;
  }

  async createRoom(input: CreateRoomInput): Promise<RoomRecord> {
    const room: RoomRecord = {
      id: randomUUID(),
      title: input.title,
      kind: input.kind,
      locked: input.locked,
      fogLevel: input.fogLevel,
      messageDecayMinutes: input.messageDecayMinutes,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
    };

    this.roomsById.set(room.id, room);
    return room;
  }

  async addRoomMembership(input: AddRoomMembershipInput): Promise<RoomMembershipRecord> {
    const key = this.compositeKey(input.roomId, input.maskId);
    const existing = this.roomMembershipByComposite.get(key);

    if (!existing) {
      this.roomMembershipByComposite.set(key, {
        roomId: input.roomId,
        maskId: input.maskId,
        role: input.role,
        joinedAt: new Date(),
      });
    }

    const membership = this.roomMembershipByComposite.get(key);
    if (!membership) {
      throw new Error('Membership creation failed');
    }

    const mask = this.masksById.get(input.maskId);
    if (!mask) {
      throw new Error('Mask not found for membership');
    }

    return {
      roomId: membership.roomId,
      maskId: membership.maskId,
      role: membership.role,
      joinedAt: membership.joinedAt,
      mask,
    };
  }

  async removeRoomMembership(roomId: string, maskId: string) {
    this.roomMembershipByComposite.delete(this.compositeKey(roomId, maskId));
  }

  async findRoomById(roomId: string) {
    return this.roomsById.get(roomId) ?? null;
  }

  async setRoomLocked(roomId: string, locked: boolean) {
    const room = this.roomsById.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const updated: RoomRecord = {
      ...room,
      locked,
    };

    this.roomsById.set(roomId, updated);
    return updated;
  }

  async findRoomMembershipWithMask(roomId: string, maskId: string) {
    const membership = this.roomMembershipByComposite.get(this.compositeKey(roomId, maskId));
    if (!membership) {
      return null;
    }

    const mask = this.masksById.get(maskId);
    if (!mask) {
      return null;
    }

    return {
      roomId: membership.roomId,
      maskId: membership.maskId,
      role: membership.role,
      joinedAt: membership.joinedAt,
      mask,
    };
  }

  async listRoomMessages(roomId: string) {
    return [...(this.messagesByRoom.get(roomId) ?? [])];
  }

  async createMessage(input: CreateMessageInput) {
    const mask = this.masksById.get(input.maskId);
    if (!mask) {
      throw new Error('Mask missing');
    }

    const message: MessageRecord = {
      id: randomUUID(),
      roomId: input.roomId,
      maskId: input.maskId,
      body: input.body,
      imageUpload: this.resolveUpload(input.imageUploadId),
      createdAt: new Date(),
      mask,
    };

    const current = this.messagesByRoom.get(input.roomId) ?? [];
    current.push(message);
    this.messagesByRoom.set(input.roomId, current);
    return message;
  }

  async createRoomModeration(input: CreateRoomModerationInput) {
    const moderation: RoomModerationRecord = {
      id: randomUUID(),
      roomId: input.roomId,
      targetMaskId: input.targetMaskId,
      actionType: input.actionType,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
      actorMaskId: input.actorMaskId,
    };

    const current = this.moderationsByRoom.get(input.roomId) ?? [];
    current.push(moderation);
    this.moderationsByRoom.set(input.roomId, current);

    return moderation;
  }

  async findActiveMute(roomId: string, targetMaskId: string, now: Date) {
    const current = this.moderationsByRoom.get(roomId) ?? [];
    const matches = current
      .filter(
        (moderation) =>
          moderation.actionType === 'MUTE' &&
          moderation.targetMaskId === targetMaskId &&
          moderation.expiresAt !== null &&
          moderation.expiresAt.getTime() > now.getTime(),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return matches[0] ?? null;
  }

  private serializeFriendUser(userId: string): FriendUserRecord | null {
    const user = this.usersById.get(userId);
    if (!user) {
      return null;
    }

    const defaultMask = user.defaultMaskId ? this.masksById.get(user.defaultMaskId) ?? null : null;
    return {
      id: user.id,
      email: user.email,
      friendCode: user.friendCode,
      defaultMask: defaultMask
        ? {
            id: defaultMask.id,
            displayName: defaultMask.displayName,
            color: defaultMask.color,
            avatarSeed: defaultMask.avatarSeed,
            avatarUploadId: defaultMask.avatarUploadId,
          }
        : null,
    };
  }

  async findFriendRequestById(id: string) {
    return this.friendRequestsById.get(id) ?? null;
  }

  async findFriendRequestBetweenUsers(userAId: string, userBId: string) {
    const matches = Array.from(this.friendRequestsById.values())
      .filter(
        (request) =>
          (request.fromUserId === userAId && request.toUserId === userBId) ||
          (request.fromUserId === userBId && request.toUserId === userAId),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return matches[0] ?? null;
  }

  async upsertFriendRequest(input: UpsertFriendRequestInput) {
    const pairKey = this.directedUserPairKey(input.fromUserId, input.toUserId);
    const existingId = this.friendRequestIdByPair.get(pairKey);
    const now = new Date();
    if (existingId) {
      const existing = this.friendRequestsById.get(existingId);
      if (!existing) {
        throw new Error('Friend request missing');
      }

      const updated: FriendRequestRecord = {
        ...existing,
        status: input.status,
        updatedAt: now,
      };

      this.friendRequestsById.set(existing.id, updated);
      return updated;
    }

    const created: FriendRequestRecord = {
      id: randomUUID(),
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      status: input.status,
      createdAt: now,
      updatedAt: now,
    };

    this.friendRequestsById.set(created.id, created);
    this.friendRequestIdByPair.set(pairKey, created.id);
    return created;
  }

  async updateFriendRequestStatus(id: string, status: FriendRequestRecord['status']) {
    const existing = this.friendRequestsById.get(id);
    if (!existing) {
      throw new Error('Friend request not found');
    }

    const updated: FriendRequestRecord = {
      ...existing,
      status,
      updatedAt: new Date(),
    };

    this.friendRequestsById.set(id, updated);
    return updated;
  }

  async findFriendshipBetweenUsers(userAId: string, userBId: string) {
    const pair = this.orderedUserPair(userAId, userBId);
    const key = this.directedUserPairKey(pair.userAId, pair.userBId);
    const friendship = this.friendshipsByPair.get(key);
    return friendship ? { id: friendship.id } : null;
  }

  async createFriendship(userAId: string, userBId: string) {
    const pair = this.orderedUserPair(userAId, userBId);
    const key = this.directedUserPairKey(pair.userAId, pair.userBId);
    const existing = this.friendshipsByPair.get(key);
    if (existing) {
      return existing;
    }

    const created = {
      id: randomUUID(),
      userAId: pair.userAId,
      userBId: pair.userBId,
      createdAt: new Date(),
    };
    this.friendshipsByPair.set(key, created);
    return created;
  }

  async deleteFriendshipBetweenUsers(userAId: string, userBId: string) {
    const pair = this.orderedUserPair(userAId, userBId);
    const key = this.directedUserPairKey(pair.userAId, pair.userBId);
    return this.friendshipsByPair.delete(key);
  }

  async listFriendsForUser(userId: string) {
    const friends: FriendUserRecord[] = [];
    for (const friendship of this.friendshipsByPair.values()) {
      if (friendship.userAId !== userId && friendship.userBId !== userId) {
        continue;
      }

      const friendUserId = friendship.userAId === userId ? friendship.userBId : friendship.userAId;
      const friend = this.serializeFriendUser(friendUserId);
      if (friend) {
        friends.push(friend);
      }
    }

    return friends;
  }

  async listIncomingFriendRequests(userId: string) {
    const requests: IncomingFriendRequestRecord[] = [];
    for (const request of this.friendRequestsById.values()) {
      if (request.toUserId !== userId || request.status !== 'PENDING') {
        continue;
      }

      const fromUser = this.serializeFriendUser(request.fromUserId);
      if (!fromUser) {
        continue;
      }

      requests.push({
        request,
        fromUser,
      });
    }

    requests.sort((a, b) => b.request.createdAt.getTime() - a.request.createdAt.getTime());
    return requests;
  }

  async listOutgoingFriendRequests(userId: string) {
    const requests: OutgoingFriendRequestRecord[] = [];
    for (const request of this.friendRequestsById.values()) {
      if (request.fromUserId !== userId || request.status !== 'PENDING') {
        continue;
      }

      const toUser = this.serializeFriendUser(request.toUserId);
      if (!toUser) {
        continue;
      }

      requests.push({
        request,
        toUser,
      });
    }

    requests.sort((a, b) => b.request.createdAt.getTime() - a.request.createdAt.getTime());
    return requests;
  }

  async findDmThreadById(threadId: string) {
    return this.dmThreadsById.get(threadId) ?? null;
  }

  async findDmThreadBetweenUsers(userAId: string, userBId: string) {
    const pair = this.orderedUserPair(userAId, userBId);
    const key = this.directedUserPairKey(pair.userAId, pair.userBId);
    const threadId = this.dmThreadIdByPair.get(key);
    if (!threadId) {
      return null;
    }

    return this.dmThreadsById.get(threadId) ?? null;
  }

  async createDmThread(userAId: string, userBId: string) {
    const pair = this.orderedUserPair(userAId, userBId);
    const key = this.directedUserPairKey(pair.userAId, pair.userBId);
    const existingId = this.dmThreadIdByPair.get(key);
    if (existingId) {
      const existing = this.dmThreadsById.get(existingId);
      if (existing) {
        return existing;
      }
    }

    const created: DmThreadRecord = {
      id: randomUUID(),
      userAId: pair.userAId,
      userBId: pair.userBId,
      createdAt: new Date(),
    };
    this.dmThreadsById.set(created.id, created);
    this.dmThreadIdByPair.set(key, created.id);
    return created;
  }

  async listDmThreadsForUser(userId: string) {
    return Array.from(this.dmThreadsById.values())
      .filter((thread) => thread.userAId === userId || thread.userBId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async upsertDmParticipant(input: UpsertDmParticipantInput): Promise<DmParticipantRecord> {
    const mask = this.masksById.get(input.activeMaskId);
    if (!mask) {
      throw new Error('Mask not found');
    }

    const key = this.dmParticipantKey(input.threadId, input.userId);
    this.dmParticipantsByComposite.set(key, {
      threadId: input.threadId,
      userId: input.userId,
      activeMaskId: input.activeMaskId,
    });

    return {
      threadId: input.threadId,
      userId: input.userId,
      activeMaskId: input.activeMaskId,
      activeMask: mask,
    };
  }

  async findDmParticipant(threadId: string, userId: string) {
    const value = this.dmParticipantsByComposite.get(this.dmParticipantKey(threadId, userId));
    if (!value) {
      return null;
    }

    const mask = this.masksById.get(value.activeMaskId);
    if (!mask) {
      return null;
    }

    return {
      threadId: value.threadId,
      userId: value.userId,
      activeMaskId: value.activeMaskId,
      activeMask: mask,
    };
  }

  async listDmParticipants(threadId: string) {
    const participants: DmParticipantRecord[] = [];
    for (const participant of this.dmParticipantsByComposite.values()) {
      if (participant.threadId !== threadId) {
        continue;
      }

      const mask = this.masksById.get(participant.activeMaskId);
      if (!mask) {
        continue;
      }

      participants.push({
        threadId: participant.threadId,
        userId: participant.userId,
        activeMaskId: participant.activeMaskId,
        activeMask: mask,
      });
    }

    participants.sort((a, b) => a.userId.localeCompare(b.userId));
    return participants;
  }

  async listDmMessages(threadId: string) {
    return [...(this.dmMessagesByThread.get(threadId) ?? [])];
  }

  async createDmMessage(input: CreateDmMessageInput) {
    const mask = this.masksById.get(input.maskId);
    if (!mask) {
      throw new Error('Mask missing');
    }

    const message: DmMessageRecord = {
      id: randomUUID(),
      threadId: input.threadId,
      maskId: input.maskId,
      body: input.body,
      imageUpload: this.resolveUpload(input.imageUploadId),
      createdAt: new Date(),
      mask,
    };

    const current = this.dmMessagesByThread.get(input.threadId) ?? [];
    current.push(message);
    this.dmMessagesByThread.set(input.threadId, current);
    return message;
  }

  async findVoiceSessionById(voiceSessionId: string) {
    return this.voiceSessionsById.get(voiceSessionId) ?? null;
  }

  async findActiveVoiceSessionByContext(contextType: RtcContextType, contextId: string) {
    const matches = Array.from(this.voiceSessionsById.values())
      .filter((session) => session.contextType === contextType && session.contextId === contextId && session.endedAt === null)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return matches[0] ?? null;
  }

  async createVoiceSession(input: CreateVoiceSessionInput) {
    const session: VoiceSessionRecord = {
      id: randomUUID(),
      contextType: input.contextType,
      contextId: input.contextId,
      livekitRoomName: input.livekitRoomName,
      createdAt: new Date(),
      endedAt: null,
    };

    this.voiceSessionsById.set(session.id, session);
    return session;
  }

  async endVoiceSession(voiceSessionId: string, endedAt: Date) {
    const session = this.voiceSessionsById.get(voiceSessionId);
    if (!session) {
      throw new Error('Voice session not found');
    }

    const updated: VoiceSessionRecord = {
      ...session,
      endedAt,
    };

    this.voiceSessionsById.set(voiceSessionId, updated);
    return updated;
  }

  async createVoiceParticipant(input: CreateVoiceParticipantInput) {
    const mask = this.masksById.get(input.maskId);
    if (!mask) {
      throw new Error('Mask missing');
    }

    const participant: VoiceParticipantRecord = {
      id: randomUUID(),
      voiceSessionId: input.voiceSessionId,
      userId: input.userId,
      maskId: input.maskId,
      joinedAt: new Date(),
      leftAt: null,
      isServerMuted: input.isServerMuted ?? false,
      mask,
    };

    this.voiceParticipantsById.set(participant.id, participant);
    return participant;
  }

  async listActiveVoiceParticipants(voiceSessionId: string) {
    return Array.from(this.voiceParticipantsById.values())
      .filter((participant) => participant.voiceSessionId === voiceSessionId && participant.leftAt === null)
      .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
  }

  async markVoiceParticipantsLeft(voiceSessionId: string, userId: string, leftAt: Date) {
    let count = 0;
    for (const [participantId, participant] of this.voiceParticipantsById.entries()) {
      if (participant.voiceSessionId !== voiceSessionId || participant.userId !== userId || participant.leftAt !== null) {
        continue;
      }

      this.voiceParticipantsById.set(participantId, {
        ...participant,
        leftAt,
      });
      count += 1;
    }

    return count;
  }

  async setVoiceParticipantsMuted(voiceSessionId: string, targetMaskId: string, isServerMuted: boolean) {
    let count = 0;
    for (const [participantId, participant] of this.voiceParticipantsById.entries()) {
      if (
        participant.voiceSessionId !== voiceSessionId ||
        participant.maskId !== targetMaskId ||
        participant.leftAt !== null
      ) {
        continue;
      }

      this.voiceParticipantsById.set(participantId, {
        ...participant,
        isServerMuted,
      });
      count += 1;
    }

    return count;
  }

  async findMaskAuraByMaskId(maskId: string) {
    return this.auraByMaskId.get(maskId) ?? null;
  }

  async upsertMaskAura(maskId: string) {
    const existing = this.auraByMaskId.get(maskId);
    if (existing) {
      return existing;
    }

    const now = new Date();
    const aura: MaskAuraRecord = {
      id: randomUUID(),
      maskId,
      score: 0,
      tier: 'DORMANT',
      color: 'Gray',
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.auraByMaskId.set(maskId, aura);
    return aura;
  }

  async updateMaskAura(
    maskId: string,
    updates: {
      score?: number;
      tier?: MaskAuraRecord['tier'];
      color?: string;
      lastActivityAt?: Date;
    },
  ) {
    const current = this.auraByMaskId.get(maskId) ?? (await this.upsertMaskAura(maskId));
    const next: MaskAuraRecord = {
      ...current,
      ...updates,
      updatedAt: new Date(),
    };
    this.auraByMaskId.set(maskId, next);
    return next;
  }

  async listAuraEventsByMask(maskId: string, options?: { limit?: number; kind?: CreateAuraEventInput['kind']; since?: Date }) {
    const events = [...(this.auraEventsByMaskId.get(maskId) ?? [])];
    const filtered = events
      .filter((event) => (options?.kind ? event.kind === options.kind : true))
      .filter((event) => (options?.since ? event.createdAt.getTime() >= options.since.getTime() : true))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (options?.limit !== undefined) {
      return filtered.slice(0, options.limit);
    }
    return filtered;
  }

  async countAuraEventsByMaskKindSince(maskId: string, kind: CreateAuraEventInput['kind'], since: Date) {
    const events = this.auraEventsByMaskId.get(maskId) ?? [];
    return events.filter((event) => event.kind === kind && event.createdAt.getTime() >= since.getTime()).length;
  }

  async createAuraEvent(input: CreateAuraEventInput) {
    const event: AuraEventRecord = {
      id: randomUUID(),
      maskId: input.maskId,
      kind: input.kind,
      weight: input.weight,
      meta: input.meta ?? null,
      createdAt: new Date(),
    };
    const current = this.auraEventsByMaskId.get(input.maskId) ?? [];
    current.push(event);
    this.auraEventsByMaskId.set(input.maskId, current);
    return event;
  }

  async listEntitlementsByUser(userId: string) {
    return [...(this.entitlementsByUser.get(userId) ?? [])].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async createEntitlement(input: CreateEntitlementInput) {
    const entitlement: EntitlementRecord = {
      id: randomUUID(),
      userId: input.userId,
      kind: input.kind,
      source: input.source,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
    };

    const current = this.entitlementsByUser.get(input.userId) ?? [];
    current.push(entitlement);
    this.entitlementsByUser.set(input.userId, current);
    return entitlement;
  }

  async listCosmeticUnlocksByUser(userId: string) {
    return [...(this.cosmeticUnlocksByUser.get(userId) ?? [])].sort(
      (a, b) => b.unlockedAt.getTime() - a.unlockedAt.getTime(),
    );
  }

  async findUserRtcSettings(userId: string) {
    return this.rtcSettingsByUser.get(userId) ?? null;
  }

  async upsertUserRtcSettings(userId: string, updates: Partial<Omit<UserRtcSettingsRecord, 'userId' | 'createdAt' | 'updatedAt'>>) {
    const now = new Date();
    const existing = this.rtcSettingsByUser.get(userId);
    const base: UserRtcSettingsRecord =
      existing ?? {
        userId,
        advancedNoiseSuppression: false,
        pushToTalkMode: 'HOLD',
        pushToTalkHotkey: 'V',
        multiPinEnabled: false,
        pictureInPictureEnabled: false,
        defaultScreenshareFps: 30,
        defaultScreenshareQuality: 'balanced',
        cursorHighlight: true,
        selectedAuraStyle: 'AURA_STYLE_BASE',
        createdAt: now,
        updatedAt: now,
      };

    const next: UserRtcSettingsRecord = {
      ...base,
      ...updates,
      updatedAt: now,
    };

    this.rtcSettingsByUser.set(userId, next);
    return next;
  }

  setMaskActive(maskId: string, active: boolean) {
    if (active) {
      const room: RoomRecord = {
        id: randomUUID(),
        title: 'Active Room',
        kind: 'EPHEMERAL',
        locked: false,
        fogLevel: 0,
        messageDecayMinutes: 8,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        createdAt: new Date(),
      };

      this.roomsById.set(room.id, room);
      this.roomMembershipByComposite.set(this.compositeKey(room.id, maskId), {
        roomId: room.id,
        maskId,
        role: 'MEMBER',
        joinedAt: new Date(),
      });
      return;
    }

    for (const [key, membership] of Array.from(this.roomMembershipByComposite.entries())) {
      if (membership.maskId === maskId) {
        this.roomMembershipByComposite.delete(key);
      }
    }
  }
}

const toCookieHeader = (setCookieHeader: string | string[] | undefined): string => {
  if (!setCookieHeader) {
    throw new Error('Missing set-cookie header');
  }

  const firstCookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  return firstCookie.split(';')[0];
};

const registerUser = async (app: FastifyInstance, email: string) => {
  const registerResponse = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email,
      password: 'password123',
    },
  });

  expect(registerResponse.statusCode).toBe(201);
  return toCookieHeader(registerResponse.headers['set-cookie']);
};

const createMask = async (app: FastifyInstance, cookie: string, displayName: string) => {
  const createResponse = await app.inject({
    method: 'POST',
    url: '/masks',
    headers: { cookie },
    payload: {
      displayName,
    },
  });

  expect(createResponse.statusCode).toBe(201);
  return CreateMaskResponseSchema.parse(createResponse.json()).mask;
};

const createTestEnv = (overrides: Partial<Env> = {}): Env => ({
  NODE_ENV: 'test',
  PORT: 4100,
  DATABASE_URL: 'postgresql://unused',
  REDIS_URL: 'redis://unused',
  WEB_ORIGIN: 'http://localhost:5173',
  CORS_ORIGINS: ['http://localhost:5173'],
  CORS_ALLOW_NO_ORIGIN: true,
  JWT_SECRET: 'masq-test-secret-with-32-characters!',
  AUTH_COOKIE_NAME: 'masq_token',
  ACCESS_TOKEN_TTL_SECONDS: 3600,
  COOKIE_SECURE: false,
  COOKIE_SAME_SITE: 'lax',
  COOKIE_DOMAIN: undefined,
  API_RATE_LIMIT_MAX: 120,
  API_RATE_LIMIT_WINDOW_MS: 60_000,
  LIVEKIT_URL: 'https://example.livekit.test',
  LIVEKIT_API_KEY: 'test-api-key',
  LIVEKIT_API_SECRET: 'test-api-secret',
  TRUST_PROXY: false,
  LOG_LEVEL: 'error',
  ...overrides,
});

describe('auth and mask flows', () => {
  let app: FastifyInstance;
  let repository: InMemoryRepository;

  beforeEach(async () => {
    repository = new InMemoryRepository();
    const env = createTestEnv();

    app = await buildApp({
      env,
      repo: repository,
      redis: {
        ping: async () => 'PONG',
        quit: async () => 'OK',
      },
      logger: false,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('registers a user, sets auth cookie, and returns /me', async () => {
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'USER@EXAMPLE.COM',
        password: 'password123',
      },
    });

    expect(registerResponse.statusCode).toBe(201);
    const cookie = toCookieHeader(registerResponse.headers['set-cookie']);

    const meResponse = await app.inject({
      method: 'GET',
      url: '/me',
      headers: {
        cookie,
      },
    });

    expect(meResponse.statusCode).toBe(200);
    const mePayload = MeResponseSchema.parse(meResponse.json());
    expect(mePayload.user.email).toBe('user@example.com');
    expect(mePayload.masks).toHaveLength(0);
  });

  it('rejects invalid login credentials', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'test@example.com',
        password: 'password123',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'wrong-password',
      },
    });

    expect(loginResponse.statusCode).toBe(401);
  });

  it('logs in an existing user and issues a cookie', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'login-success@example.com',
        password: 'password123',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'login-success@example.com',
        password: 'password123',
      },
    });

    expect(loginResponse.statusCode).toBe(200);
    const cookie = toCookieHeader(loginResponse.headers['set-cookie']);

    const meResponse = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie },
    });

    expect(meResponse.statusCode).toBe(200);
  });

  it('requires authentication for logout and clears cookie for authenticated user', async () => {
    const anonymousLogout = await app.inject({
      method: 'POST',
      url: '/auth/logout',
    });
    expect(anonymousLogout.statusCode).toBe(401);

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'logout-auth@example.com',
        password: 'password123',
      },
    });
    expect(registerResponse.statusCode).toBe(201);

    const cookie = toCookieHeader(registerResponse.headers['set-cookie']);
    const authenticatedLogout = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { cookie },
    });

    expect(authenticatedLogout.statusCode).toBe(200);
    const logoutSetCookie = authenticatedLogout.headers['set-cookie'];
    const serializedLogoutCookie = Array.isArray(logoutSetCookie)
      ? logoutSetCookie.join(';')
      : logoutSetCookie ?? '';
    expect(serializedLogoutCookie).toContain('masq_token=');
    expect(serializedLogoutCookie).toMatch(/Expires=Thu, 01 Jan 1970 00:00:00 GMT|Max-Age=0/);
  });

  it('applies API request rate limiting', async () => {
    const limitedApp = await buildApp({
      env: createTestEnv({
        API_RATE_LIMIT_MAX: 2,
        API_RATE_LIMIT_WINDOW_MS: 60_000,
      }),
      repo: repository,
      redis: {
        ping: async () => 'PONG',
        quit: async () => 'OK',
      },
      logger: false,
    });

    try {
      const first = await limitedApp.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'nobody@example.com',
          password: 'password123',
        },
      });

      const second = await limitedApp.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'nobody@example.com',
          password: 'password123',
        },
      });

      const third = await limitedApp.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'nobody@example.com',
          password: 'password123',
        },
      });

      expect(first.statusCode).toBe(401);
      expect(second.statusCode).toBe(401);
      expect(third.statusCode).toBe(429);
      expect(third.json()).toMatchObject({
        message: 'Rate limit exceeded',
      });
    } finally {
      await limitedApp.close();
    }
  });

  it('enforces max 3 masks per user', async () => {
    const cookie = await registerUser(app, 'mask-limit@example.com');

    for (let i = 0; i < 3; i += 1) {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/masks',
        headers: { cookie },
        payload: {
          displayName: `Mask ${i + 1}`,
        },
      });

      expect(createResponse.statusCode).toBe(201);
    }

    const overflowResponse = await app.inject({
      method: 'POST',
      url: '/masks',
      headers: { cookie },
      payload: {
        displayName: 'Mask 4',
      },
    });

    expect(overflowResponse.statusCode).toBe(400);
  });

  it('blocks mask deletion while mask is in an active room', async () => {
    const cookie = await registerUser(app, 'delete-check@example.com');
    const mask = await createMask(app, cookie, 'Ghost');

    repository.setMaskActive(mask.id, true);

    const blockedDeleteResponse = await app.inject({
      method: 'DELETE',
      url: `/masks/${mask.id}`,
      headers: { cookie },
    });

    expect(blockedDeleteResponse.statusCode).toBe(409);
  });

  it('creates and lists room membership for the selected mask', async () => {
    const cookie = await registerUser(app, 'room-flow@example.com');
    const hostMask = await createMask(app, cookie, 'Host');
    const memberMask = await createMask(app, cookie, 'Witness');

    const createRoomResponse = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: { cookie },
      payload: {
        maskId: hostMask.id,
        title: 'Test Chamber',
        kind: 'EPHEMERAL',
      },
    });

    const createdRoom = CreateRoomResponseSchema.parse(createRoomResponse.json()).room;
    expect(createRoomResponse.statusCode).toBe(201);

    const joinRoomResponse = await app.inject({
      method: 'POST',
      url: `/rooms/${createdRoom.id}/join`,
      headers: { cookie },
      payload: {
        maskId: memberMask.id,
      },
    });

    expect(joinRoomResponse.statusCode).toBe(200);

    const listRoomsResponse = await app.inject({
      method: 'GET',
      url: `/rooms?maskId=${memberMask.id}`,
      headers: { cookie },
    });

    expect(listRoomsResponse.statusCode).toBe(200);
    const listed = ListRoomsResponseSchema.parse(listRoomsResponse.json());
    expect(listed.rooms.some((room) => room.id === createdRoom.id)).toBe(true);
  });

  it('enforces moderation permissions and room lock/exile behavior', async () => {
    const hostCookie = await registerUser(app, 'host@example.com');
    const memberCookie = await registerUser(app, 'member@example.com');

    const hostMask = await createMask(app, hostCookie, 'Host Mask');
    const memberMask = await createMask(app, memberCookie, 'Member Mask');
    const alternateMemberMask = await createMask(app, memberCookie, 'Second Mask');

    const createRoomResponse = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: { cookie: hostCookie },
      payload: {
        maskId: hostMask.id,
        title: 'Moderation Room',
        kind: 'EPHEMERAL',
      },
    });

    expect(createRoomResponse.statusCode).toBe(201);
    const room = CreateRoomResponseSchema.parse(createRoomResponse.json()).room;

    const joinMemberResponse = await app.inject({
      method: 'POST',
      url: `/rooms/${room.id}/join`,
      headers: { cookie: memberCookie },
      payload: {
        maskId: memberMask.id,
      },
    });
    expect(joinMemberResponse.statusCode).toBe(200);

    const forgedActorResponse = await app.inject({
      method: 'POST',
      url: `/rooms/${room.id}/mute`,
      headers: { cookie: hostCookie },
      payload: {
        actorMaskId: memberMask.id,
        targetMaskId: memberMask.id,
        minutes: 10,
      },
    });
    expect(forgedActorResponse.statusCode).toBe(403);

    const memberLockAttempt = await app.inject({
      method: 'POST',
      url: `/rooms/${room.id}/lock`,
      headers: { cookie: memberCookie },
      payload: {
        actorMaskId: memberMask.id,
        locked: true,
      },
    });
    expect(memberLockAttempt.statusCode).toBe(403);

    const muteHostAttempt = await app.inject({
      method: 'POST',
      url: `/rooms/${room.id}/mute`,
      headers: { cookie: hostCookie },
      payload: {
        actorMaskId: hostMask.id,
        targetMaskId: hostMask.id,
        minutes: 10,
      },
    });
    expect(muteHostAttempt.statusCode).toBe(400);

    const muteResponse = await app.inject({
      method: 'POST',
      url: `/rooms/${room.id}/mute`,
      headers: { cookie: hostCookie },
      payload: {
        actorMaskId: hostMask.id,
        targetMaskId: memberMask.id,
        minutes: 10,
      },
    });

    expect(muteResponse.statusCode).toBe(200);
    const mutedPayload = ModerateRoomResponseSchema.parse(muteResponse.json());
    expect(mutedPayload.moderation?.actionType).toBe('MUTE');

    const lockResponse = await app.inject({
      method: 'POST',
      url: `/rooms/${room.id}/lock`,
      headers: { cookie: hostCookie },
      payload: {
        actorMaskId: hostMask.id,
        locked: true,
      },
    });

    expect(lockResponse.statusCode).toBe(200);
    const lockPayload = ModerateRoomResponseSchema.parse(lockResponse.json());
    expect(lockPayload.room?.locked).toBe(true);

    const blockedJoinResponse = await app.inject({
      method: 'POST',
      url: `/rooms/${room.id}/join`,
      headers: { cookie: memberCookie },
      payload: {
        maskId: alternateMemberMask.id,
      },
    });

    expect(blockedJoinResponse.statusCode).toBe(423);

    const exileResponse = await app.inject({
      method: 'POST',
      url: `/rooms/${room.id}/exile`,
      headers: { cookie: hostCookie },
      payload: {
        actorMaskId: hostMask.id,
        targetMaskId: memberMask.id,
      },
    });

    expect(exileResponse.statusCode).toBe(200);
    const exiledPayload = ModerateRoomResponseSchema.parse(exileResponse.json());
    expect(exiledPayload.moderation?.actionType).toBe('EXILE');

    const roomsAfterExile = await app.inject({
      method: 'GET',
      url: `/rooms?maskId=${memberMask.id}`,
      headers: { cookie: memberCookie },
    });

    expect(roomsAfterExile.statusCode).toBe(200);
    const parsedRooms = ListRoomsResponseSchema.parse(roomsAfterExile.json());
    expect(parsedRooms.rooms.some((item) => item.id === room.id)).toBe(false);
  });

  it('supports friend request accept and unfriend flow', async () => {
    const aliceCookie = await registerUser(app, 'alice@example.com');
    const bobCookie = await registerUser(app, 'bob@example.com');

    await createMask(app, aliceCookie, 'Alice Mask');
    await createMask(app, bobCookie, 'Bob Mask');

    const bobMeResponse = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie: bobCookie },
    });
    expect(bobMeResponse.statusCode).toBe(200);
    const bobMe = MeResponseSchema.parse(bobMeResponse.json());

    const createFriendRequestResponse = await app.inject({
      method: 'POST',
      url: '/friends/request',
      headers: { cookie: aliceCookie },
      payload: {
        friendCode: bobMe.user.friendCode,
      },
    });
    expect(createFriendRequestResponse.statusCode).toBe(201);

    const bobRequestsResponse = await app.inject({
      method: 'GET',
      url: '/friends/requests',
      headers: { cookie: bobCookie },
    });
    expect(bobRequestsResponse.statusCode).toBe(200);
    const bobRequests = FriendRequestsResponseSchema.parse(bobRequestsResponse.json());
    expect(bobRequests.incoming).toHaveLength(1);
    expect(bobRequests.incoming[0].fromUser.email).toBe('alice@example.com');

    const acceptResponse = await app.inject({
      method: 'POST',
      url: `/friends/request/${bobRequests.incoming[0].request.id}/accept`,
      headers: { cookie: bobCookie },
    });
    expect(acceptResponse.statusCode).toBe(200);

    const aliceFriendsResponse = await app.inject({
      method: 'GET',
      url: '/friends',
      headers: { cookie: aliceCookie },
    });
    expect(aliceFriendsResponse.statusCode).toBe(200);
    const aliceFriends = FriendsListResponseSchema.parse(aliceFriendsResponse.json());
    expect(aliceFriends.friends).toHaveLength(1);
    expect(aliceFriends.friends[0].id).toBe(bobMe.user.id);
    expect(aliceFriends.friends[0].defaultMask?.displayName).toBe('Bob Mask');

    const unfriendResponse = await app.inject({
      method: 'DELETE',
      url: `/friends/${bobMe.user.id}`,
      headers: { cookie: aliceCookie },
    });
    expect(unfriendResponse.statusCode).toBe(200);

    const aliceFriendsAfterUnfriendResponse = await app.inject({
      method: 'GET',
      url: '/friends',
      headers: { cookie: aliceCookie },
    });
    expect(aliceFriendsAfterUnfriendResponse.statusCode).toBe(200);
    const aliceFriendsAfterUnfriend = FriendsListResponseSchema.parse(
      aliceFriendsAfterUnfriendResponse.json(),
    );
    expect(aliceFriendsAfterUnfriend.friends).toHaveLength(0);
  });

  it('supports friend-only DM thread creation and mask switching', async () => {
    const aliceCookie = await registerUser(app, 'alice-dm@example.com');
    const bobCookie = await registerUser(app, 'bob-dm@example.com');
    const charlieCookie = await registerUser(app, 'charlie-dm@example.com');

    const aliceMaskA = await createMask(app, aliceCookie, 'Alice One');
    const aliceMaskB = await createMask(app, aliceCookie, 'Alice Two');
    await createMask(app, bobCookie, 'Bob One');
    const charlieMask = await createMask(app, charlieCookie, 'Charlie One');

    const bobMeResponse = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie: bobCookie },
    });
    expect(bobMeResponse.statusCode).toBe(200);
    const bobMe = MeResponseSchema.parse(bobMeResponse.json());

    const friendRequestResponse = await app.inject({
      method: 'POST',
      url: '/friends/request',
      headers: { cookie: aliceCookie },
      payload: {
        toUserId: bobMe.user.id,
      },
    });
    expect(friendRequestResponse.statusCode).toBe(201);

    const bobRequestsResponse = await app.inject({
      method: 'GET',
      url: '/friends/requests',
      headers: { cookie: bobCookie },
    });
    expect(bobRequestsResponse.statusCode).toBe(200);
    const bobRequests = FriendRequestsResponseSchema.parse(bobRequestsResponse.json());
    expect(bobRequests.incoming).toHaveLength(1);

    const acceptResponse = await app.inject({
      method: 'POST',
      url: `/friends/request/${bobRequests.incoming[0].request.id}/accept`,
      headers: { cookie: bobCookie },
    });
    expect(acceptResponse.statusCode).toBe(200);

    const startDmResponse = await app.inject({
      method: 'POST',
      url: '/dm/start',
      headers: { cookie: aliceCookie },
      payload: {
        friendUserId: bobMe.user.id,
        initialMaskId: aliceMaskA.id,
      },
    });
    expect(startDmResponse.statusCode).toBe(201);
    const startedDm = DmStartResponseSchema.parse(startDmResponse.json());
    expect(startedDm.participants).toHaveLength(2);

    const aliceThreadsResponse = await app.inject({
      method: 'GET',
      url: '/dm/threads',
      headers: { cookie: aliceCookie },
    });
    expect(aliceThreadsResponse.statusCode).toBe(200);
    const parsedThreads = DmThreadsResponseSchema.parse(aliceThreadsResponse.json());
    expect(parsedThreads.threads).toHaveLength(1);
    expect(parsedThreads.threads[0].peer.id).toBe(bobMe.user.id);
    expect(parsedThreads.threads[0].activeMask.maskId).toBe(aliceMaskA.id);

    const setMaskResponse = await app.inject({
      method: 'POST',
      url: `/dm/${startedDm.thread.id}/mask`,
      headers: { cookie: aliceCookie },
      payload: {
        maskId: aliceMaskB.id,
      },
    });
    expect(setMaskResponse.statusCode).toBe(200);

    const getThreadResponse = await app.inject({
      method: 'GET',
      url: `/dm/${startedDm.thread.id}`,
      headers: { cookie: aliceCookie },
    });
    expect(getThreadResponse.statusCode).toBe(200);
    const threadPayload = DmThreadResponseSchema.parse(getThreadResponse.json());
    expect(threadPayload.activeMask.maskId).toBe(aliceMaskB.id);

    const strangerGetThreadResponse = await app.inject({
      method: 'GET',
      url: `/dm/${startedDm.thread.id}`,
      headers: { cookie: charlieCookie },
    });
    expect(strangerGetThreadResponse.statusCode).toBe(403);

    const strangerStartResponse = await app.inject({
      method: 'POST',
      url: '/dm/start',
      headers: { cookie: charlieCookie },
      payload: {
        friendUserId: bobMe.user.id,
        initialMaskId: charlieMask.id,
      },
    });
    expect(strangerStartResponse.statusCode).toBe(403);
  });

  it('requires auth for RTC session creation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/rtc/session',
      payload: {
        contextType: 'SERVER_CHANNEL',
        contextId: randomUUID(),
        maskId: randomUUID(),
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('issues RTC token only for authorized server channel members using active channel identity', async () => {
    const ownerCookie = await registerUser(app, 'rtc-owner@example.com');
    const memberCookie = await registerUser(app, 'rtc-member@example.com');
    const strangerCookie = await registerUser(app, 'rtc-stranger@example.com');

    const ownerMask = await createMask(app, ownerCookie, 'RTC Owner');
    const memberMask = await createMask(app, memberCookie, 'RTC Member');
    const strangerMask = await createMask(app, strangerCookie, 'RTC Stranger');

    const createServerResponse = await app.inject({
      method: 'POST',
      url: '/servers',
      headers: { cookie: ownerCookie },
      payload: {
        name: 'RTC Guild',
      },
    });
    expect(createServerResponse.statusCode).toBe(201);
    const createdServer = CreateServerResponseSchema.parse(createServerResponse.json()).server;

    const ownerServerStateResponse = await app.inject({
      method: 'GET',
      url: `/servers/${createdServer.id}`,
      headers: { cookie: ownerCookie },
    });
    expect(ownerServerStateResponse.statusCode).toBe(200);
    const ownerServerState = GetServerResponseSchema.parse(ownerServerStateResponse.json());
    const channelId = ownerServerState.channels[0]?.id;
    expect(channelId).toBeDefined();

    const createInviteResponse = await app.inject({
      method: 'POST',
      url: `/servers/${createdServer.id}/invites`,
      headers: { cookie: ownerCookie },
      payload: {},
    });
    expect(createInviteResponse.statusCode).toBe(201);
    const invite = CreateServerInviteResponseSchema.parse(createInviteResponse.json()).invite;

    const memberJoinResponse = await app.inject({
      method: 'POST',
      url: '/servers/join',
      headers: { cookie: memberCookie },
      payload: {
        inviteCode: invite.code,
        serverMaskId: memberMask.id,
      },
    });
    expect(memberJoinResponse.statusCode).toBe(200);

    const ownerRtcResponse = await app.inject({
      method: 'POST',
      url: '/rtc/session',
      headers: { cookie: ownerCookie },
      payload: {
        contextType: 'SERVER_CHANNEL',
        contextId: channelId,
        maskId: ownerMask.id,
      },
    });
    expect(ownerRtcResponse.statusCode).toBe(200);
    const ownerRtcPayload = CreateRtcSessionResponseSchema.parse(ownerRtcResponse.json());
    expect(ownerRtcPayload.token.length).toBeGreaterThan(10);
    expect(ownerRtcPayload.livekitRoomName.length).toBeGreaterThan(5);

    const memberRtcResponse = await app.inject({
      method: 'POST',
      url: '/rtc/session',
      headers: { cookie: memberCookie },
      payload: {
        contextType: 'SERVER_CHANNEL',
        contextId: channelId,
        maskId: memberMask.id,
      },
    });
    expect(memberRtcResponse.statusCode).toBe(200);

    const strangerRtcResponse = await app.inject({
      method: 'POST',
      url: '/rtc/session',
      headers: { cookie: strangerCookie },
      payload: {
        contextType: 'SERVER_CHANNEL',
        contextId: channelId,
        maskId: strangerMask.id,
      },
    });
    expect(strangerRtcResponse.statusCode).toBe(403);

    const wrongMaskResponse = await app.inject({
      method: 'POST',
      url: '/rtc/session',
      headers: { cookie: memberCookie },
      payload: {
        contextType: 'SERVER_CHANNEL',
        contextId: channelId,
        maskId: ownerMask.id,
      },
    });
    expect(wrongMaskResponse.statusCode).toBe(403);
  });

  it('enables PRO user features in /me when active entitlement exists', async () => {
    const cookie = await registerUser(app, 'pro-feature-access@example.com');
    await createMask(app, cookie, 'Pro Feature Mask');

    const meBeforeResponse = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie },
    });
    expect(meBeforeResponse.statusCode).toBe(200);
    const meBefore = MeResponseSchema.parse(meBeforeResponse.json());
    expect(meBefore.currentPlan).toBe('FREE');
    expect(
      meBefore.featureAccess.find((entry) => entry.feature === 'PRO_ADVANCED_LAYOUT')?.enabled ?? false,
    ).toBe(false);

    await repository.createEntitlement({
      userId: meBefore.user.id,
      kind: 'PRO',
      source: 'DEV_MANUAL',
      expiresAt: null,
    });

    const meAfterResponse = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie },
    });
    expect(meAfterResponse.statusCode).toBe(200);
    const meAfter = MeResponseSchema.parse(meAfterResponse.json());
    expect(meAfter.currentPlan).toBe('PRO');
    expect(
      meAfter.featureAccess.find((entry) => entry.feature === 'PRO_ADVANCED_LAYOUT')?.enabled ?? false,
    ).toBe(true);
    expect(
      meAfter.featureAccess.find((entry) => entry.feature === 'PRO_AURA_STYLES')?.enabled ?? false,
    ).toBe(true);
  });

  it('activates owner PRO server RTC perks when server owner has PRO entitlement', async () => {
    const ownerCookie = await registerUser(app, 'owner-pro-perks@example.com');
    await createMask(app, ownerCookie, 'Owner Pro');

    const createServerResponse = await app.inject({
      method: 'POST',
      url: '/servers',
      headers: { cookie: ownerCookie },
      payload: {
        name: 'Owner Pro Guild',
      },
    });
    expect(createServerResponse.statusCode).toBe(201);
    const server = CreateServerResponseSchema.parse(createServerResponse.json()).server;

    const beforeResponse = await app.inject({
      method: 'GET',
      url: `/servers/${server.id}`,
      headers: { cookie: ownerCookie },
    });
    expect(beforeResponse.statusCode).toBe(200);
    const beforeState = GetServerResponseSchema.parse(beforeResponse.json());
    expect(beforeState.rtcPolicy.ownerProPerksActive).toBe(false);
    expect(beforeState.rtcPolicy.participantCap).toBe(12);
    expect(beforeState.rtcPolicy.recordingAllowed).toBe(false);

    const meResponse = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie: ownerCookie },
    });
    expect(meResponse.statusCode).toBe(200);
    const me = MeResponseSchema.parse(meResponse.json());
    await repository.createEntitlement({
      userId: me.user.id,
      kind: 'PRO',
      source: 'DEV_MANUAL',
      expiresAt: null,
    });

    const afterResponse = await app.inject({
      method: 'GET',
      url: `/servers/${server.id}`,
      headers: { cookie: ownerCookie },
    });
    expect(afterResponse.statusCode).toBe(200);
    const afterState = GetServerResponseSchema.parse(afterResponse.json());
    expect(afterState.rtcPolicy.ownerProPerksActive).toBe(true);
    expect(afterState.rtcPolicy.participantCap).toBe(32);
    expect(afterState.rtcPolicy.recordingAllowed).toBe(false);
  });

  it('enforces server RTC participant cap when session is full', async () => {
    const ownerCookie = await registerUser(app, 'rtc-cap-owner@example.com');
    const ownerMask = await createMask(app, ownerCookie, 'Cap Owner');

    const createServerResponse = await app.inject({
      method: 'POST',
      url: '/servers',
      headers: { cookie: ownerCookie },
      payload: {
        name: 'Cap Test Guild',
      },
    });
    expect(createServerResponse.statusCode).toBe(201);
    const server = CreateServerResponseSchema.parse(createServerResponse.json()).server;

    const serverStateResponse = await app.inject({
      method: 'GET',
      url: `/servers/${server.id}`,
      headers: { cookie: ownerCookie },
    });
    expect(serverStateResponse.statusCode).toBe(200);
    const serverState = GetServerResponseSchema.parse(serverStateResponse.json());
    const channelId = serverState.channels[0]?.id;
    expect(channelId).toBeDefined();

    const activeSession = await repository.createVoiceSession({
      contextType: 'SERVER_CHANNEL',
      contextId: channelId,
      livekitRoomName: `server-channel-${channelId}`,
    });

    for (let index = 0; index < 12; index += 1) {
      await repository.createVoiceParticipant({
        voiceSessionId: activeSession.id,
        userId: randomUUID(),
        maskId: ownerMask.id,
        isServerMuted: false,
      });
    }

    const rtcJoinResponse = await app.inject({
      method: 'POST',
      url: '/rtc/session',
      headers: { cookie: ownerCookie },
      payload: {
        contextType: 'SERVER_CHANNEL',
        contextId: channelId,
        maskId: ownerMask.id,
      },
    });
    expect(rtcJoinResponse.statusCode).toBe(409);
    expect(rtcJoinResponse.json().message).toContain('Participant cap reached');
  });

  it('records aura activity when a room message is sent', async () => {
    const cookie = await registerUser(app, 'aura-message-flow@example.com');
    const mask = await createMask(app, cookie, 'Aura Speaker');

    const createRoomResponse = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: { cookie },
      payload: {
        maskId: mask.id,
        title: 'Aura Room',
        kind: 'EPHEMERAL',
      },
    });
    expect(createRoomResponse.statusCode).toBe(201);
    const room = CreateRoomResponseSchema.parse(createRoomResponse.json()).room;

    const auraBeforeResponse = await app.inject({
      method: 'GET',
      url: `/masks/${mask.id}/aura`,
      headers: { cookie },
    });
    expect(auraBeforeResponse.statusCode).toBe(200);
    const auraBefore = GetMaskAuraResponseSchema.parse(auraBeforeResponse.json());

    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Unable to resolve websocket address');
    }

    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/ws`, {
      headers: {
        cookie,
      },
    });

    const waitForOpen = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('websocket open timeout')), 6000);
      ws.once('open', () => {
        clearTimeout(timer);
        resolve();
      });
      ws.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    const waitForSocketEvent = (type: string) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          ws.off('message', onMessage);
          ws.off('error', onError);
          reject(new Error(`timed out waiting for socket event ${type}`));
        }, 6000);

        const onError = (err: Error) => {
          clearTimeout(timer);
          ws.off('message', onMessage);
          reject(err);
        };

        const onMessage = (raw: RawData) => {
          let payload: unknown;
          try {
            payload = JSON.parse(raw.toString());
          } catch {
            return;
          }
          const parsed = ServerSocketEventSchema.safeParse(payload);
          if (!parsed.success) {
            return;
          }
          if (parsed.data.type !== type) {
            return;
          }
          clearTimeout(timer);
          ws.off('message', onMessage);
          ws.off('error', onError);
          resolve();
        };

        ws.on('message', onMessage);
        ws.on('error', onError);
      });

    await waitForOpen;
    ws.send(
      JSON.stringify(
        ClientSocketEventSchema.parse({
          type: 'JOIN_ROOM',
          data: {
            roomId: room.id,
            maskId: mask.id,
          },
        }),
      ),
    );
    await waitForSocketEvent('ROOM_STATE');

    await new Promise((resolve) => setTimeout(resolve, 25));
    ws.send(
      JSON.stringify(
        ClientSocketEventSchema.parse({
          type: 'SEND_MESSAGE',
          data: {
            roomId: room.id,
            maskId: mask.id,
            body: 'Aura signal check',
          },
        }),
      ),
    );
    await waitForSocketEvent('NEW_MESSAGE');
    ws.close();

    const auraAfterResponse = await app.inject({
      method: 'GET',
      url: `/masks/${mask.id}/aura`,
      headers: { cookie },
    });
    expect(auraAfterResponse.statusCode).toBe(200);
    const auraAfter = GetMaskAuraResponseSchema.parse(auraAfterResponse.json());
    expect(auraAfter.aura.score).toBeGreaterThanOrEqual(auraBefore.aura.score);
    expect(Date.parse(auraAfter.aura.lastActivityAt)).toBeGreaterThanOrEqual(Date.parse(auraBefore.aura.lastActivityAt));
    expect(auraAfter.recentEvents.some((event) => event.kind === 'MESSAGE_SENT')).toBe(true);
  });

  it('supports server create/invite/join/channel and kick authorization flow', async () => {
    const ownerCookie = await registerUser(app, 'owner-server@example.com');
    const memberCookie = await registerUser(app, 'member-server@example.com');

    await createMask(app, ownerCookie, 'Owner Mask');
    const memberMask = await createMask(app, memberCookie, 'Member Mask');
    const memberMaskAlt = await createMask(app, memberCookie, 'Member Alt');

    const createServerResponse = await app.inject({
      method: 'POST',
      url: '/servers',
      headers: { cookie: ownerCookie },
      payload: {
        name: 'Guild One',
      },
    });
    expect(createServerResponse.statusCode).toBe(201);
    const createdServer = CreateServerResponseSchema.parse(createServerResponse.json()).server;

    const ownerGetServerResponse = await app.inject({
      method: 'GET',
      url: `/servers/${createdServer.id}`,
      headers: { cookie: ownerCookie },
    });
    expect(ownerGetServerResponse.statusCode).toBe(200);
    const ownerServerState = GetServerResponseSchema.parse(ownerGetServerResponse.json());
    expect(ownerServerState.channels.length).toBeGreaterThan(0);

    const createInviteResponse = await app.inject({
      method: 'POST',
      url: `/servers/${createdServer.id}/invites`,
      headers: { cookie: ownerCookie },
      payload: {
        expiresMinutes: 60,
        maxUses: 5,
      },
    });
    expect(createInviteResponse.statusCode).toBe(201);
    const invite = CreateServerInviteResponseSchema.parse(createInviteResponse.json()).invite;

    const joinServerResponse = await app.inject({
      method: 'POST',
      url: '/servers/join',
      headers: { cookie: memberCookie },
      payload: {
        inviteCode: invite.code,
        serverMaskId: memberMask.id,
      },
    });
    expect(joinServerResponse.statusCode).toBe(200);

    const listMemberServersResponse = await app.inject({
      method: 'GET',
      url: '/servers',
      headers: { cookie: memberCookie },
    });
    expect(listMemberServersResponse.statusCode).toBe(200);
    const memberServers = ListServersResponseSchema.parse(listMemberServersResponse.json());
    expect(memberServers.servers.some((item) => item.server.id === createdServer.id)).toBe(true);

    const memberCreateChannelForbiddenResponse = await app.inject({
      method: 'POST',
      url: `/servers/${createdServer.id}/channels`,
      headers: { cookie: memberCookie },
      payload: {
        name: 'member-cannot-create',
      },
    });
    expect(memberCreateChannelForbiddenResponse.statusCode).toBe(403);

    const ownerCreateChannelResponse = await app.inject({
      method: 'POST',
      url: `/servers/${createdServer.id}/channels`,
      headers: { cookie: ownerCookie },
      payload: {
        name: 'strategy',
      },
    });
    expect(ownerCreateChannelResponse.statusCode).toBe(201);
    const createdChannel = CreateServerChannelResponseSchema.parse(ownerCreateChannelResponse.json()).channel;
    expect(createdChannel.serverId).toBe(createdServer.id);

    const setServerMaskResponse = await app.inject({
      method: 'POST',
      url: `/servers/${createdServer.id}/mask`,
      headers: { cookie: memberCookie },
      payload: {
        serverMaskId: memberMaskAlt.id,
      },
    });
    expect(setServerMaskResponse.statusCode).toBe(200);

    const memberServerStateResponse = await app.inject({
      method: 'GET',
      url: `/servers/${createdServer.id}`,
      headers: { cookie: memberCookie },
    });
    expect(memberServerStateResponse.statusCode).toBe(200);
    const memberServerState = GetServerResponseSchema.parse(memberServerStateResponse.json());
    const memberState = memberServerState.members.find(
      (member) => member.userId !== ownerServerState.server.ownerUserId,
    );
    expect(memberState?.serverMask.id).toBe(memberMaskAlt.id);
    const memberUserId = memberState?.userId;
    expect(memberUserId).toBeDefined();

    const kickMemberResponse = await app.inject({
      method: 'DELETE',
      url: `/servers/${createdServer.id}/members/${memberUserId}`,
      headers: { cookie: ownerCookie },
    });
    expect(kickMemberResponse.statusCode).toBe(200);

    const memberGetAfterKickResponse = await app.inject({
      method: 'GET',
      url: `/servers/${createdServer.id}`,
      headers: { cookie: memberCookie },
    });
    expect(memberGetAfterKickResponse.statusCode).toBe(403);

    const ownerDeleteChannelResponse = await app.inject({
      method: 'DELETE',
      url: `/servers/${createdServer.id}/channels/${createdChannel.id}`,
      headers: { cookie: ownerCookie },
    });
    expect(ownerDeleteChannelResponse.statusCode).toBe(200);
  });

  it('enforces server role permissions for channel, invite, and kick actions', async () => {
    const ownerCookie = await registerUser(app, 'owner-perm@example.com');
    const modCookie = await registerUser(app, 'mod-perm@example.com');
    const memberCookie = await registerUser(app, 'member-perm@example.com');

    await createMask(app, ownerCookie, 'Owner Perm');
    const modMask = await createMask(app, modCookie, 'Mod Perm');
    const memberMask = await createMask(app, memberCookie, 'Member Perm');

    const createServerResponse = await app.inject({
      method: 'POST',
      url: '/servers',
      headers: { cookie: ownerCookie },
      payload: {
        name: 'Guild Permissions',
      },
    });
    expect(createServerResponse.statusCode).toBe(201);
    const server = CreateServerResponseSchema.parse(createServerResponse.json()).server;

    const inviteResponse = await app.inject({
      method: 'POST',
      url: `/servers/${server.id}/invites`,
      headers: { cookie: ownerCookie },
      payload: {
        maxUses: 10,
      },
    });
    expect(inviteResponse.statusCode).toBe(201);
    const invite = CreateServerInviteResponseSchema.parse(inviteResponse.json()).invite;

    const modJoinResponse = await app.inject({
      method: 'POST',
      url: '/servers/join',
      headers: { cookie: modCookie },
      payload: {
        inviteCode: invite.code,
        serverMaskId: modMask.id,
      },
    });
    expect(modJoinResponse.statusCode).toBe(200);

    const memberJoinResponse = await app.inject({
      method: 'POST',
      url: '/servers/join',
      headers: { cookie: memberCookie },
      payload: {
        inviteCode: invite.code,
        serverMaskId: memberMask.id,
      },
    });
    expect(memberJoinResponse.statusCode).toBe(200);

    const modMeResponse = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie: modCookie },
    });
    expect(modMeResponse.statusCode).toBe(200);
    const modUserId = MeResponseSchema.parse(modMeResponse.json()).user.id;

    const memberMeResponse = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie: memberCookie },
    });
    expect(memberMeResponse.statusCode).toBe(200);
    const memberUserId = MeResponseSchema.parse(memberMeResponse.json()).user.id;

    const forbiddenChannelBeforeRole = await app.inject({
      method: 'POST',
      url: `/servers/${server.id}/channels`,
      headers: { cookie: modCookie },
      payload: {
        name: 'mod-room-before',
      },
    });
    expect(forbiddenChannelBeforeRole.statusCode).toBe(403);

    const forbiddenInviteBeforeRole = await app.inject({
      method: 'POST',
      url: `/servers/${server.id}/invites`,
      headers: { cookie: modCookie },
      payload: {},
    });
    expect(forbiddenInviteBeforeRole.statusCode).toBe(403);

    const forbiddenKickBeforeRole = await app.inject({
      method: 'DELETE',
      url: `/servers/${server.id}/members/${memberUserId}`,
      headers: { cookie: modCookie },
    });
    expect(forbiddenKickBeforeRole.statusCode).toBe(403);

    const createRoleResponse = await app.inject({
      method: 'POST',
      url: `/servers/${server.id}/roles`,
      headers: { cookie: ownerCookie },
      payload: {
        name: 'MODERATOR',
        permissions: ['ManageChannels', 'CreateInvites', 'ModerateChat'],
      },
    });
    expect(createRoleResponse.statusCode).toBe(201);
    const modRole = ServerRoleResponseSchema.parse(createRoleResponse.json()).role;

    const assignRoleResponse = await app.inject({
      method: 'POST',
      url: `/servers/${server.id}/members/${modUserId}/roles`,
      headers: { cookie: ownerCookie },
      payload: {
        roleIds: [modRole.id],
      },
    });
    expect(assignRoleResponse.statusCode).toBe(200);
    const assignedMember = SetServerMemberRolesResponseSchema.parse(assignRoleResponse.json()).member;
    expect(assignedMember.roleIds).toContain(modRole.id);
    expect(assignedMember.permissions).toContain('ManageChannels');
    expect(assignedMember.permissions).toContain('CreateInvites');
    expect(assignedMember.permissions).toContain('ModerateChat');

    const listRolesResponse = await app.inject({
      method: 'GET',
      url: `/servers/${server.id}/roles`,
      headers: { cookie: modCookie },
    });
    expect(listRolesResponse.statusCode).toBe(200);
    const listedRolesPayload = ListServerRolesResponseSchema.parse(listRolesResponse.json());
    expect(listedRolesPayload.roles.some((role) => role.id === modRole.id)).toBe(true);
    expect(listedRolesPayload.myPermissions).toContain('ManageChannels');
    expect(listedRolesPayload.myPermissions).toContain('CreateInvites');
    expect(listedRolesPayload.myPermissions).toContain('ModerateChat');
    expect(listedRolesPayload.myPermissions).not.toContain('ManageMembers');

    const modCreateChannelAfterRole = await app.inject({
      method: 'POST',
      url: `/servers/${server.id}/channels`,
      headers: { cookie: modCookie },
      payload: {
        name: 'mod-room-after',
      },
    });
    expect(modCreateChannelAfterRole.statusCode).toBe(201);
    CreateServerChannelResponseSchema.parse(modCreateChannelAfterRole.json());

    const modCreateInviteAfterRole = await app.inject({
      method: 'POST',
      url: `/servers/${server.id}/invites`,
      headers: { cookie: modCookie },
      payload: {},
    });
    expect(modCreateInviteAfterRole.statusCode).toBe(201);

    const modKickAfterRole = await app.inject({
      method: 'DELETE',
      url: `/servers/${server.id}/members/${memberUserId}`,
      headers: { cookie: modCookie },
    });
    expect(modKickAfterRole.statusCode).toBe(200);

    const memberAccessAfterKick = await app.inject({
      method: 'GET',
      url: `/servers/${server.id}`,
      headers: { cookie: memberCookie },
    });
    expect(memberAccessAfterKick.statusCode).toBe(403);

    const modAssignRoleForbidden = await app.inject({
      method: 'POST',
      url: `/servers/${server.id}/members/${modUserId}/roles`,
      headers: { cookie: modCookie },
      payload: {
        roleIds: [],
      },
    });
    expect(modAssignRoleForbidden.statusCode).toBe(403);
  });

  it('allows ADMIN members to provision roles to other server members', async () => {
    const ownerCookie = await registerUser(app, 'owner-admin-provision@example.com');
    const adminCookie = await registerUser(app, 'admin-provision@example.com');
    const memberCookie = await registerUser(app, 'member-provision@example.com');

    await createMask(app, ownerCookie, 'Owner Provision');
    const adminMask = await createMask(app, adminCookie, 'Admin Provision');
    const memberMask = await createMask(app, memberCookie, 'Member Provision');

    const createServerResponse = await app.inject({
      method: 'POST',
      url: '/servers',
      headers: { cookie: ownerCookie },
      payload: {
        name: 'Guild Admin Provision',
      },
    });
    expect(createServerResponse.statusCode).toBe(201);
    const server = CreateServerResponseSchema.parse(createServerResponse.json()).server;

    const inviteResponse = await app.inject({
      method: 'POST',
      url: `/servers/${server.id}/invites`,
      headers: { cookie: ownerCookie },
      payload: {
        maxUses: 10,
      },
    });
    expect(inviteResponse.statusCode).toBe(201);
    const invite = CreateServerInviteResponseSchema.parse(inviteResponse.json()).invite;

    const adminJoinResponse = await app.inject({
      method: 'POST',
      url: '/servers/join',
      headers: { cookie: adminCookie },
      payload: {
        inviteCode: invite.code,
        serverMaskId: adminMask.id,
      },
    });
    expect(adminJoinResponse.statusCode).toBe(200);

    const memberJoinResponse = await app.inject({
      method: 'POST',
      url: '/servers/join',
      headers: { cookie: memberCookie },
      payload: {
        inviteCode: invite.code,
        serverMaskId: memberMask.id,
      },
    });
    expect(memberJoinResponse.statusCode).toBe(200);

    const adminMeResponse = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie: adminCookie },
    });
    expect(adminMeResponse.statusCode).toBe(200);
    const adminUserId = MeResponseSchema.parse(adminMeResponse.json()).user.id;

    const memberMeResponse = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie: memberCookie },
    });
    expect(memberMeResponse.statusCode).toBe(200);
    const memberUserId = MeResponseSchema.parse(memberMeResponse.json()).user.id;

    await repository.addServerMember({
      serverId: server.id,
      userId: adminUserId,
      role: 'ADMIN',
      serverMaskId: adminMask.id,
    });

    const createRoleResponse = await app.inject({
      method: 'POST',
      url: `/servers/${server.id}/roles`,
      headers: { cookie: ownerCookie },
      payload: {
        name: 'CURATOR',
        permissions: ['ModerateChat'],
      },
    });
    expect(createRoleResponse.statusCode).toBe(201);
    const createdRole = ServerRoleResponseSchema.parse(createRoleResponse.json()).role;

    const assignByAdminResponse = await app.inject({
      method: 'POST',
      url: `/servers/${server.id}/members/${memberUserId}/roles`,
      headers: { cookie: adminCookie },
      payload: {
        roleIds: [createdRole.id],
      },
    });
    expect(assignByAdminResponse.statusCode).toBe(200);
    const assignmentPayload = SetServerMemberRolesResponseSchema.parse(assignByAdminResponse.json());
    expect(assignmentPayload.member.roleIds).toContain(createdRole.id);

    const adminServerStateResponse = await app.inject({
      method: 'GET',
      url: `/servers/${server.id}`,
      headers: { cookie: adminCookie },
    });
    expect(adminServerStateResponse.statusCode).toBe(200);
    const adminServerState = GetServerResponseSchema.parse(adminServerStateResponse.json());
    expect(adminServerState.myPermissions).toContain('ManageMembers');
  });

  it('allows owners to promote and demote member base role via role assignment endpoint', async () => {
    const ownerCookie = await registerUser(app, 'owner-member-role@example.com');
    const memberCookie = await registerUser(app, 'member-member-role@example.com');

    await createMask(app, ownerCookie, 'Owner Role Flow');
    const memberMask = await createMask(app, memberCookie, 'Member Role Flow');

    const createServerResponse = await app.inject({
      method: 'POST',
      url: '/servers',
      headers: { cookie: ownerCookie },
      payload: {
        name: 'Guild Member Role Flow',
      },
    });
    expect(createServerResponse.statusCode).toBe(201);
    const server = CreateServerResponseSchema.parse(createServerResponse.json()).server;

    const inviteResponse = await app.inject({
      method: 'POST',
      url: `/servers/${server.id}/invites`,
      headers: { cookie: ownerCookie },
      payload: {
        maxUses: 5,
      },
    });
    expect(inviteResponse.statusCode).toBe(201);
    const invite = CreateServerInviteResponseSchema.parse(inviteResponse.json()).invite;

    const memberJoinResponse = await app.inject({
      method: 'POST',
      url: '/servers/join',
      headers: { cookie: memberCookie },
      payload: {
        inviteCode: invite.code,
        serverMaskId: memberMask.id,
      },
    });
    expect(memberJoinResponse.statusCode).toBe(200);

    const memberMeResponse = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie: memberCookie },
    });
    expect(memberMeResponse.statusCode).toBe(200);
    const memberUserId = MeResponseSchema.parse(memberMeResponse.json()).user.id;

    const promoteResponse = await app.inject({
      method: 'POST',
      url: `/servers/${server.id}/members/${memberUserId}/roles`,
      headers: { cookie: ownerCookie },
      payload: {
        roleIds: [],
        memberRole: 'ADMIN',
      },
    });
    expect(promoteResponse.statusCode).toBe(200);
    const promotePayload = SetServerMemberRolesResponseSchema.parse(promoteResponse.json());
    expect(promotePayload.member.role).toBe('ADMIN');

    const adminChannelCreateResponse = await app.inject({
      method: 'POST',
      url: `/servers/${server.id}/channels`,
      headers: { cookie: memberCookie },
      payload: {
        name: 'admin-capability-room',
      },
    });
    expect(adminChannelCreateResponse.statusCode).toBe(201);

    const demoteResponse = await app.inject({
      method: 'POST',
      url: `/servers/${server.id}/members/${memberUserId}/roles`,
      headers: { cookie: ownerCookie },
      payload: {
        roleIds: [],
        memberRole: 'MEMBER',
      },
    });
    expect(demoteResponse.statusCode).toBe(200);
    const demotePayload = SetServerMemberRolesResponseSchema.parse(demoteResponse.json());
    expect(demotePayload.member.role).toBe('MEMBER');

    const memberChannelCreateForbidden = await app.inject({
      method: 'POST',
      url: `/servers/${server.id}/channels`,
      headers: { cookie: memberCookie },
      payload: {
        name: 'member-should-fail',
      },
    });
    expect(memberChannelCreateForbidden.statusCode).toBe(403);
  });

  it('supports CHANNEL_MASK mode and per-channel mask selection', async () => {
    const ownerCookie = await registerUser(app, 'owner-channel-mask@example.com');
    const memberCookie = await registerUser(app, 'member-channel-mask@example.com');

    const ownerMask = await createMask(app, ownerCookie, 'Owner CM');
    const memberMaskA = await createMask(app, memberCookie, 'Member CM A');
    const memberMaskB = await createMask(app, memberCookie, 'Member CM B');

    const createServerResponse = await app.inject({
      method: 'POST',
      url: '/servers',
      headers: { cookie: ownerCookie },
      payload: {
        name: 'Guild Channel Mask',
      },
    });
    expect(createServerResponse.statusCode).toBe(201);
    const server = CreateServerResponseSchema.parse(createServerResponse.json()).server;
    expect(server.channelIdentityMode).toBe('SERVER_MASK');

    const createInviteResponse = await app.inject({
      method: 'POST',
      url: `/servers/${server.id}/invites`,
      headers: { cookie: ownerCookie },
      payload: {},
    });
    expect(createInviteResponse.statusCode).toBe(201);
    const invite = CreateServerInviteResponseSchema.parse(createInviteResponse.json()).invite;

    const joinServerResponse = await app.inject({
      method: 'POST',
      url: '/servers/join',
      headers: { cookie: memberCookie },
      payload: {
        inviteCode: invite.code,
        serverMaskId: memberMaskA.id,
      },
    });
    expect(joinServerResponse.statusCode).toBe(200);

    const memberPatchSettingsForbidden = await app.inject({
      method: 'PATCH',
      url: `/servers/${server.id}/settings`,
      headers: { cookie: memberCookie },
      payload: {
        channelIdentityMode: 'CHANNEL_MASK',
      },
    });
    expect(memberPatchSettingsForbidden.statusCode).toBe(403);

    const ownerPatchSettingsResponse = await app.inject({
      method: 'PATCH',
      url: `/servers/${server.id}/settings`,
      headers: { cookie: ownerCookie },
      payload: {
        channelIdentityMode: 'CHANNEL_MASK',
      },
    });
    expect(ownerPatchSettingsResponse.statusCode).toBe(200);
    expect(ownerPatchSettingsResponse.json().server.channelIdentityMode).toBe('CHANNEL_MASK');

    const memberServerDetailsResponse = await app.inject({
      method: 'GET',
      url: `/servers/${server.id}`,
      headers: { cookie: memberCookie },
    });
    expect(memberServerDetailsResponse.statusCode).toBe(200);
    const memberServerDetails = GetServerResponseSchema.parse(memberServerDetailsResponse.json());
    const generalChannel = memberServerDetails.channels[0];
    expect(generalChannel).toBeDefined();

    const memberSetChannelMaskResponse = await app.inject({
      method: 'POST',
      url: `/channels/${generalChannel.id}/mask`,
      headers: { cookie: memberCookie },
      payload: {
        maskId: memberMaskB.id,
      },
    });
    expect(memberSetChannelMaskResponse.statusCode).toBe(200);
    expect(memberSetChannelMaskResponse.json().mask.maskId).toBe(memberMaskB.id);

    const ownerSetChannelMaskForbidden = await app.inject({
      method: 'POST',
      url: `/channels/${generalChannel.id}/mask`,
      headers: { cookie: ownerCookie },
      payload: {
        maskId: memberMaskA.id,
      },
    });
    expect(ownerSetChannelMaskForbidden.statusCode).toBe(403);

    const ownerSetOwnerChannelMaskResponse = await app.inject({
      method: 'POST',
      url: `/channels/${generalChannel.id}/mask`,
      headers: { cookie: ownerCookie },
      payload: {
        maskId: ownerMask.id,
      },
    });
    expect(ownerSetOwnerChannelMaskResponse.statusCode).toBe(200);
    expect(ownerSetOwnerChannelMaskResponse.json().mask.maskId).toBe(ownerMask.id);
  });
});




