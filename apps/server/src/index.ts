import { Server } from '@hocuspocus/server'
import * as Y from 'yjs'
import { createApi } from './api.js'
import {
  database,
  ensureDocument,
  getDocumentUpdate,
  storeDocumentUpdate,
} from './database.js'

const apiPort = Number(process.env.API_PORT ?? 3001)
const collaborationPort = Number(process.env.COLLABORATION_PORT ?? 1234)

const collaborationServer = new Server({
  port: collaborationPort,
  stopOnSignals: false,

  async onLoadDocument({ documentName, document }) {
    ensureDocument(documentName)
    const storedUpdate = getDocumentUpdate(documentName)
    if (storedUpdate) {
      Y.applyUpdate(document, storedUpdate)
    }
    return document
  },

  async onStoreDocument({ documentName, document }) {
    storeDocumentUpdate(documentName, Y.encodeStateAsUpdate(document))
  },
})

collaborationServer.listen()

const api = createApi()
const apiServer = api.listen(apiPort, () => {
  console.log(`REST API ready at http://localhost:${apiPort}`)
  console.log(`Collaboration server ready at ws://localhost:${collaborationPort}`)
})

let shuttingDown = false
const shutdown = async () => {
  if (shuttingDown) return
  shuttingDown = true

  collaborationServer.webSocketServer.clients.forEach((client: { terminate(): void }) =>
    client.terminate(),
  )
  apiServer.close()
  await collaborationServer.destroy()
  database.close()
  process.exit(0)
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
