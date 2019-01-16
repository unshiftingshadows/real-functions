import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

export const defaultApp = admin.initializeApp(functions.config().firebase)
const nqService = require('./../../notes-and-quotes-cred.json')

const nqApp = admin.initializeApp({
  credential: admin.credential.cert(nqService),
  databaseURL: 'https://notes-and-quotes-977a3.firebaseio.com'
}, 'nq')

export const firestore = defaultApp.firestore()
const settings = { timestampsInSnapshots: true }
firestore.settings(settings)

export const auth = defaultApp.auth()

export const nqFirestore = nqApp.firestore()
nqFirestore.settings(settings)

export const nqAuth = nqApp.auth()
