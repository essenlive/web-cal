import { NextResponse } from "next/server";
import { MAX_RELAY_BYTES, isValidRoom, isValidSlot, putSlot, takeSlot } from "../../../../../server/relay";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ room: string; slot: string }> };

/** Public on purpose (client-only devices have no session): the payload is end-to-end encrypted, short-lived and read-once. */
export async function PUT(request: Request, { params }: Ctx) {
  const { room, slot } = await params;
  if (!isValidRoom(room) || !isValidSlot(slot)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const body = await request.text();
  if (body.length === 0 || body.length > MAX_RELAY_BYTES) return NextResponse.json({ error: "payload size" }, { status: 413 });
  if (!putSlot(room, slot, body)) return NextResponse.json({ error: "relay full" }, { status: 503 });
  return new NextResponse(null, { status: 204 });
}

export async function GET(_request: Request, { params }: Ctx) {
  const { room, slot } = await params;
  if (!isValidRoom(room) || !isValidSlot(slot)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const body = takeSlot(room, slot);
  if (body === null) return new NextResponse(null, { status: 204 });
  return new NextResponse(body, { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
