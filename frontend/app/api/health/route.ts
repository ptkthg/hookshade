const BACKEND = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000";

export async function GET() {
  try {
    const response = await fetch(new URL("/health", BACKEND), {
      cache: "no-store", signal: AbortSignal.timeout(65_000), redirect: "manual",
    });
    return Response.json({ status: response.ok ? "ok" : "unavailable" }, { status: response.ok ? 200 : 503 });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
