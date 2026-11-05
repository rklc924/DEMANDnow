import { NextResponse } from "next/server";
import { jobFromToken } from "@/lib/service";
import { readUpload } from "@/lib/store";

// Process server's download link. Access is the unguessable token in their link.
export async function GET(_req: Request, { params }: { params: { token: string; n: string } }) {
  const job = await jobFromToken(decodeURIComponent(params.token));
  const file = job?.files[Number(params.n)];
  if (!job || !file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(await readUpload(file.key), {
    headers: { "Content-Type": file.mime, "Content-Disposition": `inline; filename="${file.name.replace(/"/g, "")}"`, "Cache-Control": "private, no-store" },
  });
}
