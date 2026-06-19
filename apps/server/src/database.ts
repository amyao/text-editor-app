import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import type {
  Comment,
  CreateCommentInput,
  CreateReviewInput,
  DocumentSummary,
  Review,
  Revision,
} from '@text-editor/shared'

const appDirectory = dirname(fileURLToPath(import.meta.url))
const defaultDatabasePath = resolve(appDirectory, '../../../data/editor.db')
const databasePath = process.env.DATABASE_PATH ?? defaultDatabasePath

mkdirSync(dirname(databasePath), { recursive: true })

export const database = new DatabaseSync(databasePath)

database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    ydoc BLOB,
    content_html TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL,
    label TEXT NOT NULL,
    ydoc BLOB,
    content_html TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    body TEXT NOT NULL,
    selection_from INTEGER NOT NULL,
    selection_to INTEGER NOT NULL,
    quoted_text TEXT NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    selection_from INTEGER NOT NULL,
    selection_to INTEGER NOT NULL,
    quoted_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_review',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  );
`)

type DocumentRow = {
  id: string
  title: string
  ydoc: Uint8Array | null
  content_html: string
  created_at: string
  updated_at: string
}

export function ensureDocument(id: string, title = 'Untitled document') {
  database
    .prepare('INSERT OR IGNORE INTO documents (id, title) VALUES (?, ?)')
    .run(id, title)
}

export function getDocumentUpdate(id: string): Uint8Array | null {
  const row = database
    .prepare('SELECT ydoc FROM documents WHERE id = ?')
    .get(id) as Pick<DocumentRow, 'ydoc'> | undefined
  return row?.ydoc ?? null
}

export function storeDocumentUpdate(id: string, update: Uint8Array) {
  ensureDocument(id)
  database
    .prepare('UPDATE documents SET ydoc = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(update, id)
}

export function listDocuments(): DocumentSummary[] {
  const rows = database
    .prepare('SELECT id, title, created_at, updated_at FROM documents ORDER BY updated_at DESC')
    .all() as Omit<DocumentRow, 'ydoc' | 'content_html'>[]
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export function updateDocumentTitle(id: string, title: string) {
  ensureDocument(id, title)
  database
    .prepare('UPDATE documents SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(title, id)
}

export function createRevision(
  documentId: string,
  label: string,
  createdBy: string,
  contentHtml: string,
): Revision {
  ensureDocument(documentId)
  database
    .prepare(
      'UPDATE documents SET content_html = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    )
    .run(contentHtml, documentId)
  const document = database
    .prepare('SELECT ydoc, content_html FROM documents WHERE id = ?')
    .get(documentId) as Pick<DocumentRow, 'ydoc' | 'content_html'>
  const result = database
    .prepare(
      `INSERT INTO revisions (document_id, label, ydoc, content_html, created_by)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(documentId, label, document.ydoc, contentHtml, createdBy)
  return getRevision(Number(result.lastInsertRowid))
}

function getRevision(id: number): Revision {
  const row = database.prepare('SELECT * FROM revisions WHERE id = ?').get(id) as {
    id: number
    document_id: string
    label: string
    content_html: string
    created_by: string
    created_at: string
  }
  return {
    id: row.id,
    documentId: row.document_id,
    label: row.label,
    contentHtml: row.content_html,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export function listRevisions(documentId: string): Revision[] {
  const rows = database
    .prepare('SELECT id FROM revisions WHERE document_id = ? ORDER BY created_at DESC')
    .all(documentId) as { id: number }[]
  return rows.map(({ id }) => getRevision(id))
}

function mapComment(row: Record<string, unknown>): Comment {
  return {
    id: Number(row.id),
    documentId: String(row.document_id),
    authorId: String(row.author_id),
    authorName: String(row.author_name),
    body: String(row.body),
    selectionFrom: Number(row.selection_from),
    selectionTo: Number(row.selection_to),
    quotedText: String(row.quoted_text),
    resolved: Boolean(row.resolved),
    createdAt: String(row.created_at),
  }
}

export function listComments(documentId: string): Comment[] {
  return (
    database
      .prepare('SELECT * FROM comments WHERE document_id = ? ORDER BY created_at DESC')
      .all(documentId) as Record<string, unknown>[]
  ).map(mapComment)
}

export function createComment(documentId: string, input: CreateCommentInput): Comment {
  ensureDocument(documentId)
  const result = database
    .prepare(
      `INSERT INTO comments
       (document_id, author_id, author_name, body, selection_from, selection_to, quoted_text)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      documentId,
      input.authorId,
      input.authorName,
      input.body,
      input.selectionFrom,
      input.selectionTo,
      input.quotedText,
    )
  const row = database
    .prepare('SELECT * FROM comments WHERE id = ?')
    .get(result.lastInsertRowid) as Record<string, unknown>
  return mapComment(row)
}

export function resolveComment(id: number): Comment {
  database.prepare('UPDATE comments SET resolved = 1 WHERE id = ?').run(id)
  const row = database
    .prepare('SELECT * FROM comments WHERE id = ?')
    .get(id) as Record<string, unknown>
  return mapComment(row)
}

function mapReview(row: Record<string, unknown>): Review {
  return {
    id: Number(row.id),
    documentId: String(row.document_id),
    authorId: String(row.author_id),
    authorName: String(row.author_name),
    selectionFrom: Number(row.selection_from),
    selectionTo: Number(row.selection_to),
    quotedText: String(row.quoted_text),
    status: row.status === 'completed' ? 'completed' : 'in_review',
    createdAt: String(row.created_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  }
}

export function listReviews(documentId: string): Review[] {
  return (
    database
      .prepare('SELECT * FROM reviews WHERE document_id = ? ORDER BY created_at DESC')
      .all(documentId) as Record<string, unknown>[]
  ).map(mapReview)
}

export function createReview(documentId: string, input: CreateReviewInput): Review {
  ensureDocument(documentId)
  const result = database
    .prepare(
      `INSERT INTO reviews
       (document_id, author_id, author_name, selection_from, selection_to, quoted_text)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      documentId,
      input.authorId,
      input.authorName,
      input.selectionFrom,
      input.selectionTo,
      input.quotedText,
    )
  const row = database
    .prepare('SELECT * FROM reviews WHERE id = ?')
    .get(result.lastInsertRowid) as Record<string, unknown>
  return mapReview(row)
}

export function completeReview(id: number): Review {
  database
    .prepare(
      `UPDATE reviews
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .run(id)
  const row = database
    .prepare('SELECT * FROM reviews WHERE id = ?')
    .get(id) as Record<string, unknown>
  return mapReview(row)
}
