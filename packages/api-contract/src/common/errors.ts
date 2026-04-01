export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
  }
}

export class AppointmentNotFoundError extends DomainError {
  constructor(appointmentId: string) {
    super('APPOINTMENT_NOT_FOUND', `Appointment ${appointmentId} not found`, 404);
  }
}

export class InvalidStateTransitionError extends DomainError {
  constructor(currentStatus: string, targetStatus: string) {
    super('INVALID_STATE_TRANSITION', `Cannot transition from ${currentStatus} to ${targetStatus}`, 409);
  }
}

export class SessionAlreadyActiveError extends DomainError {
  constructor(appointmentId: string) {
    super('SESSION_ALREADY_ACTIVE', `A session already exists for appointment ${appointmentId}`, 409);
  }
}

export class PractitionerNotAssignedError extends DomainError {
  constructor(practitionerId: string, appointmentId: string) {
    super('PRACTITIONER_NOT_ASSIGNED', `Practitioner ${practitionerId} is not assigned to appointment ${appointmentId}`, 403);
  }
}