import log4js from 'log4js'
import { QueueDef } from '@/common'
import { Preprocessor } from '@/preprocessor'

const logLevel = process.env.LOG_LEVEL || 'info'
const queueDefsStr = process.env.QUEUE_DEFS || '[]'

log4js.configure({
  appenders: { stdout: { type: 'stdout', layout: { type: 'pattern', pattern: '%[%d{ISO8601_WITH_TZ_OFFSET} [%5p]%] %c% - %m' } } },
  categories: { default: { appenders: ['stdout'], level: logLevel } },
})
export const logger = log4js.getLogger('index')

const queueDefs = QueueDef.parseJson(queueDefsStr)
export const preprocessors = queueDefs.map(queueDef => new Preprocessor(queueDef))
logger.info(preprocessors)
