import { DEFAULT_DOCUMENT_ID } from '@text-editor/shared'

const documentParameter = new URLSearchParams(window.location.search).get('document')

export const currentDocumentId =
  documentParameter?.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) ||
  DEFAULT_DOCUMENT_ID

export const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
export const collaborationUrl =
  import.meta.env.VITE_COLLABORATION_URL ?? 'ws://localhost:1234'

export function getShareUrl() {
  const url = new URL(window.location.href)
  url.searchParams.set('document', currentDocumentId)
  return url.toString()
}
