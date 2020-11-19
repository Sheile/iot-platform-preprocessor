import log4js from 'log4js'

const logLevel = process.env.LOG_LEVEL || 'info';

log4js.configure({
  appenders: { stdout: { type: 'stdout', layout: { type: 'pattern', pattern: '%[%d{ISO8601_WITH_TZ_OFFSET} [%5p]%] %c% - %m' } } },
  categories: { default: { appenders: ['stdout'], level: logLevel } },
})
export const logger = log4js.getLogger('index');
