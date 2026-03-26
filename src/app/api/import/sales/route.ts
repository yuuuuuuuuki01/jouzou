import { NextResponse } from "next/server";

import { importSalesRecords } from "@/lib/brewing/parser";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file を添付してください" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const result = importSalesRecords(buffer);
  return NextResponse.json(result);
}
