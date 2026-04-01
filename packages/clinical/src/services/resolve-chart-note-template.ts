export enum ChartNoteTemplateType {
  GENERAL = 'GENERAL',
  FOLLOW_UP = 'FOLLOW_UP',
}

export enum ChartNoteTemplateDiscipline {
  PHYSICAL_THERAPY = 'PHYSICAL_THERAPY',
  OCCUPATIONAL_THERAPY = 'OCCUPATIONAL_THERAPY',
}

export enum PhysicalTherapyChartNoteTemplateType {
  INITIAL_EVALUATION = 'INITIAL_EVALUATION',
  SOAP_NOTE = 'SOAP_NOTE',
}

export type ChartNoteTemplate = {
  id: string
  name: string
  content: string
} & (
  | {
      discipline: ChartNoteTemplateDiscipline.PHYSICAL_THERAPY
      type: PhysicalTherapyChartNoteTemplateType
    }
  | {
      discipline: ChartNoteTemplateDiscipline.OCCUPATIONAL_THERAPY
      type: ChartNoteTemplateType.GENERAL
    }
)

export type ResolveChartNoteTemplateInput = {
  discipline: ChartNoteTemplateDiscipline
  appointmentType?: 'initial' | 'follow_up'
}

/**
 * WARNING: This is a mock implementation
 * Depends on the discipline and appointment type
 * Returns the default chart note template for the given discipline and appointment type
 * Each discipline has a default template for each appointment type
 * Each User has a default template for each discipline and appointment type
 * @param input
 * @returns
 */
function resolveChartNoteTemplate(input: ResolveChartNoteTemplateInput): ChartNoteTemplate {
  if (input.discipline === ChartNoteTemplateDiscipline.PHYSICAL_THERAPY) {
    if (input.appointmentType === 'initial') {
      return {
        id: 'template-1',
        name: 'Physical Therapy Initial Evaluation',
        content: 'Template content for physical therapy initial evaluation...',
        discipline: ChartNoteTemplateDiscipline.PHYSICAL_THERAPY,
        type: PhysicalTherapyChartNoteTemplateType.INITIAL_EVALUATION,
      }
    } else {
      return {
        id: 'template-2',
        name: 'Physical Therapy SOAP Note',
        content: 'Template content for physical therapy SOAP note...',
        discipline: ChartNoteTemplateDiscipline.PHYSICAL_THERAPY,
        type: PhysicalTherapyChartNoteTemplateType.SOAP_NOTE,
      }
    }
  } else {
    return {
      id: 'template-3',
      name: 'Occupational Therapy General Note',
      content: 'Template content for occupational therapy general note...',
      discipline: ChartNoteTemplateDiscipline.OCCUPATIONAL_THERAPY,
      type: ChartNoteTemplateType.GENERAL,
    }
  }
}

export default resolveChartNoteTemplate
