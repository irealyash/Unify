import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  biomes,
  groupQuestions,
  groups,
  type QuestionOption,
} from "@/lib/db/schema";
import {
  DEFAULT_BIOMES,
  DEFAULT_QUESTIONS,
  generateGroupCode,
  normalizeGroupCode,
} from "@/lib/groups/defaults";
import { embedText, getEmbeddingModel, vectorToSqlLiteral } from "@/lib/embeddings";

export type CreateGroupInput = {
  name: string;
  description?: string;
  code?: string;
  createdByUserId?: string;
  questions?: Array<{
    prompt: string;
    questionType: "multiple_choice" | "free_text";
    options: QuestionOption[];
    required?: boolean;
  }>;
};

export async function createGroup(input: CreateGroupInput) {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Group name is required");

  let code = input.code?.trim() ? normalizeGroupCode(input.code) : generateGroupCode();
  if (!/^[A-Z0-9]{4,12}$/.test(code)) {
    throw new Error("Code must be 4–12 letters or numbers");
  }

  // Ensure unique code
  for (let attempt = 0; attempt < 5; attempt++) {
    const [existing] = await db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.codeNormalized, code))
      .limit(1);
    if (!existing) break;
    if (input.code?.trim()) throw new Error("That group code is already taken");
    code = generateGroupCode();
  }

  const [group] = await db
    .insert(groups)
    .values({
      code,
      codeNormalized: code,
      name,
      description: input.description?.trim() || "",
      createdByUserId: input.createdByUserId,
    })
    .returning();

  const questionDefs = input.questions?.length ? input.questions : DEFAULT_QUESTIONS;

  await db.insert(groupQuestions).values(
    questionDefs.map((q, index) => ({
      groupId: group.id,
      sortOrder: index,
      prompt: q.prompt.trim(),
      questionType: q.questionType,
      options: q.questionType === "multiple_choice" ? q.options : [],
      required: q.required ?? q.questionType !== "free_text",
    })),
  );

  const model = getEmbeddingModel();
  for (let i = 0; i < DEFAULT_BIOMES.length; i++) {
    const biome = DEFAULT_BIOMES[i]!;
    const embedding = await embedText(biome.styleSummary);
    const literal = vectorToSqlLiteral(embedding);
    const [row] = await db
      .insert(biomes)
      .values({
        groupId: group.id,
        name: biome.name,
        description: biome.description,
        styleSummary: biome.styleSummary,
        themeKey: biome.themeKey,
        embeddingModel: model,
        sortOrder: i,
      })
      .returning();

    await db.execute(sql`
      UPDATE biomes
      SET centroid_embedding = ${literal}::vector
      WHERE id = ${row.id}::uuid
    `);
  }

  return getGroupById(group.id);
}

export async function getGroupByCode(code: string) {
  const normalized = normalizeGroupCode(code);
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.codeNormalized, normalized))
    .limit(1);
  if (!group) return null;
  return getGroupById(group.id);
}

export async function getGroupById(groupId: string) {
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) return null;

  const questions = await db
    .select()
    .from(groupQuestions)
    .where(eq(groupQuestions.groupId, groupId))
    .orderBy(asc(groupQuestions.sortOrder));

  const biomeRows = await db
    .select({
      id: biomes.id,
      name: biomes.name,
      description: biomes.description,
      themeKey: biomes.themeKey,
      sortOrder: biomes.sortOrder,
    })
    .from(biomes)
    .where(eq(biomes.groupId, groupId))
    .orderBy(asc(biomes.sortOrder));

  return { ...group, questions, biomes: biomeRows };
}

export async function updateGroupQuestions(
  groupId: string,
  questions: Array<{
    prompt: string;
    questionType: "multiple_choice" | "free_text";
    options: QuestionOption[];
    required?: boolean;
  }>,
) {
  if (!questions.length) throw new Error("Add at least one question");

  await db.delete(groupQuestions).where(eq(groupQuestions.groupId, groupId));
  await db.insert(groupQuestions).values(
    questions.map((q, index) => ({
      groupId,
      sortOrder: index,
      prompt: q.prompt.trim(),
      questionType: q.questionType,
      options: q.questionType === "multiple_choice" ? q.options : [],
      required: q.required ?? q.questionType !== "free_text",
    })),
  );

  return getGroupById(groupId);
}
