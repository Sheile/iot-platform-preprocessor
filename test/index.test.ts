import log4js from 'log4js'
import { QueueDef } from '@/common'
import { Preprocessor } from '@/preprocessor'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let index: any

describe('index', () => {
  const mockLogInfo = jest.fn()
  const mockLogError = jest.fn()

  beforeEach(() => {
    log4js.getLogger = jest.fn().mockImplementation(() => {
      return {
        info: mockLogInfo,
        error: mockLogError,
      }
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })


  describe('createPreprocessors', () => {
    it.each([
      ['[{"from": "q1.pre", "to": "q1.up"}]', [new Preprocessor(new QueueDef('q1.pre', 'q1.up'))]],
      ['[{"from": "q1.pre", "to": "q1.up", "schema": "schema.json"}]', [new Preprocessor(new QueueDef('q1.pre', 'q1.up', 'schema.json'))]],
      ['[{"from": "q1.pre", "to": "q1.up", "template": "template.json"}]', [new Preprocessor(new QueueDef('q1.pre', 'q1.up', '', 'template.json'))]],
      ['[{"from": "q1.pre", "to": "q1.up", "schema": "schema.json", "template": "template.json"}]',
        [new Preprocessor(new QueueDef('q1.pre', 'q1.up', 'schema.json', 'template.json'))]],
      ['[{"from": "q1.pre", "to": "q1.up"}, {"from": "q2.pre", "to": "q2.up"}]',
        [new Preprocessor(new QueueDef('q1.pre', 'q1.up')), new Preprocessor(new QueueDef('q2.pre', 'q2.up'))]],
    ])('with "%s" return (%o)', (queueDefsStr, results) => {
      jest.isolateModules(() => {
        process.env.QUEUE_DEFS = queueDefsStr
        index = require('@/index')
      })
      expect(mockLogInfo.mock.calls.length).toBe(1)
      expect(mockLogInfo.mock.calls[0][0]).toMatchObject(results)
      expect(index.preprocessors).toMatchObject(results)
    })
  })
})
