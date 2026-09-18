import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      type?: string;
      message?: string;
      stack?: string;
      path?: string;
      target?: string;
      details?: Record<string, unknown>;
    };

    console.error("CLIENT_DIAGNOSTIC", JSON.stringify({
      type: payload.type ?? "unknown",
      message: payload.message ?? "",
      stack: payload.stack ?? "",
      path: payload.path ?? "",
      target: payload.target ?? "",
      details: payload.details ?? {},
    }));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
