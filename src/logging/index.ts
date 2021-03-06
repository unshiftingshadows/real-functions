const winston = require('winston')
// const Logger = winston.Logger

const { LoggingWinston } = require('@google-cloud/logging-winston');

const logger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console(),
    new LoggingWinston()
  ]
})

export default {
  info: function (...args : any[]) {
    logger.info(args[0], { ...args })
  },
  error: function (...args : any[]) {
    logger.error(args[0], { ...args })
  }
}