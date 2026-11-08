import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowDown, ArrowLeft, ArrowUp, Bold, ChevronDown, Clipboard, Copy, Download, Expand, FilePlus2, FileText, Fingerprint, Radar, ScanSearch, BriefcaseBusiness, FolderOpen, ImagePlus, Italic, List, ListOrdered, PanelLeftClose, Plus, Redo2, Save, Search, Trash2, Undo2, X } from 'lucide-react';
import { createReport, fieldPath, getAt, importAttackFlow, importCsv, materializeImages, parseWorkspace, serializeWorkspace, setAt, tableChange, templates, type Data, type Field, type Report, type Section, type Template } from './report';
import { buildExportSections } from './presentation';
import { sectionExample, sectionGuidance } from './guidance';
import { createRecoverySerializer } from './recovery';
import { TacticMap, TechniquesMap } from './attackMaps';
import { Button } from './components/ui/button';
import { Input as TextInput } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { Checkbox } from './components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './components/ui/dialog';
import './style.css';
import './splunk.css';
import './operations.css';
import './design-system/tokens.css';
import './design-system/brand-components.css';

const STORAGE = 'cti-workbench-recovery-v1';
const blueprintIcons = [Fingerprint, Radar, ScanSearch, BriefcaseBusiness];
type History = { past: Data[]; future: Data[] };
const fileText = (file: File) => file.text();
const fileData = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Unable to read image.')); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); });
function download(name: string, content: BlobPart, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
const filename = (title: string) => (title.trim() || 'untitled-report').replace(/[\\/:*?"<>|]/g, '-');
type Recovery = { reports: Report[]; state: 'ready' | 'paused' | 'unavailable'; raw: string | null };
function readRecovery(): Recovery {
  let raw: string | null = null;
  try { raw = localStorage.getItem(STORAGE); } catch { return { reports: [], state: 'unavailable', raw: null }; }
  if (raw === null) return { reports: [], state: 'ready', raw: null };
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return { reports: [], state: 'paused', raw };
    const reports: Report[] = []; let invalid = false;
    for (const item of data) {
      try { reports.push(parseWorkspace(JSON.stringify(item))); } catch { invalid = true; }
    }
    return { reports, state: invalid ? 'paused' : 'ready', raw: invalid ? raw : null };
  } catch { return { reports: [], state: 'paused', raw }; }
}
function IconButton({ title, onClick, children, disabled, buttonRef }: {title: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; buttonRef?: React.Ref<HTMLButtonElement>}) { return <Button ref={buttonRef} type="button" variant="ghost" size="icon-sm" title={title} aria-label={title} onClick={onClick} disabled={disabled} className="icon-button">{children}</Button>; }

export function App() {
  const [initialRecovery] = useState(readRecovery);
  const [serializeRecovery] = useState(createRecoverySerializer);
  const [reports, setReports] = useState<Report[]>(initialRecovery.reports);
  const [activeId, setActiveId] = useState(() => initialRecovery.reports[0]?.id || '');
  const [recoveryStatus, setRecoveryStatus] = useState<'ready' | 'paused' | 'unavailable'>(initialRecovery.state);
  const [history, setHistory] = useState<Record<string, History>>({});
  const [sectionId, setSectionId] = useState('general');
  const [view, setView] = useState<'editor' | 'preview'>('editor');
  const [chooser, setChooser] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [sidebar, setSidebar] = useState(() => !window.matchMedia('(max-width: 650px)').matches);
  const [busy, setBusy] = useState(false);
  const openRef = useRef<HTMLInputElement>(null);
  const chooserOpener = useRef<HTMLElement | null>(null);
  const exportOpener = useRef<HTMLElement | null>(null);
  const outlineToggleRef = useRef<HTMLButtonElement>(null);
  const outlineCloseRef = useRef<HTMLButtonElement>(null);
  const sectionHeadingRef = useRef<HTMLHeadingElement>(null);
  const report = reports.find(r => r.id === activeId);
  const template = templates.find(t => t.id === report?.templateId);
  const section = template?.sections.find(s => s.id === sectionId) || template?.sections[0];
  const title = String(report?.data.report_title || 'Untitled report');

  useEffect(() => {
    if (initialRecovery.state !== 'ready') return;
    try { localStorage.setItem(STORAGE, serializeRecovery(reports)); setRecoveryStatus('ready'); }
    catch { setRecoveryStatus('unavailable'); }
  }, [reports, initialRecovery.state, serializeRecovery]);
  const update = useCallback((data: Data) => { if (!report) return; setHistory(old => { const h = old[report.id] || { past: [], future: [] }; return { ...old, [report.id]: { past: [...h.past.slice(-99), report.data], future: [] } }; }); setReports(old => old.map(r => r.id === report.id ? { ...r, data } : r)); }, [report]);
  const undo = useCallback((direction: 'undo' | 'redo') => {
    if (!report) return; const h = history[report.id] || { past: [], future: [] };
    const source = direction === 'undo' ? h.past : h.future; if (!source.length) return;
    const next = source[source.length - 1];
    setHistory({ ...history, [report.id]: direction === 'undo' ? { past: h.past.slice(0, -1), future: [...h.future, report.data] } : { past: [...h.past, report.data], future: h.future.slice(0, -1) } });
    setReports(old => old.map(r => r.id === report.id ? { ...r, data: next } : r));
  }, [report, history]);
  const save = useCallback(() => { if (report) { download(`${filename(title)}.ctiw.json`, serializeWorkspace(report), 'application/json'); setNotice('Workspace download started.'); } }, [report, title]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (!(e.ctrlKey || e.metaKey)) return; const k = e.key.toLowerCase(); if (k === 's') { e.preventDefault(); save(); } else if (k === 'o') { e.preventDefault(); openRef.current?.click(); } else if (k === 'z' && e.target instanceof HTMLElement && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) { e.preventDefault(); undo(e.shiftKey ? 'redo' : 'undo'); } else if (k === 'y' && e.target instanceof HTMLElement && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) { e.preventDefault(); undo('redo'); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [save, undo]);
  const addReport = (id: string) => { const created = createReport(id); setReports(old => [...old, created]); setActiveId(created.id); setSectionId('general'); setChooser(false); setView('editor'); if (window.matchMedia('(max-width: 650px)').matches) setSidebar(false); };
  const openFile = async (file?: File) => { if (!file) return; try {
    const text = await fileText(file); const parsed = JSON.parse(text); let opened: Report;
    if (parsed.format === 'cti-workbench') opened = parseWorkspace(text);
    else {
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected a JSON report object.');
      const legacyTemplate = templates.find(t => t.id === parsed.__document?.template_identifier || t.name === parsed.__document?.template_name);
      const pick = legacyTemplate || template || templates.find(t => t.name === 'Campaign Report')!;
      if (!legacyTemplate && !window.confirm(`This file does not identify its template. Open it as ${pick.name}? Choose that template first if it is different.`)) return;
      opened = createReport(pick.id, parsed);
    }
    opened = { ...opened, id: crypto.randomUUID() }; setReports(old => [...old, opened]); setActiveId(opened.id); setSectionId('general'); setView('editor'); setNotice('Report opened.');
  } catch (err) { setNotice(`Could not open report: ${err instanceof Error ? err.message : 'invalid file'}`); } };
  const exportDocument = async (kind: 'pdf' | 'docx') => { if (!report || !template) return; setBusy(true); try { const sections = buildExportSections(report, template, selected); const { createPdf, createWord } = await import('./export'); const bytes = kind === 'pdf' ? await createPdf(title, sections) : await createWord(title, sections); download(`${filename(title)}.${kind}`, new Uint8Array(bytes).buffer, kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); setExportOpen(false); setNotice(`${kind.toUpperCase()} downloaded.`); } catch (err) { setNotice(`Export failed: ${err instanceof Error ? err.message : 'unknown error'}`); } finally { setBusy(false); } };
  const legacySave = () => { if (!report || !template) return; if (!window.confirm('Original Blueprints fields store plain text. Markdown and embedded images may not render correctly in the original tool. Continue?')) return; const data = { ...(materializeImages(report.data, report.assets) as Data), __document: { ...((report.data.__document as Data) || {}), template_name: template.name, template_identifier: template.id, template_version: '0.1.0', authoring_tool_version: '1.0.0' } }; download(`${filename(title)}.json`, JSON.stringify(data, null, 2), 'application/json'); };
  const closeReport = (id: string) => { if (!window.confirm('Close this report? It will be removed from browser recovery. Download a workspace file first if you want to keep it.')) return; const rest = reports.filter(r => r.id !== id); setReports(rest); if (id === activeId) { setActiveId(rest[0]?.id || ''); setSectionId('general'); } };
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => { void openFile(e.target.files?.[0]); e.target.value = ''; };
  const showChooser = () => { chooserOpener.current = document.activeElement as HTMLElement | null; setChooser(true); };
  const openExport = () => { if (template) { exportOpener.current = document.activeElement as HTMLElement | null; setNotice(''); setSelected(template.sections.map(s => s.id)); setExportOpen(true); } };

  return <div className="app-shell">
    <input ref={openRef} type="file" accept=".json,application/json" hidden onChange={onFile}/>
    <header className="topbar"><div className="brand"><span className="brand-mark"><FileText size={16}/></span><span><b>ThreatLedger</b></span></div><div className="top-context"><span>REPORT AUTHORING</span><span className="top-divider"/><span>Local workspace</span></div><div className="top-actions"><button className="top-link" onClick={() => openRef.current?.click()}><FolderOpen size={16}/> Open</button><button className="top-link" onClick={showChooser}><Plus size={16}/> New report</button><button className="top-link" aria-label="Toggle fullscreen" title="Toggle fullscreen" onClick={() => { const action = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); void action.catch(() => setNotice('Fullscreen is not available in this browser.')); }}><Expand size={16}/></button></div></header>
    {recoveryStatus !== 'ready' && <div className="recovery-alert" role="alert"><div><strong>{recoveryStatus === 'paused' ? 'Browser recovery paused' : 'Browser recovery unavailable'}</strong><span>{recoveryStatus === 'paused' ? 'Existing recovery data could not be read and has been preserved. Download the recovery data and download workspace files to keep new changes.' : 'Changes may not be recoverable in this browser. Download workspace files to keep your work.'}</span></div>{initialRecovery.raw !== null && <Button variant="outline" className="button secondary compact" onClick={() => download('cti-workbench-recovery.json', initialRecovery.raw!, 'application/json')}>Download recovery data</Button>}</div>}
    {!report || !template ? <main className="welcome"><div className="welcome-main"><div className="welcome-heading"><div className="welcome-intro"><div className="welcome-crumb">THREATLEDGER <span>/</span> REPORTS</div><h1>Create a report<span className="heading-cursor" aria-hidden="true">_</span></h1><p className="welcome-copy">Choose a blueprint to start a structured intelligence report, or open a report you saved earlier.</p><Button variant="outline" className="button secondary welcome-open" onClick={() => openRef.current?.click()}><FolderOpen size={16}/> Open report</Button></div></div><div className="template-list-header"><div><h2>Report blueprints</h2><p>Select the report that fits your intelligence objective.</p></div><span>{templates.length} templates</span></div><div className="template-list">{templates.map((t,i) => { const BlueprintIcon = blueprintIcons[i] || FileText; return <button className="template-row" key={t.id} onClick={() => addReport(t.id)}><span className="template-icon"><BlueprintIcon size={20}/></span><span className="template-content"><span className="template-name">{t.name}<span className="template-index">{['KNOW', 'CHANGE', 'FIND', 'INFORM'][i]}</span></span><small>{t.description.split(':').slice(1).join(':').trim().split('.')[0]}.</small></span><span className="template-action"><span>Create report <span aria-hidden="true">→</span></span><small className="template-section-count">{t.sections.length} sections</small></span></button>; })}</div></div></main> : <>
      <div className="document-bar"><div className="tabs">{reports.map((r, index) => { const name = String(r.data.report_title || `Untitled ${index + 1} · ${templates.find(t => t.id === r.templateId)?.name || 'Report'}`); return <div className={`tab ${r.id === activeId ? 'active' : ''}`} key={r.id}><button aria-current={r.id === activeId ? 'true' : undefined} title={name} onClick={() => {setActiveId(r.id); setSectionId('general');}}><FileText size={14}/><span>{name}</span></button><button aria-label={`Close report: ${name}`} onClick={() => closeReport(r.id)}><X size={13}/></button></div>; })}<button className="tab-add" onClick={showChooser} aria-label="New report"><Plus size={17}/></button></div></div>
      <div className="workspace">{sidebar && <aside className="sidebar"><div className="sidebar-heading"><span>REPORT OUTLINE</span><IconButton title="Hide outline" buttonRef={outlineCloseRef} onClick={() => { setSidebar(false); requestAnimationFrame(() => outlineToggleRef.current?.focus()); }}><PanelLeftClose size={16}/></IconButton></div><div className="outline-title">{template.name}<small>{title}</small></div><nav aria-label="Report sections">{template.sections.map((s, i) => <button key={s.id} className={`outline-item ${section?.id === s.id ? 'selected' : ''}`} aria-current={section?.id === s.id ? 'step' : undefined} onClick={() => {setSectionId(s.id); setView('editor'); if (window.matchMedia('(max-width: 650px)').matches) { setSidebar(false); requestAnimationFrame(() => sectionHeadingRef.current?.focus()); }}}><span className="outline-number">{String(i + 1).padStart(2, '0')}</span><span>{s.name || 'Report details'}</span><span className="outline-dot"/></button>)}</nav></aside>}
      <main className="main-area"><div className="editor-top"><div className="breadcrumb">{!sidebar && <IconButton title="Show outline" buttonRef={outlineToggleRef} onClick={() => { setSidebar(true); requestAnimationFrame(() => outlineCloseRef.current?.focus()); }}><PanelLeftClose size={16}/></IconButton>} <span>{template.name}</span><span>/</span><strong>{section?.name || 'Report details'}</strong></div><div className="actions"><IconButton title="Undo report change" onClick={() => undo('undo')} disabled={!history[report.id]?.past.length}><Undo2 size={16}/></IconButton><IconButton title="Redo report change" onClick={() => undo('redo')} disabled={!history[report.id]?.future.length}><Redo2 size={16}/></IconButton><span className="action-separator"/><Button variant="outline" className="button secondary compact workspace-download" aria-label="Download workspace" title="Download workspace" onClick={save}><Save size={15}/><span className="workspace-label">Download workspace</span><span className="workspace-label-compact">Download</span></Button><Button variant="default" className="button primary compact" onClick={openExport}><Download size={15}/> Export</Button></div></div>
      <div className="canvas"><div className="paper"><div className="paper-top"><div><div className="document-kind">{template.name}</div><h1 ref={sectionHeadingRef} tabIndex={-1}>{section?.name || 'Report details'}</h1><p>{section ? sectionGuidance(template, section) : ''}</p></div><div className="view-switch" role="group" aria-label="View mode"><button aria-pressed={view === 'editor'} className={view === 'editor' ? 'on' : ''} onClick={() => setView('editor')}>Edit</button><button aria-pressed={view === 'preview'} className={view === 'preview' ? 'on' : ''} onClick={() => setView('preview')}>Preview</button></div></div>
      {view === 'preview' ? <ReportPreview report={report} template={template}/> : section && <><div className="fields">{sectionExample(template, section) && <div className="guidance-example"><strong>Suggested framing</strong><span>{sectionExample(template, section)}</span></div>}{section.properties.map(field => <FieldEditor key={field.id} field={field} section={section} data={report.data} update={update} addAsset={(id, value) => setReports(old => old.map(r => r.id === report.id ? {...r, assets: {...r.assets, [id]: value}} : r))} onError={setNotice}/>)}</div></>}
      <div className="paper-footer"><span>{template.name} <span>·</span> {section?.name || 'Report details'}</span><div>{section && template.sections.indexOf(section) > 0 && <button className="subtle" onClick={() => setSectionId(template.sections[template.sections.indexOf(section)-1].id)}><ArrowLeft size={15}/> Previous</button>}{section && template.sections.indexOf(section) < template.sections.length - 1 && <Button variant="outline" className="button secondary compact" onClick={() => setSectionId(template.sections[template.sections.indexOf(section)+1].id)}>Next section →</Button>}</div></div></div></div></main></div>
      <footer className="statusbar"><span>{template.name} <span className="footer-dot">·</span> {view === 'editor' ? 'Editing' : 'Previewing'}</span></footer>
    </>}
    {notice && !exportOpen && <div role="status" className="notice">{notice}<button aria-label="Dismiss" onClick={() => setNotice('')}><X size={16}/></button></div>}
    <Dialog open={chooser} onOpenChange={setChooser}><DialogContent className="dialog chooser" showCloseButton={false} onCloseAutoFocus={e => { e.preventDefault(); chooserOpener.current?.focus(); }}><div className="dialog-head"><div><DialogTitle>Start a report</DialogTitle><DialogDescription>Choose a blueprint for your audience and objective.</DialogDescription></div><IconButton title="Close" onClick={() => setChooser(false)}><X size={18}/></IconButton></div>{templates.map((t,i) => <button className="choose-row" key={t.id} onClick={() => addReport(t.id)}><span className="choose-tag">{['KNOW', 'CHANGE', 'FIND', 'INFORM'][i]}</span><span><strong>{t.name}</strong><small>{t.description.split(':').slice(1).join(':').trim()}</small></span><span>→</span></button>)}<div className="dialog-bottom"><button className="subtle" onClick={() => {setChooser(false); openRef.current?.click();}}><FolderOpen size={16}/> Open an existing report</button></div></DialogContent></Dialog>
    <Dialog open={exportOpen && !!template} onOpenChange={setExportOpen}>{template && <DialogContent className="dialog export-dialog" showCloseButton={false} onCloseAutoFocus={e => { e.preventDefault(); exportOpener.current?.focus(); }}><div className="dialog-head"><div><DialogTitle>Export report</DialogTitle><DialogDescription>Select the sections to include in your document.</DialogDescription></div><IconButton title="Close" onClick={() => setExportOpen(false)}><X size={18}/></IconButton></div>{notice && <div role="alert" className="export-error">{notice}</div>}<div className="export-guidance"><p><strong>Word:</strong> Common Markdown formatting and standalone PNG/JPEG images are supported. Complex tables, nested lists and inline images may not render faithfully.</p><p><strong>PDF:</strong> The included font does not cover every writing system; complex Markdown and inline images may be simplified.</p><p>Review the downloaded document for formatting, images and text before sharing.</p></div><div className="section-checks">{template.sections.map(s => <label key={s.id}><Checkbox checked={selected.includes(s.id)} onCheckedChange={checked => setSelected(old => checked === true ? [...old,s.id] : old.filter(id => id !== s.id))}/>{s.name || 'Report details'}</label>)}</div><div className="export-buttons"><Button variant="outline" className="button secondary" onClick={legacySave}>Blueprints JSON</Button><Button variant="outline" className="button secondary" disabled={busy || !selected.length} onClick={() => void exportDocument('docx')}>Download Word</Button><Button variant="default" className="button primary" disabled={busy || !selected.length} onClick={() => void exportDocument('pdf')}>Download PDF</Button></div></DialogContent>}</Dialog>
  </div>;
}

function FieldEditor({ field, section, data, update, addAsset, onError }: {field: Field; section: Section; data: Data; update: (data: Data) => void; addAsset: (id: string, value: string) => void; onError: (message: string) => void}) {
  const path = fieldPath(section, field); const value = getAt(data, path);
  if (field.type === 7 || field.type === 8) return <TableEditor field={field} rows={Array.isArray(value) ? value as Data[] : []} setRows={rows => update(setAt(data, path, rows))} onError={onError}/>;
  const narrative = field.type === 0 && section.id !== 'general' && section.id !== 'metadata';
  if (narrative) return <Narrative field={field} value={String(value || '')} onChange={v => update(setAt(data, path, v))} addAsset={addAsset} onError={onError}/>;
  return <div className="field"><label htmlFor={path}>{field.name}</label><FieldInput field={field} id={path} value={value} onChange={v => update(setAt(data, path, v))}/>{field.description && <small>{field.description}</small>}</div>;
}
function FieldInput({ field, id, value, onChange }: {field: Field; id: string; value: unknown; onChange: (value: unknown) => void}) {
  if (field.type === 6) return <><TextInput id={id} list={`${id}-options`} value={cleanInput(value)} onChange={e => onChange(e.target.value)} placeholder="Select or search" autoComplete="off"/><datalist id={`${id}-options`}>{field.options?.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}</datalist></>;
  const type = field.type === 1 || field.type === 2 ? 'number' : field.type === 3 ? 'time' : field.type === 4 ? 'date' : field.type === 5 ? 'datetime-local' : 'text';
  const displayed = type === 'date' ? cleanInput(value).slice(0, 10) : type === 'datetime-local' ? cleanInput(value).slice(0, 16) : cleanInput(value);
  return <TextInput id={id} type={type} step={field.type === 2 ? 'any' : undefined} value={displayed} onChange={e => onChange(type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value)} placeholder={type === 'text' ? `Enter ${field.name.toLowerCase()}` : undefined}/>;
}
const cleanInput = (v: unknown) => v === null || v === undefined ? '' : String(v);
function Narrative({ field, value, onChange, addAsset, onError }: {field: Field; value: string; onChange: (s: string) => void; addAsset: (id: string, value: string) => void; onError: (s: string) => void}) {
  const ref = useRef<HTMLTextAreaElement>(null); const imageRef = useRef<HTMLInputElement>(null); const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  const insert = (before: string, after = '') => { const el = ref.current; if (!el) return; const start = el.selectionStart, end = el.selectionEnd; const current = el.value; onChangeRef.current(current.slice(0, start) + before + current.slice(start, end) + after + current.slice(end)); requestAnimationFrame(() => {el.focus(); el.setSelectionRange(start + before.length, end + before.length);}); };
  const addImage = async (file?: File) => { if (!file) return; try { if (!['image/png','image/jpeg'].includes(file.type)) throw new Error('Choose a PNG or JPEG image.'); const data = await fileData(file); const id = crypto.randomUUID(); addAsset(id, data); insert(`\n\n![${file.name.replace(/[\[\]]/g, '')}](cti-image:${id})\n\n`); } catch (err) { onError(err instanceof Error ? err.message : 'Could not add image.'); } };
  return <div className="field narrative"><div className="field-heading"><label htmlFor={field.id}>{field.name}</label><span>MARKDOWN SUPPORTED</span></div><div className="editor-box"><div className="format-toolbar"><IconButton title="Bold" onClick={() => insert('**','**')}><Bold size={15}/></IconButton><IconButton title="Italic" onClick={() => insert('*','*')}><Italic size={15}/></IconButton><span className="toolbar-divider"/><IconButton title="Bullet list" onClick={() => insert('\n- ')}><List size={16}/></IconButton><IconButton title="Numbered list" onClick={() => insert('\n1. ')}><ListOrdered size={16}/></IconButton><span className="toolbar-divider"/><IconButton title="Insert image" onClick={() => imageRef.current?.click()}><ImagePlus size={16}/></IconButton><input ref={imageRef} hidden type="file" accept="image/png,image/jpeg" onChange={e => {void addImage(e.target.files?.[0]); e.target.value='';}}/><span className="toolbar-hint">Write with Markdown</span></div><Textarea ref={ref} id={field.id} value={value} onChange={e => onChange(e.target.value)} placeholder={`Write your ${field.name.toLowerCase()} here…`} rows={10}/></div><div className="field-hint"><span>Use the toolbar or Markdown syntax. Images are embedded in the workspace file.</span><span>{value.replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/gi, '[image]').length} characters</span></div></div>;
}
function TableEditor({ field, rows, setRows, onError }: {field: Field; rows: Data[]; setRows: (rows: Data[]) => void; onError: (s: string) => void}) {
  const csvRef = useRef<HTMLInputElement>(null), flowRef = useRef<HTMLInputElement>(null); const fields = field.properties || [];
  const handleFile = async (file: File | undefined, mode: 'csv' | 'flow') => { if (!file) return; try { const content = await file.text(); const imported = mode === 'csv' ? importCsv(content, fields) : importAttackFlow(content); if (!imported.length) throw new Error('No matching rows were found.'); setRows([...rows, ...imported]); } catch (err) { onError(`Import failed: ${err instanceof Error ? err.message : 'invalid file'}`); } };
  const setValue = (index: number, id: string, value: unknown) => { const next = structuredClone(rows); next[index][id] = value; if (id === 'technique' && typeof next[index].sub_technique === 'string' && !(next[index].sub_technique as string).startsWith(`${value}.`)) next[index].sub_technique = ''; if ((id === 'technique' || id === 'sub_technique') && fields.some(f => f.id === 'defend')) { const tech = next[index].sub_technique || next[index].technique; next[index].defend = typeof tech === 'string' && /^T\d{4}(\.\d{3})?$/.test(tech) ? `https://d3fend.mitre.org/offensive-technique/attack/${tech}/` : ''; } setRows(next); };
  const optionsFor = (child: Field, row: Data): Field => {
    if (!child.options) return child;
    if (child.id === 'technique' && typeof row.tactic === 'string' && TacticMap[row.tactic]) return { ...child, options: child.options.filter(o => TacticMap[row.tactic as string].includes(o.value)) };
    if (child.id === 'sub_technique' && typeof row.technique === 'string' && TechniquesMap[row.technique]) return { ...child, options: child.options.filter(o => o.value.startsWith(`${row.technique}.`) || TechniquesMap[row.technique as string].includes(o.value)) };
    return child;
  };
  return <section className="table-section"><div className="table-head"><div><h2>{field.name}</h2><p>{rows.length} {rows.length === 1 ? 'entry' : 'entries'} · Add structured intelligence below.</p></div><div className="table-actions"><button className="subtle" onClick={() => csvRef.current?.click()}>Import CSV</button>{field.id.startsWith('mitre_attack') && <button className="subtle" onClick={() => flowRef.current?.click()}>Import Attack Flow</button>}<Button variant="outline" className="button secondary compact" onClick={() => setRows(tableChange(rows, 'add'))}><Plus size={14}/> Add entry</Button></div></div><input type="file" ref={csvRef} hidden accept=".csv,text/csv" onChange={e => {void handleFile(e.target.files?.[0], 'csv'); e.target.value='';}}/><input type="file" ref={flowRef} hidden accept=".json,application/json" onChange={e => {void handleFile(e.target.files?.[0], 'flow'); e.target.value='';}}/>
    {!rows.length ? <div className="empty-table"><Clipboard size={19}/><span>No entries yet.</span><button className="text-link" onClick={() => setRows(tableChange(rows,'add'))}>Add the first entry</button></div> : rows.map((row, index) => <div className="table-entry" key={index}><div className="entry-head"><strong>Entry {String(index+1).padStart(2,'0')}</strong><div><IconButton title={`Move up entry ${index+1}`} disabled={index===0} onClick={() => setRows(tableChange(rows,'up',index))}><ArrowUp size={14}/></IconButton><IconButton title={`Move down entry ${index+1}`} disabled={index===rows.length-1} onClick={() => setRows(tableChange(rows,'down',index))}><ArrowDown size={14}/></IconButton><IconButton title={`Duplicate entry ${index+1}`} onClick={() => setRows(tableChange(rows,'duplicate',index))}><Copy size={14}/></IconButton><IconButton title={`Delete entry ${index+1}`} onClick={() => {if(window.confirm('Delete this entry?')) setRows(tableChange(rows,'delete',index));}}><Trash2 size={14}/></IconButton></div></div><div className="entry-fields">{fields.map(child => <div className="field" key={child.id}><label htmlFor={`${field.id}-${index}-${child.id}`}>{child.name}</label><FieldInput field={optionsFor(child, row)} id={`${field.id}-${index}-${child.id}`} value={row[child.id]} onChange={v => setValue(index,child.id,v)}/></div>)}</div></div>)}
  </section>;
}
function ReportPreview({ report, template }: {report: Report; template: Template}) { const sections = buildExportSections(report, template, template.sections.map(s => s.id)); return <div className="preview"><h1>{String(report.data.report_title || 'Untitled report')}</h1>{sections.length ? sections.map((s, i) => <section key={i}><h2>{s.name}</h2>{s.items.map((item,j) => <div key={j}><h3>{item.name}</h3>{typeof item.value === 'string' ? <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={url => url.startsWith('data:image/png;base64,') || url.startsWith('data:image/jpeg;base64,') || /^(https?:|mailto:|#)/i.test(url) ? url : ''} components={{img: ({src, alt}) => typeof src === 'string' && /^data:image\/(png|jpeg);base64,/i.test(src) ? <img src={src} alt={alt || ''}/> : <span>[External image omitted: {alt || 'image'}]</span>}}>{item.value}</ReactMarkdown> : item.value.map((row,k) => <dl key={k}>{(item.fields || []).filter(f => row[f.id] != null && row[f.id] !== '').map(f => <React.Fragment key={f.id}><dt>{f.name}</dt><dd>{String(row[f.id])}</dd></React.Fragment>)}</dl>)}</div>)}</section>) : <p>No report content yet.</p>}</div>; }

const root = document.getElementById('root');
if (root) createRoot(root).render(<React.StrictMode><App/></React.StrictMode>);
