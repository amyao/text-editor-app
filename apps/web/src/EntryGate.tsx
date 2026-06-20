import { useState } from 'react'
import type { UserPresence } from '@text-editor/shared'
import { ArrowRight, Sparkles } from 'lucide-react'
import App from './App'
import { createUser } from './userIdentity'

export default function EntryGate() {
  const [currentUser, setCurrentUser] = useState<UserPresence | null>(null)
  const [name, setName] = useState('')

  if (currentUser) {
    return (
      <App
        currentUser={currentUser}
        onChangeUser={() => {
          setCurrentUser(null)
          setName('')
        }}
      />
    )
  }

  const enterDocument = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    const user = createUser(trimmedName)
    setCurrentUser(user)
  }

  return (
    <main className="entry-screen">
      <section className="entry-card">
        <div className="entry-brand">
          <div className="brand-mark"><Sparkles size={19} /></div>
          <span>Draftly</span>
        </div>
        <p className="entry-eyebrow">Collaborative workspace</p>
        <h1>What should we call you?</h1>
        <p className="entry-copy">
          Your name appears beside your cursor, comments, reviews, and saved versions.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            enterDocument()
          }}
        >
          <label htmlFor="display-name">Display name</label>
          <input
            id="display-name"
            autoFocus
            autoComplete="name"
            maxLength={40}
            placeholder="e.g. Amy Ao"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" disabled={!name.trim()}>
            Enter document <ArrowRight size={16} />
          </button>
        </form>
        <p className="entry-note">
          Using the same name represents the same collaborator.
        </p>
      </section>
    </main>
  )
}
