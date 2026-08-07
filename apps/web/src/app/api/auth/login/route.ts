import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { password } = await request.json();
  const demoPassword = process.env.DEMO_PASSWORD ?? "demo";

  if (password !== demoPassword) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("medicronis-auth", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return response;
}
