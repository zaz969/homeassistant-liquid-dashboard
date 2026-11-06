import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/lib/database";
import { defaultTheme, normalizeTheme } from "@/lib/theme";

const saveRequestSchema = z.object({
  revision: z.number().int().nonnegative(),
  theme: z.unknown(),
}).strict();

function readSettings() {
  const row = getDatabase()
    .prepare("SELECT revision, value_json, updated_at FROM app_settings WHERE id = ?")
    .get("main") as
    | { revision: number; value_json: string; updated_at: string }
    | undefined;

  if (!row) return { revision: 0, theme: defaultTheme, updatedAt: null };
  try {
    return {
      revision: row.revision,
      theme: normalizeTheme(JSON.parse(row.value_json)),
      updatedAt: row.updated_at,
    };
  } catch {
    return {
      revision: row.revision,
      theme: defaultTheme,
      updatedAt: row.updated_at,
      invalidStoredTheme: true,
    };
  }
}

export async function GET() {
  return NextResponse.json(readSettings(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PUT(request: Request) {
  let body: z.infer<typeof saveRequestSchema>;
  try {
    body = saveRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid settings data." }, { status: 400 });
  }

  let theme;
  try {
    theme = normalizeTheme(body.theme);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid theme settings." },
      { status: 400 },
    );
  }

  const database = getDatabase();
  const save = database.transaction(() => {
    const current = database
      .prepare("SELECT revision FROM app_settings WHERE id = ?")
      .get("main") as { revision: number } | undefined;
    const revision = current?.revision ?? 0;
    if (revision !== body.revision) return null;

    const nextRevision = revision + 1;
    const updatedAt = new Date().toISOString();
    database
      .prepare(
        `INSERT INTO app_settings (id, revision, value_json, updated_at)
         VALUES ('main', ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           revision = excluded.revision,
           value_json = excluded.value_json,
           updated_at = excluded.updated_at`,
      )
      .run(nextRevision, JSON.stringify(theme), updatedAt);
    return { revision: nextRevision, theme, updatedAt };
  });

  const saved = save();
  if (!saved) {
    return NextResponse.json(
      { error: "Settings changed on another device.", current: readSettings() },
      { status: 409 },
    );
  }

  return NextResponse.json(saved, { headers: { "Cache-Control": "no-store" } });
}
