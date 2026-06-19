import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after } from 'node:test'

const databasePath = join(tmpdir(), `text-editor-${randomUUID()}.db`)
process.env.DATABASE_PATH = databasePath

const databaseModule = await import('./database.js')
const {
  completeReview,
  createComment,
  createRevision,
  createReview,
  database,
  ensureDocument,
  listComments,
  listDocuments,
  listReviews,
  listRevisions,
  renameRevision,
  resolveComment,
  storeDocumentUpdate,
  updateDocumentTitle,
} = databaseModule

after(() => {
  database.close()
  rmSync(databasePath, { force: true })
  rmSync(`${databasePath}-shm`, { force: true })
  rmSync(`${databasePath}-wal`, { force: true })
})

test('persists document metadata and Yjs updates', () => {
  ensureDocument('document-1', 'Initial title')
  updateDocumentTitle('document-1', 'Updated title')
  storeDocumentUpdate('document-1', new Uint8Array([1, 2, 3]))

  assert.deepEqual(listDocuments(), [
    {
      id: 'document-1',
      title: 'Updated title',
      createdAt: listDocuments()[0].createdAt,
      updatedAt: listDocuments()[0].updatedAt,
    },
  ])
})

test('creates, lists, and resolves anchored comments', () => {
  const comment = createComment('document-1', {
    authorId: 'user-1',
    authorName: 'Amy',
    body: 'Please clarify this sentence.',
    selectionFrom: 2,
    selectionTo: 10,
    quotedText: 'selected',
  })

  assert.equal(comment.resolved, false)
  assert.equal(listComments('document-1')[0].body, 'Please clarify this sentence.')
  assert.equal(resolveComment(comment.id)?.resolved, true)
})

test('creates and completes review records', () => {
  const review = createReview('document-1', {
    authorId: 'user-1',
    authorName: 'Amy',
    selectionFrom: 4,
    selectionTo: 12,
    quotedText: 'review me',
  })

  assert.equal(review.status, 'in_review')
  assert.equal(completeReview(review.id)?.status, 'completed')
  assert.ok(listReviews('document-1')[0].completedAt)
})

test('stores revision HTML for later restoration', () => {
  const revision = createRevision(
    'document-1',
    'Before rewrite',
    'Amy',
    '<h1>Saved version</h1>',
  )

  assert.equal(revision.contentHtml, '<h1>Saved version</h1>')
  assert.equal(listRevisions('document-1')[0].label, 'Before rewrite')
  assert.equal(renameRevision(revision.id, 'Approved draft')?.label, 'Approved draft')
})
