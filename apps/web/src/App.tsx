import { useCallback, useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'
import { DEFAULT_DOCUMENT_ID, type UserPresence } from '@text-editor/shared'
import {
  Bold,
  Check,
  ChevronDown,
  Clock3,
  Cloud,
  Eraser,
  Italic,
  List,
  ListOrdered,
  MessageSquareText,
  MoreHorizontal,
  Redo2,
  Share2,
  Sparkles,
  Undo2,
  Users,
} from 'lucide-react'
import { FontSize } from './extensions/FontSize'

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

  const currentUser = useMemo(() => getCurrentUser(), [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      TextStyle,
      Color,
      FontSize,
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
    },
    onUpdate: () => {
      setIsSaved(false)
      forceToolbarUpdate((value) => value + 1)
    },
    onSelectionUpdate: () => forceToolbarUpdate((value) => value + 1),
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
              <div className="empty-state">
                <div className="empty-icon"><MessageSquareText size={22} /></div>
                <h3>No comments yet</h3>
                <p>Select text in the document to start a focused conversation.</p>
                <button type="button" disabled>Add comment</button>
              </div>
            ) : (
              <div className="history-list">
                <div className="history-item current">
                  <div className="history-dot" />
                  <div>
                    <strong>Current version</strong>
                    <span>Just now · You</span>
                  </div>
                </div>
                <div className="history-item">
                  <div className="history-dot" />
                  <div>
                    <strong>Initial draft</strong>
                    <span>Saved locally</span>
                  </div>
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
