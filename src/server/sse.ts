import type { FastifyReply } from 'fastify'

export class SSEManager {
  private clients = new Set<FastifyReply>()

  add(reply: FastifyReply): void {
    this.clients.add(reply)
    reply.raw.on('close', () => this.clients.delete(reply))
  }

  broadcast(): void {
    for (const client of this.clients) {
      try {
        client.raw.write('data: reload\n\n')
      } catch {
        this.clients.delete(client)
      }
    }
  }

  get size(): number {
    return this.clients.size
  }
}
