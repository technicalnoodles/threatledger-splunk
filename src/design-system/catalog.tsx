import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, Check, Download, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog';
import '../style.css';
import '../splunk.css';
import '../operations.css';
import './tokens.css';
import './brand-components.css';
import './catalog.css';

const swatches = [
  { name: 'Page', value: '#0B1118', token: '--surface-page', color: 'var(--surface-page)' },
  { name: 'Panel', value: '#131A23', token: '--surface-panel', color: 'var(--surface-panel)' },
  { name: 'Raised', value: '#232C36', token: '--surface-raised', color: 'var(--surface-raised)' },
  { name: 'Text', value: '#F2F5FA', token: '--text-primary', color: 'var(--text-primary)' },
  { name: 'Link on dark', value: '#478EFF', token: '--link-dark', color: 'var(--link-dark)' },
  { name: 'Link on light', value: '#0A60FF', token: '--link-light', color: 'var(--link-light)' },
];

function Catalog() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(true);
  const [sampleAction, setSampleAction] = useState('');
  const dialogTrigger = useRef<HTMLButtonElement>(null);
  return <div className="catalog-shell">
    <header className="catalog-top"><a href="/" className="catalog-home"><ArrowLeft size={16}/> ThreatLedger</a><span>DESIGN SYSTEM</span></header>
    <main className="catalog-main">
      <div className="catalog-intro"><div><p className="catalog-label">FOUNDATIONS / COMPONENTS</p><h1>Design system</h1><p>Reusable foundations for the ThreatLedger, informed by the Splunk by Cisco brand guide.</p></div><a className="catalog-source" href="https://brand.splunk.com/19231d431/p/04922c-visual-language">View brand guidance ↗</a></div>
      <section aria-labelledby="color-title"><div className="catalog-heading"><div><h2 id="color-title">Color foundations</h2><p>Neutral surfaces, medium-blue links, and a paired magenta-to-orange accent.</p></div><span>01 / FOUNDATIONS</span></div>
        <div className="gradient-spec"><div className="gradient-strip" aria-label="Magenta to orange brand gradient"/><div><strong>Primary brand gradient</strong><p>#FF007F → #FF9000</p><small>Use as an accent, covering less than half of the design.</small></div></div>
        <div className="swatch-grid">{swatches.map(s => <div className="swatch" key={s.token}><span className="swatch-color" style={{background:s.color}}/><strong>{s.name}</strong><span>{s.value}</span><code>{s.token}</code></div>)}</div>
        <p className="catalog-note">Solid magenta and orange are not used for ordinary backgrounds, text, or calls to action. Product status colors are separate semantic adaptations.</p>
      </section>
      <section aria-labelledby="type-title"><div className="catalog-heading"><div><h2 id="type-title">Typography</h2><p>Inter for clarity across headings, controls, and report content.</p></div><span>02 / FOUNDATIONS</span></div>
        <div className="type-demo"><div><span className="catalog-label">HEADING / SEMIBOLD</span><h3>Make intelligence actionable.</h3><p>Clear information helps analysts move from evidence to a decision.</p></div><div className="type-meta"><strong>Inter</strong><span>Variable font</span><span>Regular · Medium · Semibold</span></div></div>
      </section>
      <section aria-labelledby="components-title"><div className="catalog-heading"><div><h2 id="components-title">Components</h2><p>Shadcn/ui controls mapped to the same semantic tokens.</p></div><span>03 / COMPONENTS</span></div>
        <div className="component-grid"><div className="component-demo"><h3>Actions</h3><p>Use a specific verb and make the outcome clear.</p><div className="demo-actions"><Button className="button primary" onClick={() => setSampleAction('Primary button example selected.')}><Download size={16}/> Primary example</Button><Button variant="outline" className="button secondary" onClick={() => setSampleAction('Secondary button example selected.')}><FileText size={16}/> Secondary example</Button></div><Button ref={dialogTrigger} variant="outline" className="button secondary" onClick={() => setOpen(true)}>Open example dialog</Button><p role="status" className="demo-feedback">{sampleAction}</p></div>
          <div className="component-demo"><h3>Form controls</h3><p>Labels and focus states remain visible on dark surfaces.</p><div className="demo-field field"><label htmlFor="example-title">Report title</label><Input id="example-title" placeholder="Enter a report title"/></div><div className="demo-field field"><label htmlFor="example-summary">Summary</label><Textarea id="example-summary" placeholder="Write a short summary" rows={3}/></div><label className="demo-check"><Checkbox checked={checked} onCheckedChange={value => setChecked(value === true)}/> Include executive summary</label></div></div>
      </section>
      <section aria-labelledby="usage-title"><div className="catalog-heading"><div><h2 id="usage-title">Use with intent</h2><p>Separate brand expression from the operational state of the interface.</p></div><span>04 / GUIDANCE</span></div><div className="usage-list"><p><Check size={16}/> Use the primary gradient in small, deliberate accents.</p><p><Check size={16}/> Choose high-contrast surfaces and retain visible keyboard focus.</p><p><Check size={16}/> Treat logos and official icon assets as governed resources; this app does not bundle them.</p></div></section>
    </main>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="dialog catalog-dialog" showCloseButton={false} onCloseAutoFocus={event => {event.preventDefault(); dialogTrigger.current?.focus();}}><div className="dialog-head"><div><DialogTitle>Example dialog</DialogTitle><DialogDescription>Dialogs use the same neutral surfaces and accessible focus behavior.</DialogDescription></div></div><div className="catalog-dialog-body"><p>Use dialogs for focused decisions, with a clear way to return.</p><Button className="button primary" onClick={() => setOpen(false)}>Done</Button></div></DialogContent></Dialog>
  </div>;
}

createRoot(document.getElementById('root')!).render(<Catalog/>);
