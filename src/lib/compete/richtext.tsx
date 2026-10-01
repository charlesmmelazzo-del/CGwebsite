// A tiny, safe formatter for admin-written text (rules, stories, hints).
//
//   ### Heading      → heading
//   - item           → bullet
//   **bold**  *em*   → inline emphasis
//   blank line       → new paragraph
//
// Builds React elements directly — never HTML strings — so nothing typed into
// the admin panel (or a contestant form) can inject markup.

import { Fragment, type ReactNode } from "react";

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={`${keyBase}-b${i++}`}>{m[1]}</strong>);
    else out.push(<em key={`${keyBase}-i${i++}`}>{m[2]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function InlineText({ text }: { text: string }) {
  return <>{inline(text, "x")}</>;
}

export function RichText({
  text,
  className,
  headingClassName = "",
}: {
  text: string;
  className?: string;
  headingClassName?: string;
}) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (para.length) {
      const k = `p${blocks.length}`;
      blocks.push(
        <p key={k}>
          {para.map((l, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              {inline(l, `${k}-${i}`)}
            </Fragment>
          ))}
        </p>
      );
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      const k = `l${blocks.length}`;
      blocks.push(
        <ul key={k}>
          {list.map((l, i) => (
            <li key={i}>{inline(l, `${k}-${i}`)}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#{1,3}\s+/.test(line)) {
      flushPara();
      flushList();
      const k = `h${blocks.length}`;
      blocks.push(
        <h3 key={k} className={headingClassName}>
          {inline(line.replace(/^#{1,3}\s+/, ""), k)}
        </h3>
      );
    } else if (/^[-•]\s+/.test(line)) {
      flushPara();
      list.push(line.replace(/^[-•]\s+/, ""));
    } else if (line.trim() === "") {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();

  return <div className={className}>{blocks}</div>;
}
