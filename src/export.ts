import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow, TableCell, WidthType, ExternalHyperlink } from 'docx';
import { jsPDF } from 'jspdf';
import { marked } from 'marked';
import type { ExportSection } from './presentation';
export { buildExportSections } from './presentation';
import regularFont from './LiberationSans-Regular.ttf?inline';
import boldFont from './LiberationSans-Bold.ttf?inline';

const clean = (value: unknown) => value === null || value === undefined ? '' : String(value);
const imageInfo = (url: string): {type: 'png' | 'jpg' | 'gif' | 'bmp'; bytes: Uint8Array; width: number; height: number} | null => {
  const m = /^data:image\/(png|jpeg|jpg|gif|bmp);base64,([\s\S]+)$/i.exec(url);
  if (!m) return null;
  const raw = atob(m[2]);
  const type = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase() as 'png'|'jpg'|'gif'|'bmp';
  let width = 480, height = 270;
  if (type === 'png' || type === 'jpg') { const info = new jsPDF().getImageProperties(url); width = info.width; height = info.height; }
  return { type, bytes: Uint8Array.from(raw, c => c.charCodeAt(0)), width, height };
};
// Inline token rendering keeps common Markdown emphasis and links editable in Word.
function runs(tokens: any[]): TextRun[] {
  return tokens.flatMap(token => {
    if (token.type === 'strong') return [new TextRun({ text: token.text, bold: true })];
    if (token.type === 'em') return [new TextRun({ text: token.text, italics: true })];
    if (token.type === 'codespan') return [new TextRun({ text: token.text, font: 'Courier New' })];
    if (token.type === 'link') return [new TextRun({ text: `${token.text} (${token.href})`, color: '245EA6' })];
    if (token.type === 'image') return [new TextRun({ text: `[Image: ${token.text || 'image'}]` })];
    return [new TextRun(clean(token.text))];
  });
}
function markdownWord(text: string): Paragraph[] {
  const output: Paragraph[] = [];
  for (const token of marked.lexer(text) as any[]) {
    if (token.type === 'space') continue;
    if (token.type === 'list') {
      for (const item of token.items) output.push(new Paragraph({ children: runs((marked.lexer(item.text)[0] as any)?.tokens || [{ text: item.text }]), bullet: { level: 0 } }));
      continue;
    }
    if (token.type === 'paragraph' && token.tokens.length === 1 && token.tokens[0].type === 'image') {
      const image = imageInfo(token.tokens[0].href);
      if (image && (image.type === 'png' || image.type === 'jpg' || image.type === 'gif' || image.type === 'bmp')) {
        const scale = Math.min(480 / image.width, 500 / image.height, 1);
        output.push(new Paragraph({ children: [new ImageRun({ type: image.type, data: image.bytes, transformation: { width: Math.max(1, Math.round(image.width * scale)), height: Math.max(1, Math.round(image.height * scale)) } })] }));
      } else output.push(new Paragraph(`[Unsupported external image: ${token.tokens[0].text || 'image'}]`));
      continue;
    }
    const children = runs('tokens' in token && Array.isArray(token.tokens) ? token.tokens : [{ text: 'text' in token ? token.text : token.raw }]);
    output.push(new Paragraph({ children, ...(token.type === 'heading' ? { heading: token.depth === 1 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3 } : {}), spacing: { after: 140 } }));
  }
  return output;
}
export async function createWord(title: string, sections: ExportSection[]): Promise<Uint8Array> {
  const children: (Paragraph | Table)[] = [new Paragraph({ text: title, heading: HeadingLevel.TITLE })];
  for (const section of sections) {
    children.push(new Paragraph({ text: section.name, heading: HeadingLevel.HEADING_1 }));
    for (const item of section.items) {
      children.push(new Paragraph({ text: item.name, heading: HeadingLevel.HEADING_2 }));
      if (typeof item.value === 'string') children.push(...markdownWord(item.value));
      else for (const row of item.value) {
        const fields = item.fields || [];
        const cells = fields.filter(f => row[f.id] !== undefined && row[f.id] !== null && row[f.id] !== '').map(f => new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: f.name, bold: true })] })] }), new TableCell({ children: markdownWord(clean(row[f.id])).length ? markdownWord(clean(row[f.id])) : [new Paragraph('')] })] }));
        if (cells.length) children.push(new Table({ rows: cells, width: { size: 100, type: WidthType.PERCENTAGE } }), new Paragraph(''));
      }
      if (item.link) children.push(new Paragraph({ children: [new ExternalHyperlink({ link: item.link, children: [new TextRun({ text: 'Open in Splunk', style: 'Hyperlink' })] })] }));
    }
  }
  return new Uint8Array(await Packer.toArrayBuffer(new Document({ sections: [{ children }] })));
}
export async function createPdf(title: string, sections: ExportSection[]): Promise<Uint8Array> {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' }); let y = 58;
  pdf.addFileToVFS('LiberationSans-Regular.ttf', regularFont.split(',')[1]);
  pdf.addFont('LiberationSans-Regular.ttf', 'LiberationSans', 'normal');
  pdf.addFileToVFS('LiberationSans-Bold.ttf', boldFont.split(',')[1]);
  pdf.addFont('LiberationSans-Bold.ttf', 'LiberationSans', 'bold');
  const width = pdf.internal.pageSize.getWidth() - 100; const bottom = pdf.internal.pageSize.getHeight() - 48;
  const space = (n: number) => { if (y + n > bottom) { pdf.addPage(); y = 55; } };
  const text = (value: string, size = 10, bold = false) => {
    pdf.setFont('LiberationSans', bold ? 'bold' : 'normal'); pdf.setFontSize(size);
    const lines: string[] = pdf.splitTextToSize(value, width);
    for (const line of lines) { space(size * 1.4); pdf.text(line, 50, y); y += size * 1.4; }
    y += 5;
  };
  const markdown = (value: string) => {
    for (const token of marked.lexer(value) as any[]) {
      if (token.type === 'space') continue;
      if (token.type === 'paragraph' && token.tokens.length === 1 && token.tokens[0].type === 'image') {
        const image = imageInfo(token.tokens[0].href);
        if (image && (image.type === 'png' || image.type === 'jpg')) { const scale = Math.min(width / image.width, 420 / image.height, 1); const w = image.width * scale, h = image.height * scale; space(h + 12); pdf.addImage(token.tokens[0].href, image.type === 'png' ? 'PNG' : 'JPEG', 50, y, w, h, undefined, 'FAST'); y += h + 12; }
        else text(`[Unsupported image: ${token.tokens[0].text || 'image'}]`);
      } else if (token.type === 'list') token.items.forEach((i: {text: string}) => text(`- ${i.text}`));
      else text('text' in token ? String(token.text).replace(/\*\*|__|(?<!\*)\*(?!\*)|`/g, '') : token.raw, token.type === 'heading' ? 13 : 10, token.type === 'heading');
    }
  };
  text(title, 22, true); y += 8;
  for (const section of sections) {
    space(50); y += 10; text(section.name, 16, true);
    for (const item of section.items) {
      space(35); text(item.name, 11, true);
      if (typeof item.value === 'string') markdown(item.value);
      else item.value.forEach((row, index) => { text(`Entry ${index + 1}`, 10, true); for (const field of item.fields || []) if (row[field.id] !== undefined && row[field.id] !== null && row[field.id] !== '') text(`${field.name}: ${clean(row[field.id])}`); y += 6; });
      if (item.link) { space(20); pdf.setFont('LiberationSans', 'normal'); pdf.setFontSize(10); pdf.textWithLink('Open in Splunk', 50, y, { url: item.link }); y += 19; }
    }
  }
  return new Uint8Array(pdf.output('arraybuffer'));
}
