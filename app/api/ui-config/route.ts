import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { uiConfigSchema } from "@/lib/ui-config/schema";
import { DEFAULT_UI_CONFIG } from "@/lib/ui-config/defaults";

export async function GET() {
  try {
    const row = await prisma.uiConfig.findUnique({ where: { id: "singleton" } });
    if (!row) {
      return NextResponse.json(DEFAULT_UI_CONFIG);
    }
    const parsed = uiConfigSchema.safeParse(JSON.parse(row.config));
    if (!parsed.success) {
      return NextResponse.json(DEFAULT_UI_CONFIG);
    }
    return NextResponse.json(parsed.data);
  } catch {
    return NextResponse.json(DEFAULT_UI_CONFIG);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = uiConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid UI config", details: parsed.error.issues },
        { status: 400 },
      );
    }
    await prisma.uiConfig.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", config: JSON.stringify(parsed.data) },
      update: { config: JSON.stringify(parsed.data) },
    });
    return NextResponse.json({ success: true, config: parsed.data });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to save config", detail: String(err) },
      { status: 500 },
    );
  }
}
