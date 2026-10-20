import { guardRoute } from "@/lib/route-guard";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseGLBuffer, LedgerHeaderError } from "@/lib/parser";
import { MAX_LEDGER_BYTES, LEDGER_SIZE_MESSAGE } from "@/lib/upload-limits";

export async function POST(req: Request) {
  const denied = await guardRoute(req);
  if (denied) return denied;
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const writeCompany = (session!.user as { companyId?: string }).companyId;
  if (!writeCompany)
    return NextResponse.json(
      { error: "No company assigned." },
      { status: 403 },
    );
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file)
      return NextResponse.json({ error: "No file provided" }, { status: 400 });

    // Validate type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    const isValidExt = file.name.match(/\.(xlsx|xls|csv)$/i);
    if (!validTypes.includes(file.type) && !isValidExt) {
      return NextResponse.json(
        { error: "Invalid file type. Upload a .xlsx, .xls, or .csv file." },
        { status: 400 },
      );
    }

    if (!file.size || file.size > MAX_LEDGER_BYTES) {
      return NextResponse.json(
        { error: LEDGER_SIZE_MESSAGE },
        { status: 400 },
      );
    }

    const buffer = await file.arrayBuffer();
    const result = parseGLBuffer(buffer, file.name);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof LedgerHeaderError
            ? error.message
            : "Failed to parse this ledger. Check its format and try selecting the file again.",
      },
      { status: 400 },
    );
  }
}
