import { NextResponse } from "next/server";

import { generateBrewPlan } from "@/lib/brewing/plan";
import type { PlanRequest } from "@/lib/brewing/types";

export async function POST(request: Request) {
  const body = (await request.json()) as PlanRequest;

  if (!body.forecast || !Array.isArray(body.inventoryRecords)) {
    return NextResponse.json({ error: "forecast と inventoryRecords が必要です" }, { status: 400 });
  }

  const plan = generateBrewPlan(body);
  return NextResponse.json(plan);
}
