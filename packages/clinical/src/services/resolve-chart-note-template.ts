// TODO(CAR-103): Replace this stub with real DB-backed template resolution

type Discipline = 'physiotherapy' | 'ergotherapy'
type AppointmentType = 'initial' | 'follow_up'

interface ResolveChartNoteTemplateInput {
  discipline: Discipline
  appointmentType?: AppointmentType
}

interface ChartNoteTemplateStub {
  id: string
  name: string
  discipline: Discipline
  appointmentType: AppointmentType
}

/**
 * @deprecated Mock implementation — returns hardcoded templates.
 * Will be replaced by real DB queries in CAR-103.
 */
function resolveChartNoteTemplate(input: ResolveChartNoteTemplateInput): ChartNoteTemplateStub {
  if (input.discipline === 'physiotherapy') {
    if (input.appointmentType === 'initial') {
      return {
        id: 'template-1',
        name: 'IAF — Physiotherapy',
        discipline: 'physiotherapy',
        appointmentType: 'initial',
      }
    }
    return {
      id: 'template-2',
      name: 'SOAP Note — Physiotherapy',
      discipline: 'physiotherapy',
      appointmentType: 'follow_up',
    }
  }

  return {
    id: 'template-3',
    name: 'General Note — Ergotherapy',
    discipline: 'ergotherapy',
    appointmentType: input.appointmentType ?? 'initial',
  }
}

export default resolveChartNoteTemplate
