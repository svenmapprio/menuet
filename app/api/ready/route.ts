import { NextResponse } from "next/server";

export const GET = async () => {
  console.log("next ready");
  return NextResponse.json({ ready: true });
};
