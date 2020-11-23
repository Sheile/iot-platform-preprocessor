import log4js from 'log4js'
import { QueueDef } from '@/common'
import { Preprocessor } from '@/preprocessor'

jest.mock('@/preprocessor')
const PreprocessorMock = Preprocessor as jest.Mock

describe('index', () => {
  const processEvents: {[signal: string]: () => void} = {}

  const mockLogInfo = jest.fn()
  const mockLogError = jest.fn()
  const mockPreprocessorRunFunc = jest.fn()
  const mockPreprocessorCloseFunc = jest.fn()

  beforeEach(() => {
    log4js.getLogger = jest.fn().mockImplementation(() => {
      return {
        info: mockLogInfo,
        error: mockLogError,
      }
    })
    PreprocessorMock.mockImplementation(() => {
      return {
        run: mockPreprocessorRunFunc,
        close: mockPreprocessorCloseFunc,
      }
    })
    process.on = jest.fn().mockImplementation((signal: string, cb: () => void): void => {
      processEvents[signal] = cb
    })
    process.kill = jest.fn().mockImplementation((_, signal: string) => {
      processEvents[signal]()
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  describe.each([
    ['', []],
    ['[{"from": "q1.pre", "to": "q1.up"}]', [new QueueDef('q1.pre', 'q1.up')]],
    ['[{"from": "q1.pre", "to": "q1.up", "schema": "schema.json"}]', [new QueueDef('q1.pre', 'q1.up', 'schema.json')]],
    ['[{"from": "q1.pre", "to": "q1.up", "template": "template.json"}]', [new QueueDef('q1.pre', 'q1.up', '', 'template.json')]],
    ['[{"from": "q1.pre", "to": "q1.up", "schema": "schema.json", "template": "template.json"}]',
      [new QueueDef('q1.pre', 'q1.up', 'schema.json', 'template.json')]],
    ['[{"from": "q1.pre", "to": "q1.up"}, {"from": "q2.pre", "to": "q2.up"}]',
      [new QueueDef('q1.pre', 'q1.up'), new QueueDef('q2.pre', 'q2.up')]],
  ])('with "%s"', (queueDefsStr, queueDefs: QueueDef[]) => {
    beforeEach(() => {
      process.env.QUEUE_DEFS = queueDefsStr
      mockPreprocessorRunFunc.mockResolvedValue('127.0.0.1:5672')
    })

    it('create preprocessors', () => {
      jest.isolateModules(() => {
        require('@/index')
      })

      expect(PreprocessorMock.mock.calls.length).toBe(queueDefs.length)
      expect(PreprocessorMock.mock.calls).toMatchObject(queueDefs.map(queueDef => [queueDef]))
    })

    it('run preprocessors successfully', (done) => {
      jest.isolateModules(() => {
        require('@/index')
      })

      process.nextTick(() => {
        expect(mockPreprocessorRunFunc.mock.calls.length).toBe(queueDefs.length)
        expect(mockLogInfo.mock.calls.length).toBe(1 + queueDefs.length)

        expect(mockLogInfo.mock.calls[0][0]).toMatchObject(queueDefs.map(queueDef => new Preprocessor(queueDef)))
        queueDefs.forEach((queueDef, index) => {
          expect(mockLogInfo.mock.calls[1 + index][0]).toBe('start consuming on url 127.0.0.1:5672')
        })

        done()
      })
    })

    it('run preprocessors and will occur an error while running', (done) => {
      jest.isolateModules(() => {
        mockPreprocessorRunFunc.mockRejectedValue('error')
        require('@/index')
      })

      process.nextTick(() => {
        expect(mockPreprocessorRunFunc.mock.calls.length).toBe(queueDefs.length)
        expect(mockLogError.mock.calls.length).toBe( queueDefs.length)

        queueDefs.forEach((queueDef, index) => {
          expect(mockLogError.mock.calls[index]).toMatchObject(['failed starting Consumer', 'error'])
        })

        done()
      })
    })

    describe('when receive SIGTERM signal', () => {
      it('call close function on all preprocessors successfully', (done) => {
        jest.isolateModules(() => {
          mockPreprocessorCloseFunc.mockResolvedValue(undefined)
          require('@/index')
        })

        process.kill(process.pid, 'SIGTERM')
        process.nextTick(() => {
          expect(mockPreprocessorCloseFunc.mock.calls.length).toBe(queueDefs.length)
          expect(mockLogInfo.mock.calls.length).toBe(2 + queueDefs.length + 1)
          expect(mockLogInfo.mock.calls.slice(-1)[0][0]).toBe('shutted down gracefully')

          done()
        })
      })

      it('call close function on all preprocessors and will occur some errors', (done) => {
        jest.isolateModules(() => {
          mockPreprocessorCloseFunc.mockRejectedValue('error')
          require('@/index')
        })

        process.kill(process.pid, 'SIGTERM')
        process.nextTick(() => {
          expect(mockPreprocessorCloseFunc.mock.calls.length).toBe(queueDefs.length)
          if (queueDefs.length > 0) {
            expect(mockLogError.mock.calls.length).toBe(1)
            expect(mockLogError.mock.calls.slice(-1)[0]).toMatchObject(['failed shutting down', 'error'])
          }
          done()
        })
      })
    })
  })
})
