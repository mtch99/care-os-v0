export interface StartSessionRequest {
  appointmentId: string;
}

export interface StartSessionResponse {
  sessionId: string;
  appointmentId: string;
  practitionerId: string;
  startedAt: string;
  status: 'active';
}