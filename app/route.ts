import { readFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";

export async function GET() {
  const filePath = join(process.cwd(), "app", "static", "index.html");
  const html = readFileSync(filePath, "utf-8");
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // small cache for HTML
      "Cache-Control": "public, max-age=0, s-maxage=60"
    }
  });
}
