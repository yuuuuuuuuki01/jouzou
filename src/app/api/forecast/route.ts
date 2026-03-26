import { NextResponse } from "next/server";

import { generateForecast } from "@/lib/brewing/forecast";
import type { ForecastRequest } from "@/lib/brewing/types";

export async function POST(request: Request) {
  const body = (await request.json()) as ForecastRequest;

  if (!Array.isArray(body.salesRecords) || body.salesRecords.length === 0) {
    return NextResponse.json({ error: "salesRecords が必要です" }, { status: 400 });
  }

  const forecast = generateForecast(body);
  return NextResponse.json(forecast);
}
