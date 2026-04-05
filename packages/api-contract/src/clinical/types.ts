export interface CreateTemplateRequest {
  name: string
  discipline: string
  appointmentType: 'initial' | 'follow_up'
  content: { sections: string[] }
  isDefault?: boolean
}

export interface UpdateTemplateRequest {
  name?: string
  content?: { sections: string[] }
}

export interface TemplateResponse {
  id: string
  name: string
  discipline: string
  appointmentType: 'initial' | 'follow_up'
  content: unknown
  version: number
  parentTemplateId: string | null
  isDefault: boolean
  isArchived: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
}
