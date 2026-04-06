import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import type { PagesData, PageDocument } from "@/types";

const DATA_DIR  = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "pages.json");

function readData(): PagesData {
  if (!existsSync(DATA_FILE)) {
    return { pages: [] };
  }
  return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
}

function writeData(data: PagesData) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET — return all pages
export async function GET() {
  return NextResponse.json(readData());
}

// POST — upsert a page (create or update by pageId)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = readData();
  const page: PageDocument = { ...body, updatedAt: new Date().toISOString() };
  const idx = data.pages.findIndex((p) => p.pageId === page.pageId);
  if (idx >= 0) {
    data.pages[idx] = page;
  } else {
    data.pages.push(page);
  }
  writeData(data);
  return NextResponse.json({ success: true, page });
}

// DELETE — remove a page by pageId
export async function DELETE(req: NextRequest) {
  const { pageId } = await req.json();
  const data = readData();
  data.pages = data.pages.filter((p) => p.pageId !== pageId);
  writeData(data);
  return NextResponse.json({ success: true });
}
