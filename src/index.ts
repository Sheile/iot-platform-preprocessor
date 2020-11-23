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


preprocessors.forEach(preprocessor => {
  preprocessor.run()
    .then((connectedUrl) => {
      logger.info(`start consuming on url ${connectedUrl}`)
    })
    .catch((err) => {
      logger.error('failed starting Consumer', err)
    })
})

process.on("SIGTERM", (): void => {
  logger.info("Got SIGTERM");
  (async (): Promise<void> => {
    await Promise.all(preprocessors.map(preprocessor => preprocessor.close()))
  })().then(() => {
    logger.info("shutted down gracefully")
  }).catch((err) => {
    logger.error("failed shutting down", err)
  })
})
