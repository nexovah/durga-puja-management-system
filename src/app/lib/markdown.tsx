// Minimal Markdown subset shared by every CMS page (About / Terms / Privacy /
// Refund): headings (## / ###), **bold**, *italic*, "- " bullet lists, blank
// line = new paragraph. Deliberately not a full CommonMark parser — this only
// supports what SuperAdminCms's toolbar (below) can insert, so editor and
// renderer never drift apart. Mirrored (not shared, different bundlers) at
// mobile/src/lib/markdown.tsx — keep both in sync if the syntax changes.

export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export type MdBlock =
  | { type: 'h2'; runs: InlineRun[] }
  | { type: 'h3'; runs: InlineRun[] }
  | { type: 'p'; runs: InlineRun[] }
  | { type: 'ul'; items: InlineRun[][] };

function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    if (m[1] !== undefined) runs.push({ text: m[1], bold: true });
    else if (m[2] !== undefined) runs.push({ text: m[2], italic: true });
    last = re.lastIndex;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.length ? runs : [{ text: '' }];
}

export function parseMarkdown(body: string): MdBlock[] {
  const lines = (body || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: MdBlock[] = [];
  let para: string[] = [];
  let listItems: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: 'p', runs: parseInline(para.join(' ')) });
      para = [];
    }
  };
  const flushList = () => {
    if (listItems.length) {
      blocks.push({ type: 'ul', items: listItems.map(parseInline) });
      listItems = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') {
      flushPara();
      flushList();
      continue;
    }
    if (line.startsWith('### ')) {
      flushPara();
      flushList();
      blocks.push({ type: 'h3', runs: parseInline(line.slice(4)) });
      continue;
    }
    if (line.startsWith('## ')) {
      flushPara();
      flushList();
      blocks.push({ type: 'h2', runs: parseInline(line.slice(3)) });
      continue;
    }
    if (line.startsWith('- ')) {
      flushPara();
      listItems.push(line.slice(2));
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

function renderRuns(runs: InlineRun[]) {
  return runs.map((r, i) => {
    if (r.bold) return <strong key={i}>{r.text}</strong>;
    if (r.italic) return <em key={i}>{r.text}</em>;
    return <span key={i}>{r.text}</span>;
  });
}

export function MarkdownBody({ body }: { body: string }) {
  const blocks = parseMarkdown(body);
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === 'h2') {
          return (
            <h2 key={i} className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-2 first:mt-0">
              {renderRuns(b.runs)}
            </h2>
          );
        }
        if (b.type === 'h3') {
          return (
            <h3 key={i} className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-2 first:mt-0">
              {renderRuns(b.runs)}
            </h3>
          );
        }
        if (b.type === 'ul') {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {b.items.map((runs, j) => (
                <li key={j}>{renderRuns(runs)}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{renderRuns(b.runs)}</p>;
      })}
    </>
  );
}
