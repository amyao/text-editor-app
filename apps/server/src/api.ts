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
  resolveComment,
  updateDocumentTitle,
} from './database.js'

export function createApi() {
  const app = express()

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
    const revision = createRevision(
      request.params.documentId,
      String(request.body.label ?? 'Manual snapshot'),
      String(request.body.createdBy ?? 'Anonymous'),
    )
    response.status(201).json(revision)
  })

  app.get('/api/documents/:documentId/comments', (request, response) => {
    response.json(listComments(request.params.documentId))
  })

  app.post('/api/documents/:documentId/comments', (request, response) => {
    const comment = createComment(
      request.params.documentId,
      request.body as CreateCommentInput,
    )
    response.status(201).json(comment)
  })

  app.patch('/api/comments/:commentId/resolve', (request, response) => {
    response.json(resolveComment(Number(request.params.commentId)))
  })

  app.get('/api/documents/:documentId/reviews', (request, response) => {
    response.json(listReviews(request.params.documentId))
  })

  app.post('/api/documents/:documentId/reviews', (request, response) => {
    const review = createReview(
      request.params.documentId,
      request.body as CreateReviewInput,
    )
    response.status(201).json(review)
  })

  app.patch('/api/reviews/:reviewId/complete', (request, response) => {
    response.json(completeReview(Number(request.params.reviewId)))
  })

  return app
}
