import { writeFileSync } from 'fs'
import { fileSync } from 'tmp-promise'
import { Connection, Receiver, ReceiverOptions, SenderOptions } from 'rhea-promise'
import Ajv from 'ajv'
import { Liquid } from 'liquidjs'

import { QueueDef } from '@/common'

jest.mock('rhea-promise')

const receiverOnMock = jest.fn()
const receiverMock = {
  on: receiverOnMock
} as unknown as Receiver

const ConnectionMock = Connection as unknown as jest.Mock
const connOpenMock = jest.fn()
const connCreateReceiverMock = jest.fn(_options => receiverMock)
const connCreateSenderMock = jest.fn()

jest.mock('ajv')
const AjvMock = Ajv as unknown as jest.Mock
const ajvCompileMock = jest.fn()

jest.mock('liquidjs')
const LiquidMock = Liquid as unknown as jest.Mock
const liquidParseFileSyncMock = jest.fn()
const liquidRenderSyncMock = jest.fn()

describe('Preprocessor', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let preprocessor: any

  beforeEach(() => {
    ConnectionMock.mockImplementation(() => {
      return {
        open: connOpenMock,
        // close: connCloseMock,
        createReceiver: connCreateReceiverMock,
        createSender: connCreateSenderMock
      }
    })
    AjvMock.mockImplementation(() => {
      return {
        compile: ajvCompileMock
      }
    })
    LiquidMock.mockImplementation(() => {
      return {
        parseFileSync: liquidParseFileSyncMock,
        renderSync: liquidRenderSyncMock,
      }
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  describe.each([
    ['host', '25672', 'user', 'pass', 'true', 'host:25672/q1.pre']
  ])('run with (%s, %s, %s, %s, %s) => (%s)', (host, port, username, password, useTLS, expectedUrl) => {
    beforeEach(() => {
      process.env.AMQP_HOST = host
      process.env.AMQP_PORT = port
      process.env.AMQP_USERNAME = username
      process.env.AMQP_PASSWORD = password
      process.env.AMQP_USE_TLS = useTLS

      jest.isolateModules(() => {
        const { Preprocessor } = require('@/preprocessor')
        preprocessor = new Preprocessor(new QueueDef('q1.pre', 'q1.up'))
      })
    })

    it('return url for consuming queue', async () => {
      const url = await preprocessor.run()
      expect(url).toBe(expectedUrl)
    })

    it('connect to amqp queue once', async () => {
      await preprocessor.run()
      expect(connOpenMock.mock.calls.length).toBe(1)

      await preprocessor.run()
      expect(connOpenMock.mock.calls.length).toBe(1)
    })
  })

  describe('run', () => {
    beforeEach(() => {
      jest.isolateModules(() => {
        const { Preprocessor } = require('@/preprocessor')
        preprocessor = new Preprocessor(new QueueDef('q1.pre', 'q1.up'))
      })
    })

    it('create receiver', async () => {
      await preprocessor.run()
      const expectedOptions: ReceiverOptions = {
        source: {
          address: 'q1.pre'
        },
        autoaccept: false
      }
      expect(connCreateReceiverMock.mock.calls.length).toBe(1)
      expect(connCreateReceiverMock.mock.calls[0][0]).toMatchObject(expectedOptions)
    })

    it('create sender', async () => {
      await preprocessor.run()
      const expectedOptions: SenderOptions = {
        target: {
          address: 'q1.up'
        }
      }
      expect(connCreateSenderMock.mock.calls.length).toBe(1)
      expect(connCreateSenderMock.mock.calls[0][0]).toMatchObject(expectedOptions)
    })

    it('listen queue', async () => {
      await preprocessor.run()
      expect(preprocessor.receiver.on.mock.calls.length).toBe(1)
      expect(receiverOnMock.mock.calls.length).toBe(1)
    })
  })

  describe('create validator', () => {
    const schema = {
      type: "object",
      required: ["temperature"],
      properties: {
        "temperature": {
          type: "number"
        }
      }
    }

    describe.each([
      [undefined, false],
      [schema, true]
    ])('with %o => %s', (schema, willCallCompile) => {
      beforeEach(() => {
        jest.isolateModules(() => {
          const { Preprocessor } = require('@/preprocessor')
          if (schema) {
            const tmp = fileSync()
            writeFileSync(tmp.fd, JSON.stringify(schema))

            preprocessor = new Preprocessor(new QueueDef('q1.pre', 'q1.up', tmp.name))
          } else {
            preprocessor = new Preprocessor(new QueueDef('q1.pre', 'q1.up'))
          }
        })
      })

      it('will call compile when use schema', async () => {
        await preprocessor.run()
        if (willCallCompile) {
          expect(AjvMock.mock.calls.length).toBe(1)
          expect(ajvCompileMock.mock.calls.length).toBe(1)
          expect(ajvCompileMock.mock.calls[0][0]).toMatchObject(schema as {})
        } else {
          expect(AjvMock.mock.calls.length).toBe(0)
        }
      })
    })
  })

  describe('create renderer', () => {
    const template = {
      after: '{{ before }}'
    }

    describe.each([
      [undefined, false],
      [template, true]
    ])('with %o => %s', (template, willParseFileSync) => {
      beforeEach(() => {
        jest.isolateModules(() => {
          const { Preprocessor } = require('@/preprocessor')
          if (template) {
            const tmp = fileSync()
            writeFileSync(tmp.fd, JSON.stringify(template))

            preprocessor = new Preprocessor(new QueueDef('q1.pre', 'q1.up', '', tmp.name))
          } else {
            preprocessor = new Preprocessor(new QueueDef('q1.pre', 'q1.up'))
          }
        })
      })

      it('will call parseFileSync when use template', async () => {
        await preprocessor.run()
        if (willParseFileSync) {
          expect(liquidParseFileSyncMock.mock.calls.length).toBe(1)
        } else {
          expect(liquidParseFileSyncMock.mock.calls.length).toBe(0)
        }
      })
    })
  })
})

