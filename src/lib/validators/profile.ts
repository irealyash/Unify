import { z } from "zod";

export const onboardingSchema = z.object({
  username: z.string().min(3).max(20),
  displayName: z.string().trim().min(1).max(80).optional(),
  selfText: z
    .string()
    .trim()
    .min(40, "Tell us a bit more about who you are (at least 40 characters)")
    .max(4000),
  seekingText: z
    .string()
    .trim()
    .min(40, "Tell us a bit more about who you're looking for (at least 40 characters)")
    .max(4000),
});

export const assistantMessageSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

export const assistantResponseSchema = z.object({
  assistant_message: z.string(),
  should_update: z.boolean(),
  updated_profile: z.string().nullable(),
  changes_summary: z.array(z.string()).default([]),
});

export type AssistantResponse = z.infer<typeof assistantResponseSchema>;
