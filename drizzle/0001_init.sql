CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TYPE "public"."assistant_type" AS ENUM('self', 'seeking');
--> statement-breakpoint
CREATE TYPE "public"."friendship_status" AS ENUM('pending', 'accepted', 'declined', 'blocked');
--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');
--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('friend_request_received', 'friend_request_accepted', 'new_message', 'connection_event');
--> statement-breakpoint
CREATE TYPE "public"."ubc_verification_status" AS ENUM('pending', 'verified', 'rejected');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"username" text,
	"username_normalized" text,
	"display_name" text,
	"avatar_url" text,
	"bio" text,
	"interests" text[] DEFAULT '{}'::text[],
	"skills" text[] DEFAULT '{}'::text[],
	"is_ubc_student_claim" boolean DEFAULT false NOT NULL,
	"is_ubc_verified" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"self_text" text DEFAULT '' NOT NULL,
	"seeking_text" text DEFAULT '' NOT NULL,
	"public_summary" text DEFAULT '' NOT NULL,
	"self_embedding" vector(768),
	"seeking_embedding" vector(768),
	"embedding_model" text DEFAULT 'gemini-embedding-001' NOT NULL,
	"self_version" integer DEFAULT 0 NOT NULL,
	"seeking_version" integer DEFAULT 0 NOT NULL,
	"profile_version" integer DEFAULT 0 NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_assistant_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"assistant_type" "assistant_type" NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"assistant_type" "assistant_type" NOT NULL,
	"profile_text" text NOT NULL,
	"version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ubc_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"education_email" text NOT NULL,
	"education_email_normalized" text NOT NULL,
	"clerk_email_id" text,
	"status" "ubc_verification_status" DEFAULT 'pending' NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_low_id" uuid NOT NULL,
	"user_high_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"status" "friendship_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_order_check" CHECK ("user_low_id" < "user_high_id"),
	CONSTRAINT "friendships_not_self_check" CHECK ("user_low_id" <> "user_high_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"friendship_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "messages_content_length_check" CHECK (char_length("content") BETWEEN 1 AND 4000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"actor_id" uuid,
	"type" "notification_type" NOT NULL,
	"entity_id" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blocked_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocked_users_not_self_check" CHECK ("blocker_id" <> "blocked_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_assistant_messages" ADD CONSTRAINT "profile_assistant_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_versions" ADD CONSTRAINT "profile_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ubc_verifications" ADD CONSTRAINT "ubc_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_low_id_users_id_fk" FOREIGN KEY ("user_low_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_high_id_users_id_fk" FOREIGN KEY ("user_high_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_friendship_id_friendships_id_fk" FOREIGN KEY ("friendship_id") REFERENCES "public"."friendships"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_clerk_user_id_uidx" ON "users" USING btree ("clerk_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_normalized_uidx" ON "users" USING btree ("username_normalized");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_active_idx" ON "users" USING btree ("is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_profiles_self_embedding_idx" ON "user_profiles" USING hnsw ("self_embedding" vector_cosine_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_profiles_seeking_embedding_idx" ON "user_profiles" USING hnsw ("seeking_embedding" vector_cosine_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_profiles_onboarding_idx" ON "user_profiles" USING btree ("onboarding_completed_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_assistant_messages_user_type_idx" ON "profile_assistant_messages" USING btree ("user_id","assistant_type","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "profile_versions_user_type_version_uidx" ON "profile_versions" USING btree ("user_id","assistant_type","version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ubc_verifications_user_idx" ON "ubc_verifications" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ubc_verifications_email_uidx" ON "ubc_verifications" USING btree ("education_email_normalized");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "friendships_pair_uidx" ON "friendships" USING btree ("user_low_id","user_high_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "friendships_status_idx" ON "friendships" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "friendships_requested_by_idx" ON "friendships" USING btree ("requested_by");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_friendship_uidx" ON "conversations" USING btree ("friendship_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_recipient_created_idx" ON "notifications" USING btree ("recipient_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_recipient_unread_idx" ON "notifications" USING btree ("recipient_id","read_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "blocked_users_pair_uidx" ON "blocked_users" USING btree ("blocker_id","blocked_id");
