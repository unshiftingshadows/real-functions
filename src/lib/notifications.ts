// import * as functions from 'firebase-functions'
import { firestore } from '../db'

type NOTIFICATION_TYPE = 'invite' | 'comment' | 'message'

type APP = 'message' | 'curriculum' | 'prayer' | 'database'

type ACTION = 'view' | 'accept'

type DOCUMENT = 'message' | 'series' | 'devo' | 'person' | 'church' | 'prayer' | 'user'

export {
  NOTIFICATION_TYPE,
  APP,
  ACTION,
  DOCUMENT
}

export class Notification {
  author: {
    uid: string
    username: string
  }
  type: NOTIFICATION_TYPE
  title: string
  message: string
  timestamp: Date = new Date()
  seen: boolean = false
  action?: NotificationAction
  constructor (author: { uid: string, username: string }, type: NOTIFICATION_TYPE, title: string, message: string) {
    this.author = author
    this.type = type
    this.title = author.username + ' ' + title
    this.message = message
  }
  setAction (action: NotificationAction) {
    this.action = action
  }
  getObject () {
    return {
      author: this.author,
      type: this.type,
      title: this.title,
      message: this.message,
      timestamp: this.timestamp,
      seen: this.seen
    }
  }
}

export class NotificationAction {
  app: APP
  action: ACTION
  docType: DOCUMENT
  docid: string
  acted: boolean = false
  constructor (app: APP, action: ACTION, docType: DOCUMENT, docid: string) {
    this.app = app
    this.action = action
    this.docType = docType
    this.docid = docid
  }
}

export function addNotification (uid: string, notification: Notification) {
  return firestore.collection('user').doc(uid).collection('notifications').add(notification.getObject())
}

// exports.addNotification = functions.https.onCall(async ({ uid, type, title, message }, context) => {
//   await setSentryUser(context, context.auth.uid)
//   const notification = new Notification( { uid: context.auth.uid, username: (await admin.auth().getUser(context.auth.uid)).displayName }, type, title, message )
//   return addNotification(uid, notification)
// })