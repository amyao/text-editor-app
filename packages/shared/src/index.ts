export const DEFAULT_DOCUMENT_ID = 'remote-work-draft'

export type UserPresence = {
  id: string
  name: string
  color: string
}

export type DocumentSummary = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export type Revision = {
  id: number
  documentId: string
  label: string
  contentHtml: string
  createdBy: string
  createdAt: string
}

export type CreateRevisionInput = Pick<
  Revision,
  'label' | 'contentHtml' | 'createdBy'
>

export type Comment = {
  id: number
  documentId: string
  authorId: string
  authorName: string
  body: string
  selectionFrom: number
  selectionTo: number
  quotedText: string
  resolved: boolean
  createdAt: string
}

export type Review = {
  id: number
  documentId: string
  authorId: string
  authorName: string
  selectionFrom: number
  selectionTo: number
  quotedText: string
  status: 'in_review' | 'completed'
  createdAt: string
  completedAt: string | null
}

export type CreateCommentInput = Pick<
  Comment,
  'authorId' | 'authorName' | 'body' | 'selectionFrom' | 'selectionTo' | 'quotedText'
>

export type CreateReviewInput = Pick<
  Review,
  'authorId' | 'authorName' | 'selectionFrom' | 'selectionTo' | 'quotedText'
>
