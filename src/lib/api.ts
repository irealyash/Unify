import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(error: unknown, fallbackStatus = 500) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message ?? "Validation failed" },
      { status: 400 },
    );
  }
  if (error instanceof Error) {
    const status =
      /not found|no group|session expired/i.test(error.message)
        ? 404
        : /already|cannot|invalid|must|required|taken|enter|add at least/i.test(
              error.message,
            )
          ? 400
          : fallbackStatus;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ error: "Unexpected error" }, { status: fallbackStatus });
}
