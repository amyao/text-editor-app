import cors from 'cors'
import express from 'express'
import type { CreateCommentInput, CreateReviewInput } from '@text-editor/shared'
import {
  completeReview,
  createComment,
  createRevision,
  createReview,
  ensureDocument,
  listComments,
  listDocuments,
  listReviews,
  listRevisions,
  renameRevision,
  resolveComment,
  updateDocumentTitle,
} from './database.js'

export function createApi() {
  const app = express()
  const isValidSelection = (body: Record<string, unknown>) =>
    Number.isInteger(body.selectionFrom) &&
    Number.isInteger(body.selectionTo) &&
    Number(body.selectionFrom) >= 0 &&
    Number(body.selectionTo) > Number(body.selectionFrom) &&
    typeof body.quotedText === 'string' &&
    body.quotedText.trim().length > 0
  const isValidAuthor = (body: Record<string, unknown>) =>
    typeof body.authorId === 'string' &&
    body.authorId.trim().length > 0 &&
    typeof body.authorName === 'string' &&
    body.authorName.trim().length > 0

  app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' }))
  app.use(express.json())

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true, service: 'text-editor-server' })
  })

  app.get('/api/documents', (_request, response) => {
    response.json(listDocuments())
  })

  app.put('/api/documents/:documentId', (request, response) => {
    const documentId = request.params.documentId
    const title = String(request.body.title ?? '').trim()
    if (!title) {
      response.status(400).json({ error: 'A document title is required.' })
      return
    }
    ensureDocument(documentId, title)
    updateDocumentTitle(documentId, title)
    response.status(204).send()
  })

  app.get('/api/documents/:documentId/revisions', (request, response) => {
    response.json(listRevisions(request.params.documentId))
  })

  app.post('/api/documents/:documentId/revisions', (request, response) => {
    const contentHtml = String(request.body.contentHtml ?? '')
    const label = String(request.body.label ?? '').trim()
    const createdBy = String(request.body.createdBy ?? '').trim()
    if (!contentHtml || !label || !createdBy) {
      response.status(400).json({ error: 'Revision content is required.' })
      return
    }
    const revision = createRevision(
      request.params.documentId,
      label,
      createdBy,
      contentHtml,
    )
    response.status(201).json(revision)
  })

  app.patch('/api/revisions/:revisionId', (request, response) => {
    const revisionId = Number(request.params.revisionId)
    const label = String(request.body.label ?? '').trim()
    if (!Number.isInteger(revisionId) || revisionId < 1 || !label) {
      response.status(400).json({ error: 'A valid revision id and name are required.' })
      return
    }
    const revision = renameRevision(revisionId, label)
    if (!revision) {
      response.status(404).json({ error: 'Revision not found.' })
      return
    }
    response.json(revision)
  })

  app.get('/api/documents/:documentId/comments', (request, response) => {
    response.json(listComments(request.params.documentId))
  })

  app.post('/api/documents/:documentId/comments', (request, response) => {
    const body = request.body as Record<string, unknown>
    if (
      !isValidAuthor(body) ||
      !isValidSelection(body) ||
      typeof body.body !== 'string' ||
      body.body.trim().length === 0
    ) {
      response.status(400).json({ error: 'A valid comment and text selection are required.' })
      return
    }
    const comment = createComment(
      request.params.documentId,
      request.body as CreateCommentInput,
    )
    response.status(201).json(comment)
  })

  app.patch('/api/comments/:commentId/resolve', (request, response) => {
    const commentId = Number(request.params.commentId)
    if (!Number.isInteger(commentId) || commentId < 1) {
      response.status(400).json({ error: 'A valid comment id is required.' })
      return
    }
    const comment = resolveComment(commentId)
    if (!comment) {
      response.status(404).json({ error: 'Comment not found.' })
      return
    }
    response.json(comment)
  })

  app.get('/api/documents/:documentId/reviews', (request, response) => {
    response.json(listReviews(request.params.documentId))
  })

  app.post('/api/documents/:documentId/reviews', (request, response) => {
    const body = request.body as Record<string, unknown>
    if (!isValidAuthor(body) || !isValidSelection(body)) {
      response.status(400).json({ error: 'A valid author and text selection are required.' })
      return
    }
    const review = createReview(
      request.params.documentId,
      request.body as CreateReviewInput,
    )
    response.status(201).json(review)
  })

  app.patch('/api/reviews/:reviewId/complete', (request, response) => {
    const reviewId = Number(request.params.reviewId)
    if (!Number.isInteger(reviewId) || reviewId < 1) {
      response.status(400).json({ error: 'A valid review id is required.' })
      return
    }
    const review = completeReview(reviewId)
    if (!review) {
      response.status(404).json({ error: 'Review not found.' })
      return
    }
    response.json(review)
  })

  app.use((_request, response) => {
    response.status(404).json({ error: 'Route not found.' })
  })

  return app
}
