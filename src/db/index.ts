import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

const defaultApp = admin.initializeApp(functions.config().firebase)

export const firestore = defaultApp.firestore()
const settings = { timestampsInSnapshots: true }
firestore.settings(settings)

export const auth = defaultApp.auth()
