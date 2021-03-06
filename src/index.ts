// import * as functions from 'firebase-functions';
// import * as admin from './db'
// const timber = require('timber')
// const transport = new timber.transports.HTTPS(JSON.parse(process.env.FIREBASE_CONFIG).projectId === 'real-45953' ? functions.config().timber.cloud.prod : functions.config().timber.cloud.dev)
// timber.install(transport)

// REAL User functions
exports.user = require('./lib/user')

// Builder Lesson functions
exports.builder = require('./lib/builder')

// Message Content functions
exports.message = require('./lib/message')

// Bible Content functions
exports.bible = require('./lib/bible')

// NQ Content functions
exports.nq = require('./lib/nq')

// Loggging function
exports.applogs = require('./lib/applogs')

// Notification function
exports.notification = require('./lib/notifications')

// Subscribe function
// exports.subscribe = require('./lib/subscribe')

// Support function
// exports.support = require('./lib/support')