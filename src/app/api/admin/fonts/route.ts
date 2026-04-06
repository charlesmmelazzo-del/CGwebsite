import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const DATA_DIR  = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "fonts.json");

function readData() {
  if (!existsSync(DATA_FILE)) {
    return { fonts: [], assignments: { display: null, body: null, nav: null, button: null, label: null } };
  }
  return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
}

function writeData(data: object) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET — return all font data (fonts list + assignments)
export async function GET() {
  return NextResponse.json(readData());
}

// POST — update assignments or add a font entry
export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = readData();

  if (body.action === "updateAssignments") {
    data.assignments = { ...data.assignments, ...body.assignments };
  } else if (body.action === "addFont") {
    data.fonts = [...data.fonts, body.font];
  }

  writeData(data);
  return NextResponse.json({ success: true, data });
}

// DELETE — remove a font entry by id
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const data = readData();
  data.fonts = data.fonts.filter((f: { id: string }) => f.id !== id);
  writeData(data);
  return NextResponse.json({ success: true });
}
