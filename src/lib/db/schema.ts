import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const friendshipStatusEnum = pgEnum("friendship_status", [
  "pending",
  "accepted",
  "declined",
  "blocked",
]);

export const assistantTypeEnum = pgEnum("assistant_type", ["self", "seeking"]);

export const messageRoleEnum = pgEnum("message_role", ["user", "assistant", "system"]);

export const ubcVerificationStatusEnum = pgEnum("ubc_verification_status", [
  "pending",
  "verified",
  "rejected",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "friend_request_received",
  "friend_request_accepted",
  "new_message",
  "connection_event",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    username: text("username"),
    usernameNormalized: text("username_normalized"),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    interests: text("interests").array().default(sql`'{}'::text[]`),
    skills: text("skills").array().default(sql`'{}'::text[]`),
    isUbcStudentClaim: boolean("is_ubc_student_claim").notNull().default(false),
    isUbcVerified: boolean("is_ubc_verified").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_clerk_user_id_uidx").on(table.clerkUserId),
    uniqueIndex("users_username_normalized_uidx").on(table.usernameNormalized),
    index("users_active_idx").on(table.isActive),
  ],
);

export const userProfiles = pgTable(
  "user_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    selfText: text("self_text").notNull().default(""),
    seekingText: text("seeking_text").notNull().default(""),
    publicSummary: text("public_summary").notNull().default(""),
    selfEmbedding: vector("self_embedding", { dimensions: 768 }),
    seekingEmbedding: vector("seeking_embedding", { dimensions: 768 }),
    embeddingModel: text("embedding_model").notNull().default("gemini-embedding-001"),
    selfVersion: integer("self_version").notNull().default(0),
    seekingVersion: integer("seeking_version").notNull().default(0),
    profileVersion: integer("profile_version").notNull().default(0),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("user_profiles_self_embedding_idx").using(
      "hnsw",
      table.selfEmbedding.op("vector_cosine_ops"),
    ),
    index("user_profiles_seeking_embedding_idx").using(
      "hnsw",
      table.seekingEmbedding.op("vector_cosine_ops"),
    ),
    index("user_profiles_onboarding_idx").on(table.onboardingCompletedAt),
  ],
);

export const profileAssistantMessages = pgTable(
  "profile_assistant_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assistantType: assistantTypeEnum("assistant_type").notNull(),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("profile_assistant_messages_user_type_idx").on(
      table.userId,
      table.assistantType,
      table.createdAt,
    ),
  ],
);

export const profileVersions = pgTable(
  "profile_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assistantType: assistantTypeEnum("assistant_type").notNull(),
    profileText: text("profile_text").notNull(),
    version: integer("version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("profile_versions_user_type_version_uidx").on(
      table.userId,
      table.assistantType,
      table.version,
    ),
  ],
);

export const ubcVerifications = pgTable(
  "ubc_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    educationEmail: text("education_email").notNull(),
    educationEmailNormalized: text("education_email_normalized").notNull(),
    clerkEmailId: text("clerk_email_id"),
    status: ubcVerificationStatusEnum("status").notNull().default("pending"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ubc_verifications_user_idx").on(table.userId),
    uniqueIndex("ubc_verifications_email_uidx").on(table.educationEmailNormalized),
  ],
);

export const friendships = pgTable(
  "friendships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userLowId: uuid("user_low_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userHighId: uuid("user_high_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendshipStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("friendships_pair_uidx").on(table.userLowId, table.userHighId),
    index("friendships_status_idx").on(table.status),
    index("friendships_requested_by_idx").on(table.requestedBy),
    check("friendships_order_check", sql`${table.userLowId} < ${table.userHighId}`),
    check("friendships_not_self_check", sql`${table.userLowId} <> ${table.userHighId}`),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    friendshipId: uuid("friendship_id")
      .notNull()
      .references(() => friendships.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("conversations_friendship_uidx").on(table.friendshipId)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    index("messages_conversation_created_idx").on(table.conversationId, table.createdAt),
    check("messages_content_length_check", sql`char_length(${table.content}) BETWEEN 1 AND 4000`),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    type: notificationTypeEnum("type").notNull(),
    entityId: text("entity_id"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_recipient_created_idx").on(table.recipientId, table.createdAt),
    index("notifications_recipient_unread_idx").on(table.recipientId, table.readAt),
  ],
);

export const blockedUsers = pgTable(
  "blocked_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("blocked_users_pair_uidx").on(table.blockerId, table.blockedId),
    check("blocked_users_not_self_check", sql`${table.blockerId} <> ${table.blockedId}`),
  ],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  assistantMessages: many(profileAssistantMessages),
  profileVersions: many(profileVersions),
  notifications: many(notifications),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type Friendship = typeof friendships.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
