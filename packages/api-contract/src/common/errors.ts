export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message)
  }
}

export class AppointmentNotFoundError extends DomainError {
  constructor(appointmentId: string) {
    super('APPOINTMENT_NOT_FOUND', `Appointment ${appointmentId} not found`, 404)
  }
}

export class InvalidStateTransitionError extends DomainError {
  constructor(currentStatus: string, targetStatus: string) {
    super(
      'INVALID_STATE_TRANSITION',
      `Cannot transition from ${currentStatus} to ${targetStatus}`,
      409,
    )
  }
}

export class SessionAlreadyActiveError extends DomainError {
  constructor(appointmentId: string) {
    super(
      'SESSION_ALREADY_ACTIVE',
      `A session already exists for appointment ${appointmentId}`,
      409,
    )
  }
}

export class PractitionerNotAssignedError extends DomainError {
  constructor(practitionerId: string, appointmentId: string) {
    super(
      'PRACTITIONER_NOT_ASSIGNED',
      `Practitioner ${practitionerId} is not assigned to appointment ${appointmentId}`,
      403,
    )
  }
}

export class TemplateNotFoundError extends DomainError {
  constructor(templateId: string) {
    super('TEMPLATE_NOT_FOUND', `Template ${templateId} not found`, 404)
  }
}

export class DefaultTemplateNotFoundError extends DomainError {
  constructor(discipline: string, appointmentType: string) {
    super(
      'DEFAULT_TEMPLATE_NOT_FOUND',
      `No default template found for ${discipline} / ${appointmentType}`,
      404,
    )
  }
}

export class CannotArchiveDefaultTemplateError extends DomainError {
  constructor(templateId: string) {
    super(
      'CANNOT_ARCHIVE_DEFAULT_TEMPLATE',
      `Cannot archive template ${templateId} because it is the default. Reassign the default first.`,
      409,
    )
  }
}

export class TemplateArchivedError extends DomainError {
  constructor(templateId: string) {
    super('TEMPLATE_ARCHIVED', `Template ${templateId} is archived`, 409)
  }
}

export class DefaultAlreadyExistsError extends DomainError {
  constructor(discipline: string, appointmentType: string) {
    super(
      'DEFAULT_ALREADY_EXISTS',
      `A default template already exists for ${discipline} / ${appointmentType}`,
      409,
    )
  }
}

export class TemplateValidationError extends DomainError {
  constructor(public readonly details: string[]) {
    super(
      'TEMPLATE_VALIDATION_ERROR',
      `Template content validation failed: ${details.join('; ')}`,
      422,
    )
  }
}

// --- AI Chart Note Draft errors (CAR-98) ---

export class ChartNoteNotFoundError extends DomainError {
  constructor(chartNoteId: string) {
    super('CHART_NOTE_NOT_FOUND', `Chart note ${chartNoteId} not found`, 404)
  }
}

export class ChartNoteNotDraftError extends DomainError {
  constructor() {
    super('CHART_NOTE_NOT_DRAFT', 'Chart note must be in draft status.', 409)
  }
}

export class AiDraftAlreadyPendingError extends DomainError {
  constructor() {
    super('AI_DRAFT_ALREADY_PENDING', 'An AI draft is already pending for this chart note.', 409)
  }
}

export class AiGenerationFailedError extends DomainError {
  constructor() {
    super('AI_GENERATION_FAILED', 'AI service unavailable. Try again later.', 502)
  }
}

export class DraftNotFoundError extends DomainError {
  constructor() {
    super('DRAFT_NOT_FOUND', 'AI draft not found.', 404)
  }
}

export class DraftAlreadyResolvedError extends DomainError {
  constructor() {
    super('DRAFT_ALREADY_RESOLVED', 'This draft was already accepted or rejected.', 409)
  }
}
