import { readFileSync } from 'fs'
import { Connection, ConnectionOptions, Receiver, ReceiverOptions, ReceiverEvents, EventContext, Message, AwaitableSender, SenderOptions } from 'rhea-promise'
import Ajv from 'ajv'
import { Liquid } from 'liquidjs'
import log4js from 'log4js'
import { QueueDef, JsonType } from '@/common'

const host = process.env.AMQP_HOST || 'localhost'
const port = parseInt(process.env.AMQP_PORT || '5672')
const username = process.env.AMQP_USERNAME || 'ANONYMOUS'
const password = process.env.AMQP_PASSWORD
const useTLS = (process.env.AMQP_USE_TLS == 'true')

const logger = log4js.getLogger('preprocessor')

let connection: Connection | undefined

export class Preprocessor {
  private receiver: Receiver | undefined;
  private sender: AwaitableSender | undefined;

  constructor(private queueDef: QueueDef) {
  }

  private async getConnection(): Promise<Connection> {
    if (!connection) {
      const connectionOptions: ConnectionOptions = {
        hostname: host,
        host: host,
        port: port,
        username: username
      }

      if (useTLS) {
        connectionOptions.transport = "tls"
      }
      if (password) {
        connectionOptions.password = password
      }
      const c = new Connection(connectionOptions)
      await c.open()
      logger.debug(`connected to ${host}:${port} ${(useTLS) ? 'with TLS': 'without TLS'}`)
      connection = c
    }
    return connection
  }

  private createValidator = (path: string): Function => {
    if (!path) return (): boolean => true

    const ajv = Ajv()
    return ajv.compile(JSON.parse(readFileSync(path, 'utf-8')))
  }

  private createRenderer = (path: string): Function => {
    if (!path) return (msg: JsonType): object => msg as object

    const engine = new Liquid()
    const template = engine.parseFileSync(path)
    return (msg: JsonType): JsonType => engine.renderSync(template, msg as object)
  }

  async run(): Promise<string> {
    const connection = await this.getConnection()
    const receiverOptions: ReceiverOptions = {
      source: {
        address: this.queueDef.from,
      },
      autoaccept: false,
    }
    this.receiver = await connection.createReceiver(receiverOptions)

    const senderOptions: SenderOptions = {
      target: {
        address: this.queueDef.to,
      }
    }
    this.sender = await connection.createAwaitableSender(senderOptions)

    const validate: Function = this.createValidator(this.queueDef.schema)
    const render: Function = this.createRenderer(this.queueDef.template)

    logger.info(`consume message from Queue: ${this.queueDef.from}`)
    this.receiver.on(ReceiverEvents.message, (context: EventContext) => {
      if (context.message) {
        logger.info(context.message)
        try {
          const msg = this.messageBody2String(context.message)
          logger.debug(`received message: ${msg}`)
          const parsed = JSON.parse(msg)
          if (!validate(parsed)) {
            logger.warn(`no json schema matched this msg: msg=${msg}, schemas=${this.queueDef.schema}`)
            context.delivery?.reject()
          }
          if (Array.isArray(parsed)) {
            parsed.forEach(message => this.sendMessage(context, render(message)))
          } else {
            this.sendMessage(context, render(parsed))
          }
        } catch (err) {
          logger.error('failed when receiving message', err)
          context.delivery?.reject()
        }
      } else {
        logger.error('no message found in this context')
        context.delivery?.reject()
      }
    })
    return `${host}:${port}/${this.queueDef.from}`
  }

  private sendMessage(context: EventContext, msg: object): void {
    this.sender?.send({ body: msg }).then(() => {
      logger.debug(`sent message: ${msg}`)
      context.delivery?.accept()
    }).catch(err => {
      logger.error('failed sending message', err)
      context.delivery?.release()
    })
  }

  private messageBody2String(message: Message): string {
    if (typeof message.body === 'string') return message.body
    if (message.body && message.body.content) return message.body.content.toString("utf-8")
    if (message.body && Buffer.isBuffer(message.body)) return message.body.toString("utf-8")
    throw new Error('Unknown message format')
  }

  async close(): Promise<void> {
    logger.info(`close receiver: address=${this.receiver?.address}`)
    await this.receiver?.close()

    if (connection) logger.info(`close connection: id=${connection.id}`)
    await connection?.close()
    connection = undefined
  }
}
