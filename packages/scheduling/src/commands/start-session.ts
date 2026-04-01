import {
  StartSessionResponse,
  AppointmentNotFoundError,
  InvalidStateTransitionError,
  SessionAlreadyActiveError,
  PractitionerNotAssignedError,
} from '@careos/api-contract';
import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '@careos/db';
import { appointments, sessions } from '@careos/db';

export async function startSession(
  db: DrizzleDB,
  input: { appointmentId: string; practitionerId: string },
): Promise<StartSessionResponse> {
  // 1. Fetch appointment
  const appointment = await db.query.appointments.findFirst({
    where: eq(appointments.id, input.appointmentId),
  });

  db.query.appointments.findFirst({
    where: eq(appointments.id, input.appointmentId),
  });

  if (!appointment) {
    throw new AppointmentNotFoundError(input.appointmentId);
  }

  // 2. Validate business rules
  if (appointment.status !== 'scheduled') {
    throw new InvalidStateTransitionError(appointment.status, 'in_session');
  }

  if (appointment.practitionerId !== input.practitionerId) {
    throw new PractitionerNotAssignedError(input.practitionerId, input.appointmentId);
  }

  // 3. Check no existing session
  const existingSession = await db.query.sessions.findFirst({
    where: eq(sessions.appointmentId, input.appointmentId),
  });

  if (existingSession) {
    throw new SessionAlreadyActiveError(input.appointmentId);
  }

  // 4. Create session + update appointment (atomic)
  const now = new Date();

  const [session] = await db.insert(sessions).values({
    appointmentId: input.appointmentId,
    practitionerId: input.practitionerId,
    status: 'active',
    startedAt: now,
  }).returning();

  await db.update(appointments)
    .set({ status: 'in_session', updatedAt: now })
    .where(eq(appointments.id, input.appointmentId));

  // 5. Return response
  return {
    sessionId: session.id,
    appointmentId: input.appointmentId,
    practitionerId: input.practitionerId,
    startedAt: now.toISOString(),
    status: 'active',
  };
}