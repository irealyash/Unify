import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/current-user";
import { ZodError } from "zod";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(error: unknown, fallbackStatus = 500) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message ?? "Validation failed" },
      { status: 400 },
    );
  }
  if (error instanceof Error) {
    const status =
      /unauthorized|not authorized/i.test(error.message)
        ? 403
        : /not found/i.test(error.message)
          ? 404
          : /already|cannot|invalid|must|too quickly|elsewhere|reserved|taken/i.test(
                error.message,
              )
            ? 400
            : fallbackStatus;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ error: "Unexpected error" }, { status: fallbackStatus });
}
