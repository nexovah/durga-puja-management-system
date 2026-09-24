// Same minimal Markdown subset as web's src/app/lib/markdown.tsx (mirrored,
// not shared — different bundlers per branch, see branch convention memory):
// headings (## / ###), **bold**, *italic*, "- " bullet lists, blank line =
// new paragraph. Only supports what the Super Admin toolbar can insert.
import { Text, View } from 'react-native';
import { colors } from '../theme';

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

function Runs({ runs, style }: { runs: InlineRun[]; style: any }) {
  return (
    <Text style={style}>
      {runs.map((r, i) => (
        <Text key={i} style={[r.bold && { fontWeight: '800' }, r.italic && { fontStyle: 'italic' }]}>
          {r.text}
        </Text>
      ))}
    </Text>
  );
}

export function MarkdownBody({ body }: { body: string }) {
  const blocks = parseMarkdown(body);
  return (
    <View style={{ gap: 14 }}>
      {blocks.map((b, i) => {
        if (b.type === 'h2') return <Runs key={i} runs={b.runs} style={{ fontSize: 17, fontWeight: '800', color: colors.ink }} />;
        if (b.type === 'h3') return <Runs key={i} runs={b.runs} style={{ fontSize: 15, fontWeight: '700', color: colors.ink }} />;
        if (b.type === 'ul') {
          return (
            <View key={i} style={{ gap: 8 }}>
              {b.items.map((runs, j) => (
                <View key={j} style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ fontSize: 14, color: colors.inkSoft }}>{'•'}</Text>
                  <Runs runs={runs} style={{ flex: 1, fontSize: 14, color: colors.inkSoft, lineHeight: 21 }} />
                </View>
              ))}
            </View>
          );
        }
        return <Runs key={i} runs={b.runs} style={{ fontSize: 14, color: colors.inkSoft, lineHeight: 21 }} />;
      })}
    </View>
  );
}
