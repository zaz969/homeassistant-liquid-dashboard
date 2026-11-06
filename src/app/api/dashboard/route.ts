import { NextResponse } from "next/server";
import { z } from "zod";
import { emptyDashboard, normalizeLayout } from "@/lib/dashboard";
import { getDatabase } from "@/lib/database";

const saveRequestSchema = z.object({
  revision: z.number().int().nonnegative(),
  layout: z.unknown(),
});

function readDashboard() {
  const row = getDatabase()
    .prepare("SELECT revision, layout_json, updated_at FROM dashboards WHERE id = ?")
    .get("main") as
    | { revision: number; layout_json: string; updated_at: string }
    | undefined;

  if (!row) {
    return { revision: 0, layout: emptyDashboard, updatedAt: null };
  }

  try {
    return {
      revision: row.revision,
      layout: normalizeLayout(JSON.parse(row.layout_json)),
      updatedAt: row.updated_at,
    };
  } catch {
    return {
      revision: row.revision,
      layout: emptyDashboard,
      updatedAt: row.updated_at,
      invalidStoredLayout: true,
    };
  }
}

export async function GET() {
  return NextResponse.json(readDashboard(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PUT(request: Request) {
  let body: z.infer<typeof saveRequestSchema>;
  try {
    body = saveRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid dashboard data." }, { status: 400 });
  }

  let layout;
  try {
    layout = normalizeLayout(body.layout);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid dashboard layout." },
      { status: 400 },
    );
  }

  const database = getDatabase();
  const save = database.transaction(() => {
    const current = database
      .prepare("SELECT revision FROM dashboards WHERE id = ?")
      .get("main") as { revision: number } | undefined;
    const revision = current?.revision ?? 0;

    if (revision !== body.revision) return null;

    const nextRevision = revision + 1;
    const updatedAt = new Date().toISOString();
    database
      .prepare(
        `INSERT INTO dashboards (id, revision, layout_json, updated_at)
         VALUES ('main', ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           revision = excluded.revision,
           layout_json = excluded.layout_json,
           updated_at = excluded.updated_at`,
      )
      .run(nextRevision, JSON.stringify(layout), updatedAt);
    return { revision: nextRevision, layout, updatedAt };
  });

  const saved = save();
  if (!saved) {
    return NextResponse.json(
      { error: "The dashboard changed on another device.", current: readDashboard() },
      { status: 409 },
    );
  }

  return NextResponse.json(saved, { headers: { "Cache-Control": "no-store" } });
}
