import type { Section, Template } from './report';

const sectionPrompts: Record<string, string> = {
  general: 'Identify the report, its handling requirements and its priority for the intended audience.',
  executive_summary: 'Summarize the main finding, its relevance to the audience and the action it supports.',
  key_points: 'List the few findings the reader should retain, including the evidence or change behind each one.',
  assessment: 'Explain what the evidence means, distinguish observations from judgments and state confidence or uncertainty.',
  threat_actor_summary: 'Describe the actor’s activity, capabilities, infrastructure, victims and attribution, with uncertainty where appropriate.',
  timeline_of_activity: 'Record meaningful activity in time order; include dates, affected locations and the observed action.',
  key_intelligence_gaps: 'Identify unanswered questions, why they matter and what evidence would reduce uncertainty.',
  mitre_attack: 'Map observed or assessed behavior to ATT&CK and describe the procedure and relevant defensive controls.',
  victims: 'Describe affected organizations or populations using the evidence available; distinguish confirmed from assessed victims.',
  iocs: 'Add actionable indicators and context that defenders can use for hunting, including relevant dates and limitations.',
  signatures: 'Document detection signatures and the context needed to use or validate them.',
  intelligence_requirements: 'Connect this report to the intelligence requirements or decisions it addresses.',
  data_sources: 'Identify the sources and internal telemetry supporting the report so readers can evaluate the evidence.',
  metadata: 'Add structured context for discovery and reuse, including actors, affected sectors and relevant infrastructure.',
  indicator_analysis: 'Explain what the indicators show, how they relate to the intrusion and how responders can use them.',
  outlook: 'Describe plausible developments, the conditions that could change the assessment and implications for decisions.'
};

const summaryPrompts: Record<string, string> = {
  'Threat Actor Profile': 'Summarize who the actor is, the activity relevant to your organization and the actions this profile supports.',
  'Campaign Report': 'Summarize what changed in the campaign, why it matters to your organization and the action it supports.',
  'Intrusion Analysis Report': 'Summarize the intrusion, the most actionable observations and the immediate implications for hunters and responders.',
  'Executive Report': 'Explain the risk to decision-makers, its business implications and the decision or action being requested.'
};

const summaryExamples: Record<string, string> = {
  'Threat Actor Profile': '[Actor] has used [behavior] against [victim group]. Relevance: [organizational exposure].',
  'Campaign Report': 'New activity: [change]. This changes [risk] because [supporting evidence].',
  'Intrusion Analysis Report': 'Observed activity: [behavior and time]. Responders should investigate [actionable indicator].',
  'Executive Report': 'Risk: [business impact], supported by [evidence]. Decision requested: [action].'
};

const sectionExamples: Record<string, string> = {
  key_points: '[Finding] is supported by [evidence] and matters because [impact].',
  assessment: 'We assess [judgment] with [confidence], based on [evidence]. An alternative explanation is [alternative].',
  indicator_analysis: '[Indicator] was observed in [context]. Search [data source] for [related activity].',
  outlook: 'If [condition] occurs, [development] may affect [business or operational objective].',
  key_intelligence_gaps: 'We do not yet know [question]; [source or collection activity] could clarify it.'
};

export function sectionGuidance(template: Template, section: Section): string {
  if (section.id === 'executive_summary') return summaryPrompts[template.name] || sectionPrompts.executive_summary;
  return sectionPrompts[section.id] || `Describe ${section.name || 'this section'} and explain its relevance to the report’s audience.`;
}

export function sectionExample(template: Template, section: Section): string | undefined {
  return section.id === 'executive_summary' ? summaryExamples[template.name] : sectionExamples[section.id];
}
