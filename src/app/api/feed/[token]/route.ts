import { getDb } from "../../../../server/config/db";
import { getConfig } from "../../../../server/config/import";
import { getPresetIdByToken } from "../../../../server/feeds/tokens";
import { buildPresetFeed } from "../../../../server/feeds/ics-writer";
import type { Preset } from "../../../../types";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();

  const presetId = getPresetIdByToken(db, token);
  const preset = presetId ? (getConfig(db, "presets") as Preset[]).find((p) => p.id === presetId) : undefined;
  if (!preset) return new Response("Not found", { status: 404 });

  return new Response(buildPresetFeed(db, preset), {
    status: 200,
    headers: { "Content-Type": "text/calendar; charset=utf-8" },
  });
}
