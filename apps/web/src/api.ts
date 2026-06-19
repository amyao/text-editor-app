import {
  DEFAULT_DOCUMENT_ID,
  type Comment,
  type CreateCommentInput,
  type CreateRevisionInput,
  type Revision,
} from '@text-editor/shared'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, options)
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function getComments(): Promise<Comment[]> {
  return request(`/api/documents/${DEFAULT_DOCUMENT_ID}/comments`)
}

export function postComment(input: CreateCommentInput): Promise<Comment> {
  return request(`/api/documents/${DEFAULT_DOCUMENT_ID}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function resolveComment(commentId: number): Promise<Comment> {
  return request(`/api/comments/${commentId}/resolve`, {
    method: 'PATCH',
  })
}

export function getRevisions(): Promise<Revision[]> {
  return request(`/api/documents/${DEFAULT_DOCUMENT_ID}/revisions`)
}

export function postRevision(input: CreateRevisionInput): Promise<Revision> {
  return request(`/api/documents/${DEFAULT_DOCUMENT_ID}/revisions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
