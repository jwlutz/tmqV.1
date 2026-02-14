export type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface WSClientOptions {
  url: string
  onMessage: (data: unknown) => void
  onStatusChange: (status: WSStatus) => void
  onConnect?: () => void  // Called when connection opens (for sending subscribe messages)
  reconnectDelay?: number
  maxReconnectAttempts?: number
}

export class WSClient {
  private ws: WebSocket | null = null
  private url: string
  private onMessage: (data: unknown) => void
  private onStatusChange: (status: WSStatus) => void
  private onConnect?: () => void
  private reconnectDelay: number
  private maxReconnectAttempts: number
  private reconnectAttempts = 0
  private shouldReconnect = true

  constructor(options: WSClientOptions) {
    this.url = options.url
    this.onMessage = options.onMessage
    this.onStatusChange = options.onStatusChange
    this.onConnect = options.onConnect
    this.reconnectDelay = options.reconnectDelay ?? 3000
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5
  }

  connect() {
    this.shouldReconnect = true
    this.onStatusChange('connecting')

    this.ws = new WebSocket(this.url)

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
      this.onStatusChange('connected')
      this.onConnect?.()
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.onMessage(data)
      } catch (e) {
        console.error('Failed to parse WS message:', e)
      }
    }

    this.ws.onerror = () => {
      this.onStatusChange('error')
    }

    this.ws.onclose = () => {
      this.onStatusChange('disconnected')
      this.attemptReconnect()
    }
  }

  send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  private attemptReconnect() {
    if (!this.shouldReconnect) return
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.onStatusChange('error')
      return
    }

    this.reconnectAttempts++
    setTimeout(() => this.connect(), this.reconnectDelay)
  }

  disconnect() {
    this.shouldReconnect = false
    this.ws?.close()
    this.ws = null
  }
}
