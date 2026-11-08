import { describe, expect, it } from 'vitest';
import { sectionExample, sectionGuidance } from '../src/guidance';
import { templates } from '../src/report';

describe('report writing guidance', () => {
  it('provides specific prompts for every section of each supplied template', () => {
    for (const template of templates) {
      for (const section of template.sections) {
        expect(sectionGuidance(template, section), `${template.name} / ${section.id}`).not.toMatch(/^Describe .*and explain its relevance/);
      }
    }
  });

  it('gives a distinct example framing for each report summary', () => {
    const examples = templates.map(template => sectionExample(template, template.sections.find(section => section.id === 'executive_summary')!));
    expect(examples.every(Boolean)).toBe(true);
    expect(new Set(examples).size).toBe(4);
  });
});
