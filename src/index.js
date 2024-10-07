import { peerIdFromString } from '@libp2p/peer-id'
import { createHelia, libp2pDefaults } from 'helia'
import { devToolsMetrics } from '@libp2p/devtools-metrics'

const App = async () => {
  const DOM = {
    input: () => document.getElementById('input'),
    findBtn: () => document.getElementById('find-button'),
    output: () => document.getElementById('output'),
    terminal: () => document.getElementById('terminal')
  }

  const COLORS = {
    active: '#357edd',
    success: '#0cb892',
    error: '#ea5037'
  }

  const scrollToBottom = () => {
    const terminal = DOM.terminal()
    terminal.scroll({ top: terminal.scrollHeight, behavior: 'smooth' })
  }

  const clearStatus = () => {
    DOM.output().innerHTML = ''
  }

  const showStatus = (text, bg, id = null) => {
    const log = DOM.output()

    const line = document.createElement('p')
    line.innerHTML = text
    line.style.color = bg

    if (id) {
      line.id = id
    }

    log.appendChild(line)

    scrollToBottom(log)
  }

  const runFindPeer = async (peerIdString) => {
    clearStatus()

    const signal = AbortSignal.timeout(60000)

    showStatus(`Searching for peer ${peerIdString}...`)
    const peerId = peerIdFromString(peerIdString)


    const peerInfo = await helia.routing.findPeer(peerId, {
      onProgress: (event) => {
        console.info(event.type, event.detail)

        if (event.type === 'kad-dht:query:dial-peer') {
          showStatus(`${event.detail.peer} ${event.detail.name}`)
        }

        if (event.type === 'kad-dht:query:send-query') {
          showStatus(`${event.detail.to} ${event.detail.name} ${event.detail.messageName}`)
        }

        if (event.type === 'kad-dht:query:peer-response') {
          if (event.detail.closer.length > 0) {
            showStatus(`${event.detail.from} ${event.detail.name} Closer nodes ${event.detail.closer.map(peer => peer.id.toString()).join(', ')}`, COLORS.active)
          }

          showStatus(`<pre>${JSON.stringify(event.detail, null, 2)}</pre>`, COLORS.success)
        }

        if (event.type === 'kad-dht:query:query-error') {
          if (event.detail.error.message.includes('The connection gater denied all addresses in the dial request')) {
            showStatus(`${event.detail.from} ${event.detail.name} ${event.detail.error.code} The remote peer had no public addresses`, COLORS.error)
          } else if (event.detail.error.message.includes('The dial request has no valid addresses')) {
            showStatus(`${event.detail.from} ${event.detail.name} ${event.detail.error.code} The remote peer had no supported addresses`, COLORS.error)
          } else if (event.detail.error.message.includes('All promises were rejected')) {
            showStatus(`${event.detail.from} ${event.detail.name} ${event.detail.errors}`, COLORS.error)
          } else {
            showStatus(`${event.detail.from} ${event.detail.name} ${event.detail.error.code} ${event.detail.error.message}`, COLORS.error)
          }
        }
      },
      signal
    })

    clearStatus()
    showStatus(`<pre>${JSON.stringify(peerInfo, null, 2)}</pre>`, COLORS.success)
  }

  // Event listeners
  DOM.findBtn().onclick = async (e) => {
    e.preventDefault()

    const value = DOM.input().value ?? ''
    let peerId = `${value}`.trim()

    if (!peerId) {
      showStatus(`Invalid PeerId`, COLORS.error)
      return
    }

    try {
      await runFindPeer(peerId)
    } catch (err) {
      console.error('Error finding peer', err)
      clearStatus()
      showStatus(`${err}`, COLORS.error)
    }
  }

  showStatus('Creating Helia node')

  const libp2p = libp2pDefaults()
  libp2p.addresses.listen = []
  libp2p.metrics = devToolsMetrics()

  const helia = await createHelia({
    libp2p
  })

  clearStatus()
  showStatus(`Waiting for peers...`)

  while (true) {
    if (helia.libp2p.getPeers().length > 0) {
      break
    }

    await new Promise((resolve) => {
      setTimeout(() => {
        resolve()
      }, 1000)
    })
  }

  clearStatus()
  showStatus('Helia node ready', COLORS.active)
  showStatus('Try finding a Peer ID', COLORS.active)
  showStatus('E.g. QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN', COLORS.active)

  DOM.input().disabled = false
  DOM.findBtn().disabled = false
}

App().catch(err => {
  console.error(err) // eslint-disable-line no-console
})
