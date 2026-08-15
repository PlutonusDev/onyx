import { checkAuth } from "@/lib/credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Report whether this machine has a usable local login. */
export async function GET() {
  return Response.json(await checkAuth(), {
    headers: { "cache-control": "no-store" },
  });
}

/** Same probe, re-run on demand by the "Re-check" button. */
export async function POST() {
  return Response.json(await checkAuth(), {
    headers: { "cache-control": "no-store" },
  });
}
