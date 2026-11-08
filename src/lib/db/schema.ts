import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const questionTypeEnum = pgEnum("question_type", [
  "multiple_choice",
  "free_text",
]);

export type QuestionOption = {
  id: string;
  label: string;
  /** Text blended into the working-style embedding for this choice */
  embeddingHint: string;
};

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    codeNormalized: text("code_normalized").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("groups_code_normalized_uidx").on(table.codeNormalized),
  ],
);

export const groupQuestions = pgTable(
  "group_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    prompt: text("prompt").notNull(),
    questionType: questionTypeEnum("question_type").notNull().default("multiple_choice"),
    options: jsonb("options").$type<QuestionOption[]>().notNull().default(sql`'[]'::jsonb`),
    required: boolean("required").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("group_questions_group_idx").on(table.groupId, table.sortOrder)],
);

export const biomes = pgTable(
  "biomes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** Working-style description used to build the biome centroid embedding */
    styleSummary: text("style_summary").notNull(),
    themeKey: text("theme_key").notNull().default("forest"),
    centroidEmbedding: vector("centroid_embedding", { dimensions: 768 }),
    embeddingModel: text("embedding_model").notNull().default("gemini-embedding-001"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("biomes_group_idx").on(table.groupId),
    index("biomes_centroid_idx").using(
      "hnsw",
      table.centroidEmbedding.op("vector_cosine_ops"),
    ),
  ],
);

export const participants = pgTable(
  "participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    biomeId: uuid("biome_id").references(() => biomes.id, { onDelete: "set null" }),
    officialName: text("official_name").notNull(),
    sessionToken: text("session_token").notNull(),
    freeText: text("free_text").notNull().default(""),
    workingStyleText: text("working_style_text").notNull().default(""),
    embedding: vector("embedding", { dimensions: 768 }),
    embeddingModel: text("embedding_model").notNull().default("gemini-embedding-001"),
    quizCompletedAt: timestamp("quiz_completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("participants_session_token_uidx").on(table.sessionToken),
    index("participants_group_idx").on(table.groupId),
    index("participants_biome_idx").on(table.biomeId),
    index("participants_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export const participantAnswers = pgTable(
  "participant_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => groupQuestions.id, { onDelete: "cascade" }),
    selectedOptionId: text("selected_option_id"),
    freeTextAnswer: text("free_text_answer"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("participant_answers_unique_uidx").on(
      table.participantId,
      table.questionId,
    ),
  ],
);

export const groupsRelations = relations(groups, ({ many }) => ({
  questions: many(groupQuestions),
  biomes: many(biomes),
  participants: many(participants),
}));

export const biomesRelations = relations(biomes, ({ one, many }) => ({
  group: one(groups, { fields: [biomes.groupId], references: [groups.id] }),
  participants: many(participants),
}));

export const participantsRelations = relations(participants, ({ one, many }) => ({
  group: one(groups, { fields: [participants.groupId], references: [groups.id] }),
  biome: one(biomes, { fields: [participants.biomeId], references: [biomes.id] }),
  answers: many(participantAnswers),
}));

export type Group = typeof groups.$inferSelect;
export type GroupQuestion = typeof groupQuestions.$inferSelect;
export type Biome = typeof biomes.$inferSelect;
export type Participant = typeof participants.$inferSelect;
