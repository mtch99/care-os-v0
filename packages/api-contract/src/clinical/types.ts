import type { TemplateContentV2 } from './template-content-schema'

export interface CreateTemplateRequest {
  name: string
  discipline: string
  appointmentType: 'initial' | 'follow_up'
  content: TemplateContentV2
  isDefault?: boolean
}

export interface UpdateTemplateRequest {
  name?: string
  content?: TemplateContentV2
}

export interface TemplateResponse {
  id: string
  name: string
  discipline: string
  appointmentType: 'initial' | 'follow_up'
  content: TemplateContentV2
  version: number
  parentTemplateId: string | null
  isDefault: boolean
  isArchived: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
}
