import { useCallback, useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'
import {
  DEFAULT_DOCUMENT_ID,
  type Comment,
  type Revision,
  type UserPresence,
} from '@text-editor/shared'
import {
  Bold,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Cloud,
  Eraser,
  Italic,
  List,
  ListOrdered,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  Redo2,
  RotateCcw,
  Share2,
  Sparkles,
  Undo2,
  Users,
} from 'lucide-react'
import { FontSize } from './extensions/FontSize'
import { CommentMark } from './extensions/CommentMark'
import {
  getComments,
  getRevisions,
  postComment,
  postRevision,
  resolveComment as resolveCommentRequest,
} from './api'

const STORAGE_KEY = 'draftly-document'
const USER_KEY = 'draftly-user'
const collaborationUrl =
  import.meta.env.VITE_COLLABORATION_URL ?? 'ws://localhost:1234'
const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const collaborativeDocument = new Y.Doc()
const collaborationProvider = new HocuspocusProvider({
  url: collaborationUrl,
  name: DEFAULT_DOCUMENT_ID,
  document: collaborativeDocument,
})

const initialContent = `
  <h1>The future of remote work</h1>
  <p class="lead">A short exploration of how thoughtful teams can build stronger cultures across distance.</p>
  <h2>Where we are today</h2>
  <p>Remote work is no longer an experiment. For many teams, it has become the default way of building, creating, and collaborating. The question is no longer <em>whether</em> distributed work can succeed—but how we can make it exceptional.</p>
  <blockquote><p>The best remote cultures are designed with intention, not inherited by accident.</p></blockquote>
  <h2>Principles for better collaboration</h2>
  <ul>
    <li><strong>Write things down.</strong> Shared context should not depend on who happened to be in the room.</li>
    <li><strong>Protect focus.</strong> Async communication gives people space to do their best thinking.</li>
    <li><strong>Create human moments.</strong> Distance makes small rituals and genuine connection more important.</li>
  </ul>
  <p>Great remote work feels less like a compromise and more like a deliberate advantage.</p>
`

const userPalette = ['#e07a5f', '#3d7a80', '#7a66a8', '#d49a46', '#557a54']

function getCurrentUser(): UserPresence {
  const storedUser = localStorage.getItem(USER_KEY)
  if (storedUser) return JSON.parse(storedUser) as UserPresence

  const user: UserPresence = {
    id: crypto.randomUUID(),
    name: `Guest ${Math.floor(Math.random() * 900 + 100)}`,
    color: userPalette[Math.floor(Math.random() * userPalette.length)],
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return user
}

function IconButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <button
      className={`icon-button ${active ? 'active' : ''}`}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function App() {
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [isSaved, setIsSaved] = useState(true)
  const [rightPanel, setRightPanel] = useState<'comments' | 'history' | null>('comments')
  const [documentTitle, setDocumentTitle] = useState('Remote work — first draft')
  const [, forceToolbarUpdate] = useState(0)
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentError, setCommentError] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [activeCommentId, setActiveCommentId] = useState<number | null>(null)
  const [selectedText, setSelectedText] = useState('')
  const [selectedRange, setSelectedRange] = useState<{ from: number; to: number } | null>(
    null,
  )
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [revisionsLoading, setRevisionsLoading] = useState(false)
  const [revisionSaving, setRevisionSaving] = useState(false)
  const [revisionError, setRevisionError] = useState('')

  const currentUser = useMemo(() => getCurrentUser(), [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      TextStyle,
      Color,
      FontSize,
      CommentMark,
      Collaboration.configure({ document: collaborativeDocument }),
      CollaborationCaret.configure({
        provider: collaborationProvider,
        user: currentUser,
      }),
    ],
    editorProps: {
      attributes: {
        class: 'editor-content',
        spellcheck: 'true',
      },
      handleClick: (_view, _position, event) => {
        const target = event.target as HTMLElement
        const highlight = target.closest<HTMLElement>('[data-comment-id]')
        if (!highlight) return false
        setActiveCommentId(Number(highlight.dataset.commentId))
        setRightPanel('comments')
        return false
      },
    },
    onUpdate: () => {
      setIsSaved(false)
      forceToolbarUpdate((value) => value + 1)
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      forceToolbarUpdate((value) => value + 1)
      const { from, to } = currentEditor.state.selection
      if (from !== to) {
        setSelectedRange({ from, to })
        setSelectedText(currentEditor.state.doc.textBetween(from, to, ' '))
      }
    },
  })

  useEffect(() => {
    const handleSynced = () => {
      setConnectionStatus('connected')
      if (editor?.isEmpty) {
        editor.commands.setContent(localStorage.getItem(STORAGE_KEY) ?? initialContent)
      }
    }
    const handleStatus = ({ status }: { status: string }) => setConnectionStatus(status)

    collaborationProvider.on('synced', handleSynced)
    collaborationProvider.on('status', handleStatus)
    if (collaborationProvider.isSynced) handleSynced()

    return () => {
      collaborationProvider.off('synced', handleSynced)
      collaborationProvider.off('status', handleStatus)
    }
  }, [editor])

  const saveDocument = useCallback(() => {
    if (!editor) return
    localStorage.setItem(STORAGE_KEY, editor.getHTML())
    setSavedAt(new Date())
    setIsSaved(true)
  }, [editor])

  useEffect(() => {
    if (!editor || isSaved) return
    const timer = window.setTimeout(saveDocument, 800)
    return () => window.clearTimeout(timer)
  }, [editor, isSaved, saveDocument])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveDocument()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [saveDocument])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch(`${apiUrl}/api/documents/${DEFAULT_DOCUMENT_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: documentTitle }),
      }).catch(() => undefined)
    }, 500)
    return () => window.clearTimeout(timer)
  }, [documentTitle])

  const refreshComments = useCallback(async (showLoading = false) => {
    if (showLoading) setCommentsLoading(true)
    try {
      const nextComments = await getComments()
      setComments(nextComments)
      nextComments
        .filter((comment) => comment.resolved)
        .forEach((comment) => editor?.commands.removeCommentMark(comment.id))
      setCommentError('')
    } catch {
      setCommentError('Comments are temporarily unavailable.')
    } finally {
      setCommentsLoading(false)
    }
  }, [editor])

  useEffect(() => {
    void refreshComments(true)
    const interval = window.setInterval(() => void refreshComments(), 4000)
    return () => window.clearInterval(interval)
  }, [refreshComments])

  const refreshRevisions = useCallback(async () => {
    setRevisionsLoading(true)
    try {
      setRevisions(await getRevisions())
      setRevisionError('')
    } catch {
      setRevisionError('Version history is temporarily unavailable.')
    } finally {
      setRevisionsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (rightPanel === 'history') void refreshRevisions()
  }, [refreshRevisions, rightPanel])

  const addComment = async () => {
    const body = commentDraft.trim()
    if (!editor || !selectedRange || !selectedText.trim() || !body) return

    setCommentSubmitting(true)
    try {
      const comment = await postComment({
        authorId: currentUser.id,
        authorName: currentUser.name,
        body,
        selectionFrom: selectedRange.from,
        selectionTo: selectedRange.to,
        quotedText: selectedText,
      })
      editor
        .chain()
        .focus()
        .setTextSelection(selectedRange)
        .setCommentMark(comment.id)
        .run()
      setComments((current) => [comment, ...current])
      setActiveCommentId(comment.id)
      setCommentDraft('')
      setSelectedRange(null)
      setSelectedText('')
      setCommentError('')
    } catch {
      setCommentError('The comment could not be added. Please try again.')
    } finally {
      setCommentSubmitting(false)
    }
  }

  const findCommentRange = (commentId: number) => {
    if (!editor) return null
    let from = Number.POSITIVE_INFINITY
    let to = -1

    editor.state.doc.descendants((node, position) => {
      if (!node.isText) return
      const hasComment = node.marks.some(
        (mark) =>
          mark.type.name === 'commentMark' &&
          Number(mark.attrs.commentId) === commentId,
      )
      if (!hasComment) return
      from = Math.min(from, position)
      to = Math.max(to, position + node.nodeSize)
    })

    return Number.isFinite(from) && to >= from ? { from, to } : null
  }

  const focusComment = (commentId: number) => {
    const range = findCommentRange(commentId)
    setActiveCommentId(commentId)
    if (range) {
      editor?.chain().focus().setTextSelection(range).scrollIntoView().run()
    }
  }

  const resolveComment = async (commentId: number) => {
    try {
      const resolved = await resolveCommentRequest(commentId)
      editor?.commands.removeCommentMark(commentId)
      setComments((current) =>
        current.map((comment) => (comment.id === commentId ? resolved : comment)),
      )
      if (activeCommentId === commentId) setActiveCommentId(null)
    } catch {
      setCommentError('The comment could not be resolved. Please try again.')
    }
  }

  const createSnapshot = async () => {
    if (!editor) return
    setRevisionSaving(true)
    try {
      const revision = await postRevision({
        label: `Snapshot ${new Date().toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}`,
        contentHtml: editor.getHTML(),
        createdBy: currentUser.name,
      })
      setRevisions((current) => [revision, ...current])
      setRevisionError('')
    } catch {
      setRevisionError('The snapshot could not be saved. Please try again.')
    } finally {
      setRevisionSaving(false)
    }
  }

  const restoreRevision = (revision: Revision) => {
    if (!editor) return
    if (!window.confirm(`Restore “${revision.label}”? The current document will be replaced.`)) {
      return
    }
    editor.commands.setContent(revision.contentHtml)
    saveDocument()
  }

  const clearDocument = () => {
    if (!editor) return
    if (window.confirm('Clear all content from this document?')) {
      editor.commands.clearContent()
      editor.commands.focus()
    }
  }

  const wordCount = editor
    ? editor.getText().trim().split(/\s+/).filter(Boolean).length
    : 0
  const characterCount = editor?.getText().length ?? 0

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={18} /></div>
          <span>Draftly</span>
        </div>

        <div className="document-identity">
          <input
            aria-label="Document title"
            value={documentTitle}
            onChange={(event) => setDocumentTitle(event.target.value)}
          />
          <div className={`save-state ${isSaved ? 'saved' : ''}`}>
            {isSaved ? <Check size={13} /> : <Cloud size={13} />}
            <span>
              {isSaved
                ? savedAt
                  ? `Saved ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Saved locally'
                : 'Saving…'}
            </span>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="avatars" aria-label="Current collaborator">
            <div
              className="avatar"
              style={{ backgroundColor: currentUser.color }}
              title={currentUser.name}
            >
              {currentUser.name.slice(0, 2).toUpperCase()}
            </div>
          </div>
          <button className={`presence-button ${connectionStatus}`} type="button">
            <Users size={16} />
            {connectionStatus === 'connected' ? 'Live' : 'Connecting…'}
          </button>
          <button className="share-button" type="button">
            <Share2 size={16} /> Share
          </button>
          <IconButton label="More options"><MoreHorizontal size={19} /></IconButton>
        </div>
      </header>

      <section className="toolbar" aria-label="Formatting toolbar">
        <div className="toolbar-group">
          <IconButton
            label="Undo"
            disabled={!editor?.can().undo()}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <Undo2 size={17} />
          </IconButton>
          <IconButton
            label="Redo"
            disabled={!editor?.can().redo()}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <Redo2 size={17} />
          </IconButton>
        </div>

        <div className="toolbar-divider" />

        <label className="select-control wide">
          <select
            aria-label="Paragraph style"
            value={
              editor?.isActive('heading', { level: 1 })
                ? '1'
                : editor?.isActive('heading', { level: 2 })
                  ? '2'
                  : 'p'
            }
            onChange={(event) => {
              const value = event.target.value
              if (value === '1') editor?.chain().focus().toggleHeading({ level: 1 }).run()
              else if (value === '2') editor?.chain().focus().toggleHeading({ level: 2 }).run()
              else editor?.chain().focus().setParagraph().run()
            }}
          >
            <option value="p">Paragraph</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
          </select>
          <ChevronDown size={14} />
        </label>

        <label className="select-control">
          <select
            aria-label="Font size"
            defaultValue="16px"
            onChange={(event) =>
              editor?.chain().focus().setFontSize(event.target.value).run()
            }
          >
            <option value="12px">12</option>
            <option value="14px">14</option>
            <option value="16px">16</option>
            <option value="18px">18</option>
            <option value="24px">24</option>
            <option value="32px">32</option>
          </select>
          <ChevronDown size={14} />
        </label>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <IconButton
            label="Bold"
            active={editor?.isActive('bold')}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold size={17} />
          </IconButton>
          <IconButton
            label="Italic"
            active={editor?.isActive('italic')}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic size={17} />
          </IconButton>
          <label className="color-button" title="Text color">
            <span>A</span>
            <input
              type="color"
              aria-label="Text color"
              defaultValue="#2a2c29"
              onChange={(event) =>
                editor?.chain().focus().setColor(event.target.value).run()
              }
            />
          </label>
          <IconButton
            label="Bullet list"
            active={editor?.isActive('bulletList')}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List size={18} />
          </IconButton>
          <IconButton
            label="Numbered list"
            active={editor?.isActive('orderedList')}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered size={18} />
          </IconButton>
        </div>

        <div className="toolbar-spacer" />

        <button className="text-button" type="button" onClick={clearDocument}>
          <Eraser size={16} /> Clear
        </button>
        <IconButton
          label="Comments"
          active={rightPanel === 'comments'}
          onClick={() => setRightPanel(rightPanel === 'comments' ? null : 'comments')}
        >
          <MessageSquareText size={18} />
        </IconButton>
        <IconButton
          label="Version history"
          active={rightPanel === 'history'}
          onClick={() => setRightPanel(rightPanel === 'history' ? null : 'history')}
        >
          <Clock3 size={18} />
        </IconButton>
      </section>

      <div className={`workspace ${rightPanel ? 'with-panel' : ''}`}>
        <section className="canvas">
          <div className="page">
            <EditorContent editor={editor} />
            <footer className="page-footer">
              <span>{wordCount} words</span>
              <span>{characterCount} characters</span>
              <span>English (US)</span>
            </footer>
          </div>
        </section>

        {rightPanel && (
          <aside className="side-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{rightPanel === 'comments' ? 'Discussion' : 'Archive'}</p>
                <h2>{rightPanel === 'comments' ? 'Comments' : 'Version history'}</h2>
              </div>
              <button type="button" onClick={() => setRightPanel(null)}>×</button>
            </div>

            {rightPanel === 'comments' ? (
              <div className="comments-panel">
                {selectedRange && selectedText && (
                  <div className="comment-composer">
                    <div className="selection-preview">“{selectedText}”</div>
                    <textarea
                      aria-label="Comment text"
                      placeholder="What would you like to say?"
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                          void addComment()
                        }
                      }}
                    />
                    <div className="composer-actions">
                      <button
                        className="cancel-button"
                        type="button"
                        onClick={() => {
                          setSelectedRange(null)
                          setSelectedText('')
                          setCommentDraft('')
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="primary-small-button"
                        type="button"
                        disabled={!commentDraft.trim() || commentSubmitting}
                        onClick={() => void addComment()}
                      >
                        {commentSubmitting ? 'Adding…' : 'Add comment'}
                      </button>
                    </div>
                  </div>
                )}

                {!selectedRange && (
                  <p className="comment-hint">
                    Select text in the document to add a comment.
                  </p>
                )}

                {commentError && <p className="panel-error">{commentError}</p>}

                {commentsLoading ? (
                  <p className="panel-loading">Loading comments…</p>
                ) : comments.length === 0 ? (
                  <div className="empty-state comments-empty">
                    <div className="empty-icon"><MessageSquareText size={22} /></div>
                    <h3>No comments yet</h3>
                    <p>Comments will appear here alongside the selected text.</p>
                  </div>
                ) : (
                  <div className="comment-list">
                    {comments.map((comment) => (
                      <article
                        className={`comment-card ${
                          activeCommentId === comment.id ? 'active' : ''
                        } ${comment.resolved ? 'resolved' : ''}`}
                        key={comment.id}
                      >
                        <button
                          className="comment-card-main"
                          type="button"
                          onClick={() => focusComment(comment.id)}
                        >
                          <div
                            className="comment-avatar"
                            style={{
                              backgroundColor:
                                comment.authorId === currentUser.id
                                  ? currentUser.color
                                  : '#667a75',
                            }}
                          >
                            {comment.authorName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="comment-content">
                            <div className="comment-meta">
                              <strong>{comment.authorName}</strong>
                              <time>
                                {new Date(`${comment.createdAt}Z`).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </time>
                            </div>
                            <blockquote>“{comment.quotedText}”</blockquote>
                            <p>{comment.body}</p>
                          </div>
                        </button>
                        <div className="comment-card-actions">
                          {comment.resolved ? (
                            <span><CheckCircle2 size={13} /> Resolved</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void resolveComment(comment.id)}
                            >
                              <Check size={13} /> Resolve
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="history-panel">
                <button
                  className="snapshot-button"
                  type="button"
                  disabled={revisionSaving}
                  onClick={() => void createSnapshot()}
                >
                  <Plus size={15} />
                  {revisionSaving ? 'Saving snapshot…' : 'Save current version'}
                </button>

                {revisionError && <p className="panel-error">{revisionError}</p>}

                <div className="history-list">
                  <div className="history-item current">
                    <div className="history-dot" />
                    <div>
                      <strong>Current version</strong>
                      <span>Live document · {currentUser.name}</span>
                    </div>
                  </div>

                  {revisionsLoading ? (
                    <p className="panel-loading">Loading version history…</p>
                  ) : revisions.length === 0 ? (
                    <div className="history-empty">
                      <Clock3 size={20} />
                      <p>No snapshots yet.</p>
                      <span>Save a version before making a major change.</span>
                    </div>
                  ) : (
                    revisions.map((revision) => (
                      <div className="history-item revision-item" key={revision.id}>
                        <div className="history-dot" />
                        <div className="revision-details">
                          <strong>{revision.label}</strong>
                          <span>
                            {new Date(`${revision.createdAt}Z`).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {' · '}
                            {revision.createdBy}
                          </span>
                        </div>
                        <button
                          type="button"
                          title={`Restore ${revision.label}`}
                          aria-label={`Restore ${revision.label}`}
                          onClick={() => restoreRevision(revision)}
                        >
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </main>
  )
}

export default App
