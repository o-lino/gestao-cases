/**
 * Hierarchy Service
 * API client for organizational hierarchy management
 */

import api from './api'

// Enums and Types
export type JobLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export const JobLevelLabels: Record<JobLevel, string> = {
  1: 'Analista',
  2: 'Especialista',
  3: 'Coordenador',
  4: 'Gerente',
  5: 'Gerente Sênior',
  6: 'Diretor',
  7: 'Diretor Executivo',
  8: 'Vice-Presidente'
}

export interface CollaboratorBrief {
  id: number
  email: string
  name: string
}

export interface HierarchyEntry {
  id: number
  collaboratorId: number
  supervisorId: number | null
  jobLevel: JobLevel
  jobTitle: string | null
  department: string | null
  costCenter: string | null
  isActive: boolean
  jobLevelLabel: string
  createdAt: string
  updatedAt: string | null
  collaborator: CollaboratorBrief | null
  supervisor: CollaboratorBrief | null
}

export interface HierarchyCreate {
  collaboratorId: number
  supervisorId?: number | null
  jobLevel: JobLevel
  jobTitle?: string
  department?: string
  costCenter?: string
}

export interface HierarchyUpdate {
  supervisorId?: number | null
  jobLevel?: JobLevel
  jobTitle?: string
  department?: string
  costCenter?: string
  isActive?: boolean
}

export interface HierarchyListResponse {
  items: HierarchyEntry[]
  total: number
}

export interface BulkHierarchyResult {
  created: number
  updated: number
  errors: Array<{ collaboratorId: number; error: string }>
}

// Transform functions (snake_case -> camelCase)
function transformHierarchy(data: any): HierarchyEntry {
  return {
    id: data.id,
    collaboratorId: data.collaborator_id,
    supervisorId: data.supervisor_id,
    jobLevel: data.job_level,
    jobTitle: data.job_title,
    department: data.department,
    costCenter: data.cost_center,
    isActive: data.is_active,
    jobLevelLabel: data.job_level_label,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    collaborator: data.collaborator,
    supervisor: data.supervisor
  }
}

// API Functions
export const hierarchyService = {
  /**
   * Get all job levels
   */
  async getJobLevels(): Promise<Array<{ level: number; label: string }>> {
    const response = await api.get('/hierarchy/job-levels')
    return response.data
  },

  /**
   * Create a hierarchy entry
   */
  async create(data: HierarchyCreate): Promise<HierarchyEntry> {
    const response = await api.post('/hierarchy/', {
      collaborator_id: data.collaboratorId,
      supervisor_id: data.supervisorId,
      job_level: data.jobLevel,
      job_title: data.jobTitle,
      department: data.department,
      cost_center: data.costCenter
    })
    return transformHierarchy(response.data)
  },

  /**
   * List hierarchy entries with filters
   */
  async list(params?: {
    department?: string
    jobLevel?: number
    isActive?: boolean
    skip?: number
    limit?: number
  }): Promise<HierarchyListResponse> {
    const queryParams: any = {}
    if (params?.department) queryParams.department = params.department
    if (params?.jobLevel) queryParams.job_level = params.jobLevel
    if (params?.isActive !== undefined) queryParams.is_active = params.isActive
    if (params?.skip) queryParams.skip = params.skip
    if (params?.limit) queryParams.limit = params.limit

    const response = await api.get('/hierarchy/', { params: queryParams })
    return {
      items: response.data.items.map(transformHierarchy),
      total: response.data.total
    }
  },

  /**
   * Get current user's hierarchy
   */
  async getMyHierarchy(): Promise<HierarchyEntry | null> {
    const response = await api.get('/hierarchy/my-hierarchy')
    return response.data ? transformHierarchy(response.data) : null
  },

  /**
   * Get current user's hierarchy chain
   */
  async getMyChain(): Promise<HierarchyEntry[]> {
    const response = await api.get('/hierarchy/my-chain')
    return response.data.map(transformHierarchy)
  },

  /**
   * Get current user's direct reports
   */
  async getMyDirectReports(): Promise<HierarchyEntry[]> {
    const response = await api.get('/hierarchy/my-direct-reports')
    return response.data.map(transformHierarchy)
  },

  /**
   * Get hierarchy for a collaborator
   */
  async getForCollaborator(collaboratorId: number): Promise<HierarchyEntry | null> {
    const response = await api.get(`/hierarchy/collaborator/${collaboratorId}`)
    return response.data ? transformHierarchy(response.data) : null
  },

  /**
   * Update hierarchy entry
   */
  async update(collaboratorId: number, data: HierarchyUpdate): Promise<HierarchyEntry> {
    const response = await api.patch(`/hierarchy/collaborator/${collaboratorId}`, {
      supervisor_id: data.supervisorId,
      job_level: data.jobLevel,
      job_title: data.jobTitle,
      department: data.department,
      cost_center: data.costCenter,
      is_active: data.isActive
    })
    return transformHierarchy(response.data)
  },

  /**
   * Delete (deactivate) hierarchy entry
   */
  async delete(collaboratorId: number): Promise<void> {
    await api.delete(`/hierarchy/collaborator/${collaboratorId}`)
  },

  /**
   * Bulk create/update hierarchy entries
   */
  async bulkCreate(entries: HierarchyCreate[]): Promise<BulkHierarchyResult> {
    const response = await api.post('/hierarchy/bulk', {
      entries: entries.map(e => ({
        collaborator_id: e.collaboratorId,
        supervisor_id: e.supervisorId,
        job_level: e.jobLevel,
        job_title: e.jobTitle,
        department: e.department,
        cost_center: e.costCenter
      }))
    })
    return response.data
  }
}

export default hierarchyService
