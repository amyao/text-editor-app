import {
  type Comment,
  type CreateCommentInput,
  type CreateRevisionInput,
  type CreateReviewInput,
  type Revision,
  type RenameRevisionInput,
  type Review,
} from '@text-editor/shared'
import { apiUrl, currentDocumentId } from './config'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, options)
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function getComments(): Promise<Comment[]> {
  return request(`/api/documents/${currentDocumentId}/comments`)
}

export function postComment(input: CreateCommentInput): Promise<Comment> {
  return request(`/api/documents/${currentDocumentId}/comments`, {
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
  return request(`/api/documents/${currentDocumentId}/revisions`)
}

export function postRevision(input: CreateRevisionInput): Promise<Revision> {
  return request(`/api/documents/${currentDocumentId}/revisions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function renameRevision(
  revisionId: number,
  input: RenameRevisionInput,
): Promise<Revision> {
  return request(`/api/revisions/${revisionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function getReviews(): Promise<Review[]> {
  return request(`/api/documents/${currentDocumentId}/reviews`)
}

export function postReview(input: CreateReviewInput): Promise<Review> {
  return request(`/api/documents/${currentDocumentId}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function completeReview(reviewId: number): Promise<Review> {
  return request(`/api/reviews/${reviewId}/complete`, {
    method: 'PATCH',
  })
}
