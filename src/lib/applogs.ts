import * as functions from 'firebase-functions'
import logger from '../logging'
const winston = require('winston')
// const logKey = require('./../../real-dev-log-cred.json')

const { LoggingWinston } = require('@google-cloud/logging-winston');

const messageLogger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console(),
    new LoggingWinston({
      // ...logKey,
      logName: 'message',
      prefix: 'message',
      labels: {
        app: 'message'
      }
    })
  ]
})

exports.message = functions.https.onCall((data, context) => {
  // console.log(data)
  logger.info(data)
  // return data
  messageLogger[data.level]( data.args[0] , { ...data.args.map(e => JSON.parse(e)) , labels: data.labels })
  return data
})