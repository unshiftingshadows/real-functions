// import * as functions from 'firebase-functions';
// import * as admin from './db'

// REAL User functions
exports.user = require('./lib/user')

// Builder Lesson functions
exports.builder = require('./lib/builder')

// Message Content functions
exports.message = require('./lib/message')

// Bible Content functions
exports.bible = require('./lib/bible')