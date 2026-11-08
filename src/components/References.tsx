import React, { useId, useRef, useState } from 'react';
import { type FindingReference, type References, type SearchReference } from '../report';
import { createSplunkClient, safeSplunkReferenceUrl, searchUrl } from '../splunk';
import { absoluteTime, containsTimeModifiers, describeFixedRange, fixedTimeRange, resolveOfflineRange, searchJobId } from '../searchTime';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

const emptyFinding = (): FindingReference => ({ id: '', title: '', description: '', sourceId: '', sourceUrl: '' });
const emptySearch = (): SearchReference => ({ id: '', title: '', kind: 'adhoc', query: '', earliest: '-24h', latest: 'now', app: 'search', note: '' });

type SearchClient = Pick<ReturnType<typeof createSplunkClient>, 'resolveTimeRange' | 'loadSearchJob' | 'loadSavedSearch'> & Partial<Pick<ReturnType<typeof createSplunkClient>, 'loadEsRecord'>>;
export function ReferencesEditor({ references, onChange, prefix, client }: { references: References; onChange: (refs: References) => void; prefix: string; client?: SearchClient }) {
  const uid = useId();
  const latestReferences = useRef(references);
  latestReferences.current = references;
  const [finding, setFinding] = useState<FindingReference>(emptyFinding);
  const loadedFindingId = useRef<string | null>(null);
  const [search, setSearch] = useState<SearchReference>(emptySearch);
  const [findingError, setFindingError] = useState('');
  const [findingNotice, setFindingNotice] = useState('');
  const [findingBusy, setFindingBusy] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [jobInput, setJobInput] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const setF = (patch: Partial<FindingReference>) => setFinding(old => {
    const idChanged = patch.sourceId !== undefined && patch.sourceId !== old.sourceId;
    const importedFromEs = old.esSourceType === 'finding' || old.esSourceType === 'finding_group' || old.esSourceType === 'investigation' || old.esSourceType === 'record';
    return { ...old, ...patch, ...(idChanged && importedFromEs ? { esSourceType: undefined, esImportedAt: undefined } : {}) };
  });
  const loadEsFinding = async () => {
    if (!client?.loadEsRecord || findingBusy || !finding.sourceId.trim()) return;
    setFindingBusy(true); setFindingError(''); setFindingNotice('');
    try {
      const result = await client.loadEsRecord(finding.sourceId);
      loadedFindingId.current = result.sourceId;
      const kept = !!(finding.title.trim() || finding.description.trim() || finding.sourceUrl.trim());
      setFinding(old => ({ ...old, ...result, id: old.id, title: old.title.trim() ? old.title : result.title, description: old.description.trim() ? old.description : result.description, sourceUrl: old.sourceUrl.trim() ? old.sourceUrl : result.sourceUrl }));
      const kind = result.esSourceType === 'finding_group' ? 'finding group' : result.esSourceType;
      setFindingNotice(`ES ${kind} loaded. Review the fields below before adding.${kept ? ' Existing text was kept; verify the source link matches this ID.' : ''}`);
    } catch (err) { setFindingError(err instanceof Error ? err.message : 'Could not load the ES record.'); }
    finally { setFindingBusy(false); }
  };
  const setS = (patch: Partial<SearchReference>) => setSearch(old => {
    const changed = (['query', 'earliest', 'latest', 'app'] as const).some(key => patch[key] !== undefined && patch[key] !== old[key]);
    return { ...old, ...patch, ...(changed ? { sourceJobId: undefined, timeSource: undefined, capturedAt: undefined } : {}) };
  });
  const submitFinding = (e: React.FormEvent) => {
    e.preventDefault();
    if (finding.sourceUrl && !safeSplunkReferenceUrl(finding.sourceUrl, window.location.origin)) { setFindingError('Finding links must point to a Splunk app on this server.'); return; }
    const item = { ...finding, title: finding.title.trim(), id: finding.id || crypto.randomUUID() };
    onChange({ ...references, findings: finding.id ? references.findings.map(f => f.id === item.id ? item : f) : [...references.findings, item] });
    setFinding(emptyFinding()); loadedFindingId.current = null; setFindingError(''); setFindingNotice('');
  };
  const importJob = async () => {
    if (!client || searchBusy) return;
    setSearchBusy(true); setSearchError('');
    try {
      const sid = searchJobId(jobInput, window.location.origin);
      const job = await client.loadSearchJob(sid);
      setSearch(old => ({ ...old, ...job, kind: 'adhoc', timeSource: 'job', capturedAt: new Date().toISOString() }));
    } catch (err) { setSearchError(err instanceof Error ? err.message : 'Could not import the search job.'); }
    finally { setSearchBusy(false); }
  };
  const submitSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchBusy) return;
    setSearchBusy(true); setSearchError('');
    try {
      const previous = references.searches.find(s => s.id === search.id);
      const isLegacyRelative = previous && previous.earliest === search.earliest && previous.latest === search.latest && (() => {
        try { fixedTimeRange(previous.earliest, previous.latest); return false; } catch { return true; }
      })();
      if (isLegacyRelative) throw new Error('The original absolute time was not saved. Enter the original absolute range or import a completed search job.');
      const sameSavedReport = previous?.kind === 'saved' && previous.savedName === search.savedName && previous.savedOwner === search.savedOwner && previous.app === search.app && previous.query;
      let query = search.query;
      if (search.kind === 'saved' && !sameSavedReport) {
        if (!client || !search.savedName || !search.savedOwner) throw new Error('Connect to Splunk and enter the saved report name and owner to capture its SPL.');
        query = await client.loadSavedSearch(search.app, search.savedOwner, search.savedName);
      }
      if (!query.trim()) throw new Error('Enter the search SPL.');
      if (containsTimeModifiers(query)) throw new Error('SPL time modifiers, dynamic time functions, or savedsearch/loadjob commands can change the search window. Replace them with fixed values, then set the range below.');
      let range: { earliest: string; latest: string; capturedAt?: string };
      const unchanged = previous && previous.earliest === search.earliest && previous.latest === search.latest;
      const absoluteInputs = (() => { try { absoluteTime(search.earliest); absoluteTime(search.latest); return true; } catch { return false; } })();
      if (search.sourceJobId || unchanged) range = { ...fixedTimeRange(search.earliest, search.latest), capturedAt: search.capturedAt };
      else if (absoluteInputs) range = { ...fixedTimeRange(search.earliest, search.latest), capturedAt: new Date().toISOString() };
      else range = client ? await client.resolveTimeRange(search.earliest, search.latest) : resolveOfflineRange(search.earliest, search.latest);
      const item: SearchReference = { ...search, ...range, query, title: search.title.trim(), id: search.id || crypto.randomUUID(), timeSource: search.sourceJobId ? 'job' : (unchanged && previous?.timeSource ? previous.timeSource : 'captured'), originalEarliest: unchanged ? previous?.originalEarliest : search.earliest, originalLatest: unchanged ? previous?.originalLatest : search.latest };
      searchUrl(item, prefix);
      const latest = latestReferences.current;
      if (previous && latest.searches.find(s => s.id === previous.id) !== previous) throw new Error('This search reference changed while the time was being resolved. Reopen it and try again.');
      onChange({ ...latest, searches: search.id ? latest.searches.map(s => s.id === item.id ? item : s) : [...latest.searches, item] });
      setSearch(emptySearch()); setJobInput('');
    } catch (err) { setSearchError(err instanceof Error ? err.message : 'Could not capture the search.'); }
    finally { setSearchBusy(false); }
  };
  return <div className="references-editor">
    <section className="reference-section"><h2>Findings</h2><p>Reference a finding or investigation, including a link copied from Splunk Enterprise Security.</p>
      {references.findings.length === 0 ? <p className="reference-empty">No findings linked yet.</p> : <ul className="reference-list">{references.findings.map(f => {
        const href = f.sourceUrl && safeSplunkReferenceUrl(f.sourceUrl, window.location.origin);
        return <li key={f.id}><div><strong>{f.title}</strong>{f.sourceId && <span> · {f.sourceId}</span>}{(f.esSourceType === 'finding' || f.esSourceType === 'finding_group' || f.esSourceType === 'investigation' || f.esSourceType === 'record') && <p>Source: ES {f.esSourceType === 'finding_group' ? 'finding group' : f.esSourceType}{typeof f.esImportedAt === 'string' ? ` · imported ${f.esImportedAt}` : ''}</p>}{f.description && <p>{f.description}</p>}{href && <a href={href} target="_blank" rel="noreferrer">Open finding in Splunk</a>}{f.sourceUrl && !href && <p>Source link unavailable: it is not a same-origin Splunk app link.</p>}</div><div className="reference-actions"><button type="button" disabled={findingBusy} aria-label={`Edit finding: ${f.title}`} onClick={() => { setFinding(f); loadedFindingId.current = f.esSourceType ? f.sourceId : null; setFindingNotice(''); }}>Edit</button><button type="button" disabled={findingBusy} aria-label={`Remove finding: ${f.title}`} onClick={() => { if (window.confirm('Remove this finding reference?')) onChange({ findings: references.findings.filter(v => v.id !== f.id), searches: references.searches.map(s => s.findingId === f.id ? { ...s, findingId: undefined } : s) }); }}>Remove</button></div></li>;
      })}</ul>}
      {findingError && <p role="alert" className="reference-error">{findingError}</p>}
      {findingNotice && <p role="status" className="reference-import-notice">{findingNotice}</p>}
      <form onSubmit={submitFinding} className="reference-form"><h3>{finding.id ? 'Edit finding' : 'Add a finding'}</h3><fieldset className="reference-fieldset" disabled={findingBusy}><div className="reference-grid">
        <div className="reference-wide reference-import"><label htmlFor={`${uid}-fi`}>Finding ID<Input id={`${uid}-fi`} value={finding.sourceId} onChange={e => { const value = e.target.value; setF({ sourceId: value }); setFindingNotice(loadedFindingId.current && value.toUpperCase() !== loadedFindingId.current.toUpperCase() ? 'Finding ID changed. Existing details and the source link may refer to the earlier ES record; review them before adding.' : ''); }}/></label>{client?.loadEsRecord && <><Button className="button secondary compact" variant="outline" type="button" disabled={findingBusy || !finding.sourceId.trim()} onClick={() => void loadEsFinding()}>{findingBusy ? 'Loading from ES…' : 'Load from ES'}</Button><p>Enter an ES display ID or a complete finding event_id. Imported details are copied into the report; review its access before saving.</p></>}</div>
        <label className="reference-wide" htmlFor={`${uid}-ft`}>Finding title<Input id={`${uid}-ft`} value={finding.title} required onChange={e => setF({ title: e.target.value })}/></label>
        <label className="reference-wide" htmlFor={`${uid}-fu`}>Splunk finding link<Input id={`${uid}-fu`} value={finding.sourceUrl} onChange={e => setF({ sourceUrl: e.target.value })} placeholder="Paste a link from Splunk"/></label>
        <label className="reference-wide" htmlFor={`${uid}-fd`}>Finding notes<Textarea id={`${uid}-fd`} value={finding.description} onChange={e => setF({ description: e.target.value })}/></label>
      </div><Button className="button secondary compact" variant="outline" type="submit">{finding.id ? 'Update finding' : 'Add finding'}</Button>{finding.id && <button type="button" onClick={() => { setFinding(emptyFinding()); loadedFindingId.current = null; setFindingNotice(''); }}>Cancel edit</button>}</fieldset></form>
    </section>
    <section className="reference-section"><h2>Searches</h2><p>Search references use fixed time boundaries. Relative times are resolved when you add the reference; import a completed job to preserve an earlier run’s actual window. Results can still change as data or permissions change.</p>
      {references.searches.length === 0 ? <p className="reference-empty">No searches linked yet.</p> : <ul className="reference-list">{references.searches.map(s => {
        let href = '', range = '', unavailable = '';
        try { range = describeFixedRange(s.earliest, s.latest); }
        catch { unavailable = 'Original search time was not saved. Edit this reference to enter the original absolute range or import a search job.'; }
        if (!unavailable) { try { href = searchUrl(s, prefix); } catch (err) { unavailable = err instanceof Error ? err.message : 'Search link unavailable.'; } }
        return <li key={s.id}><div><strong>{s.title}</strong>{range && <p>Fixed time range: {range}</p>}{s.sourceJobId && <p>Captured from search job: {s.sourceJobId}</p>}{s.findingId && <p>Linked finding: {references.findings.find(f => f.id === s.findingId)?.title || 'Unavailable'}</p>}{s.note && <p>{s.note}</p>}{href ? <a href={href} target="_blank" rel="noreferrer" aria-label={`Open search: ${s.title}`}>Open in Splunk</a> : <p>{unavailable}</p>}</div><div className="reference-actions"><button type="button" aria-label={`Edit search: ${s.title}`} onClick={() => setSearch(s)}>Edit</button><button type="button" aria-label={`Remove search: ${s.title}`} onClick={() => { if (window.confirm('Remove this search reference?')) onChange({ ...references, searches: references.searches.filter(v => v.id !== s.id) }); }}>Remove</button></div></li>;
      })}</ul>}
      {searchError && <p role="alert" className="reference-error">{searchError}</p>}
      <form onSubmit={e => void submitSearch(e)} className="reference-form"><h3>{search.id ? 'Edit search' : 'Add a search'}</h3><fieldset className="reference-fieldset" disabled={searchBusy}>
        {client && <div className="reference-job"><label htmlFor={`${uid}-job`}>Search job link or ID<Input id={`${uid}-job`} value={jobInput} onChange={e => setJobInput(e.target.value)} placeholder="Paste a completed search URL or job ID"/></label><Button className="button secondary compact" variant="outline" type="button" disabled={searchBusy || !jobInput.trim()} onClick={() => void importJob()}>Import search job</Button><p>Captures the executed SPL and its original resolved time bounds while the job is available.</p></div>}
        <div className="reference-grid">
        <label htmlFor={`${uid}-st`}>Search title<Input id={`${uid}-st`} value={search.title} required onChange={e => setS({ title: e.target.value })}/></label>
        <label htmlFor={`${uid}-sk`}>Search type<select id={`${uid}-sk`} value={search.kind} onChange={e => setS({ kind: e.target.value as SearchReference['kind'], query: '', earliest: e.target.value === 'saved' ? '' : '-24h', latest: e.target.value === 'saved' ? '' : 'now', sourceJobId: undefined, timeSource: undefined })}><option value="adhoc">SPL search</option><option value="saved">Saved report</option></select></label>
        {search.kind === 'adhoc' ? <label className="reference-wide" htmlFor={`${uid}-sq`}>Search SPL<Textarea id={`${uid}-sq`} value={search.query} required onChange={e => setS({ query: e.target.value })}/></label> : <><label htmlFor={`${uid}-sn`}>Saved report name<Input id={`${uid}-sn`} value={search.savedName || ''} required onChange={e => setS({ savedName: e.target.value })}/></label><label htmlFor={`${uid}-so`}>Saved report owner<Input id={`${uid}-so`} value={search.savedOwner || ''} required onChange={e => setS({ savedOwner: e.target.value })}/></label></>}
        <label htmlFor={`${uid}-se`}>Earliest<Input id={`${uid}-se`} value={search.earliest} required onChange={e => setS({ earliest: e.target.value })}/></label><label htmlFor={`${uid}-sl`}>Latest<Input id={`${uid}-sl`} value={search.latest} required onChange={e => setS({ latest: e.target.value })}/></label>
        <label htmlFor={`${uid}-sa`}>Splunk app<Input id={`${uid}-sa`} value={search.app} required onChange={e => setS({ app: e.target.value })}/></label>
        <label htmlFor={`${uid}-sf`}>Linked finding<select id={`${uid}-sf`} value={search.findingId || ''} onChange={e => setS({ findingId: e.target.value || undefined })}><option value="">Report only</option>{references.findings.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}</select></label>
        <label className="reference-wide" htmlFor={`${uid}-sd`}>Search notes<Textarea id={`${uid}-sd`} value={search.note} onChange={e => setS({ note: e.target.value })}/></label>
      </div><p className="reference-time-help">Times are fixed when added. Use epoch seconds or ISO 8601 with a timezone to enter a past window. SPL time modifiers, dynamic time functions, and savedsearch/loadjob commands must be replaced with fixed values. Macros and data changes may still affect results.</p><Button className="button secondary compact" variant="outline" type="submit" disabled={searchBusy}>{search.id ? 'Update search' : 'Add search'}</Button>{search.id && <button type="button" onClick={() => setSearch(emptySearch())}>Cancel edit</button>}</fieldset></form>
    </section>
  </div>;
}
