export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  disconnectGoogleAccount,
  disconnectGoogleCalendar,
} from "@/lib/googleCalendar";

interface DisconnectBody {
  accountId?: string;
}

export async function POST(req: Request) {
  let body: DisconnectBody = {};
  try {
    if (req.headers.get("content-length") !== "0") {
      body = (await req.json().catch(() => ({}))) as DisconnectBody;
    }
  } catch {
    /* ignore */
  }
  try {
    if (body.accountId) {
      await disconnectGoogleAccount(body.accountId);
      return NextResponse.json({
        ok: true,
        message: "Google account disconnected.",
        accountId: body.accountId,
      });
    }
    await disconnectGoogleCalendar();
    return NextResponse.json({
      ok: true,
      message: "All Google accounts disconnected.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Disconnect failed";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
