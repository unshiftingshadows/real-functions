import * as functions from 'firebase-functions'
import * as fbAdmin from 'firebase-admin'
import { defaultApp as admin, firestore, storage } from '../db'
import { sendEmail } from './email'
import { Notification, addNotification, NotificationAction } from './notifications'
import * as Sentry from '../sentry'
// import { DocumentReference } from '@google-cloud/firestore';
// import { Fuse } from 'fuse.js'
const Fuse = require('fuse.js')

const { Logging } = require('@google-cloud/logging')
const logging = new Logging()
const log = logging.log('real-message-log')

const METADATA = {
  resource: {
    type: 'cloud_function',
    labels: {
      function_name: 'Message',
      region: 'us-central1'
    }
  }
}

function simpleLog (message: string, object?: any) {
  return log.write(log.entry(METADATA, {
    message: message,
    value: object || null
  }))
}

type ContentTypes = 'message' | 'scratch' | 'series'

function defaultContent (type: ContentTypes) {
  switch (type) {
    case 'series':
      return {
        archived: false,
        bibleRefs: [],
        createdBy: '',
        createdDate: new Date(),
        modifiedBy: '',
        modifiedDate: new Date(),
        mainIdea: '',
        messageOrder: [],
        ownedBy: '',
        sharedWith: [],
        tags: [],
        title: '',
        type: '',
        users: []
      }
    case 'message':
      return {
        archived: false,
        bibleRefs: [],
        createdBy: '',
        createdDate: new Date(),
        modifiedBy: '',
        modifiedDate: new Date(),
        mainIdea: '',
        ownedBy: '',
        prefs: {
          hook: true,
          application: true,
          prayer: true
        },
        sectionOrder: [],
        seriesid: '',
        tags: [],
        template: '',
        title: '',
        type: '',
        users: []
      }
    case 'scratch':
      return {
        bibleRefs: [],
        createdBy: '',
        createdDate: new Date(),
        modifiedBy: '',
        modifiedDate: new Date(),
        ownedBy: '',
        tags: [],
        text: '',
        title: '',
        users: []
      }
    default:
      return false
  }
}

// type MediaTypes = 'quote' | 'image' | 'video' | 'illustration' | 'lyric'

// function defaultMedia (type: MediaTypes) {
//   switch (type) {
//     case 'quote':
//       return {
//         author: '',
//         bibleRefs: [],
//         dateAdded: new Date(),
//         dateModified: new Date(),
//         mediaType: '',
//         tags: [],
//         text: '',
//         title: '',
//         user: ''
//       }
//     case 'video':
//       return {
//         bibleRefs: [],
//         dateAdded: new Date(),
//         dateModified: new Date(),
//         embedURL: '',
//         pageURL: '',
//         service: '',
//         tags: [],
//         thumbURL: '',
//         title: '',
//         user: '',
//         videoID: ''
//       }
//     case 'illustration':
//       return {
//         author: '',
//         bibleRefs: [],
//         dateAdded: new Date(),
//         dateModified: new Date(),
//         tags: [],
//         title: '',
//         text: '',
//         users: []
//       }
//     case 'image':
//       return {
//         bibleRefs: [],
//         dateAdded: new Date(),
//         dateModified: new Date(),
//         imageURL: '',
//         service: '',
//         storageID: '',
//         tags: [],
//         thumbURL: '',
//         user: ''
//       }
//     case 'lyric':
//       return {
//         author: '',
//         bibleRefs: [],
//         dateAdded: new Date(),
//         dateModified: new Date(),
//         medium: '',
//         tags: [],
//         text: '',
//         title: '',
//         user: ''
//       }
//     default:
//       return false
//   }
// }

const defaultHook = {
  pos: 'before',
  title: '',
  wordcount: 0,
  time: 0,
  editing: false,
  moduleOrder: []
}

const defaultApplication = {
  pos: 'after',
  title: '',
  today: '',
  thisweek: '',
  thought: '',
  wordcount: 0,
  time: 0,
  editing: false
}

const defaultPrayer = {
  pos: 'after',
  text: '',
  wordcount: 0,
  time: 0,
  editing: false
}

async function createContentHandler (snap: FirebaseFirestore.DocumentSnapshot, context: functions.EventContext, type: ContentTypes) {
  await Sentry.setSentryUser(context, snap.data().createdBy)
  const initData = snap.data()
  const contentRef = snap.ref

  const contentObj = defaultContent(type)

  if (contentObj) {
    // Setup properties
    contentObj.title = initData.title
    contentObj.createdBy = initData.createdBy
    contentObj.ownedBy = initData.createdBy
    contentObj.users = initData.users || [initData.createdBy]
    if (type === 'message') {
      contentObj.prefs = initData.prefs
      contentObj.seriesid = initData.seriesid || ''
    }
    if (type === 'series') {
      contentObj.sharedWith = initData.users || [initData.createdBy]
    }
    const batch = firestore.batch()
    if (initData.template !== '') {
      // Add template modules and sections to the batch commit
    }
    batch.set(contentRef, contentObj)
    if (type === 'message') {
      batch.set(contentRef.collection('structure').doc('hook'), defaultHook)
      batch.set(contentRef.collection('structure').doc('application'), defaultApplication)
      batch.set(contentRef.collection('structure').doc('prayer'), defaultPrayer)
    }
    Sentry.addBreadcrumb({
      category: 'message',
      message: `Cloud Function (createContent) - ${type} content added successfully`,
      level: 'info'
    })
    return batch.commit().catch(err => { Sentry.captureException(err) })
  }

  Sentry.captureException(Error(`Cloud Function (createContent) - Unsupported content type ${type}`))
  return Promise.reject('Unsupported content type')
}

// async function createMediaHandler (snap: FirebaseFirestore.DocumentSnapshot, context: functions.EventContext, type: MediaTypes) {
//   await Sentry.setSentryUser(context, snap.data().user)
//   console.log(snap.data())
//   const initData = snap.data()
//   const mediaRef = snap.ref

//   const mediaObj = defaultMedia(type)

//   if (mediaObj) {
//     // Setup properties
//     Object.keys(initData).forEach((key) => {
//       mediaObj[key] = initData[key]
//     })
//     Sentry.addBreadcrumb({
//       category: 'message',
//       message: `Cloud Function (createMedia) - ${type} media added successfully`,
//       level: 'info'
//     })
//     return mediaRef.set(mediaObj).catch(err => { Sentry.captureException(err) })
//   }

//   Sentry.captureException(Error(`Cloud Function (createMedia) - Unsupported media type ${type}`))
//   return Promise.reject('Unsupported media type')  
// }

exports.addSeries = functions.firestore.document('messageSeries/{id}').onCreate((snap, context) => { return createContentHandler(snap, context, 'series') })
exports.addMessage = functions.firestore.document('messageMessage/{id}').onCreate((snap, context) => { return createContentHandler(snap, context, 'message') })
exports.addScratch = functions.firestore.document('messageScratch/{id}').onCreate((snap, context) => { return createContentHandler(snap, context, 'scratch') })
// exports.addQuote = functions.firestore.document('messageQuote/{id}').onCreate((snap, context) => { return createMediaHandler(snap, context, 'quote') })
// exports.addImage = functions.firestore.document('messageImage/{id}').onCreate((snap, context) => { return createMediaHandler(snap, context, 'image') })
// exports.addVideo = functions.firestore.document('messageVideo/{id}').onCreate((snap, context) => { return createMediaHandler(snap, context, 'video') })
// exports.addIllustration = functions.firestore.document('messageIllustration/{id}').onCreate((snap, context) => { return createMediaHandler(snap, context, 'illustration') })
// exports.addLyric = functions.firestore.document('messageLyric/{id}').onCreate((snap, context) => { return createMediaHandler(snap, context, 'lyric') })

async function deleteContentHandler (snap, context, type) {
  await Sentry.setSentryUser(context, '')
  // All subcollection paths
  const paths = []
  paths.push(`${snap.ref.path}/structure`)
  paths.push(`${snap.ref.path}/modules`)
  paths.push(`${snap.ref.path}/sections`)

  return Promise.all(paths.map((path) => {
    return deleteCollection(firestore, path, 10)
  }))
  .then(() => {
    return Sentry.addBreadcrumb({
      category: 'message',
      message: `Cloud Function (deleteContent) - ${type} content deleted successfully`,
      level: 'info'
    })
  })
  .catch(err => { Sentry.captureException(err) })
}

exports.removeSeries = functions.firestore.document('messageSeries/{id}').onDelete((snap, context) => { return deleteContentHandler(snap, context, 'series') })
exports.removeMessage = functions.firestore.document('messageMessage/{id}').onDelete((snap, context) => { return deleteContentHandler(snap, context, 'message') })
exports.removeScratch = functions.firestore.document('messageScratch/{id}').onDelete((snap, context) => { return deleteContentHandler(snap, context, 'scratch') })

function deleteCollection(db, collectionPath, batchSize) {
  const collectionRef = db.collection(collectionPath)
  const query = collectionRef.orderBy('__name__').limit(batchSize)

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, batchSize, resolve, reject)
  }).catch(err => { Sentry.captureException(err) })
}

function deleteQueryBatch(db, query, batchSize, resolve, reject) {
  query.get()
    .then((snapshot) => {
      // When there are no documents left, we are done
      if (snapshot.size === 0) {
        return 0
      }

      // Delete documents in a batch
      const batch = db.batch()
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref)
      })

      return batch.commit().then(() => {
        return snapshot.size
      })
    }).then((numDeleted) => {
      if (numDeleted === 0) {
        resolve()
        return
      }

      // Recurse on the next process tick, to avoid
      // exploding the stack.
      process.nextTick(() => {
        deleteQueryBatch(db, query, batchSize, resolve, reject);
      })
    }).catch(err => {
      Sentry.captureException(err)
      reject(err)
    })
}

type contextTypes = 'doc' | 'section' | 'structure' | 'module'
type actionTypes = 'add' | 'remove' | 'edit'

interface HistoryChange {
  context: contextTypes
  id: string
  ref: fbAdmin.firestore.DocumentReference
  action: actionTypes
  newVal?: any
  prevVal?: any
  uid: string
  timestamp: Date
}

async function addHistory (change, context, type) {
  const document = change.after.exists ? change.after.data() : null
  const prevDoc = change.before.exists ? change.before.data() : null
  const uid = document && document.editing ? document.editing : prevDoc && prevDoc.editing ? prevDoc.editing : ''
  await Sentry.setSentryUser(context, uid)
  const docid = context.params.messageid
  const action = document === null ? 'remove' : prevDoc === null ? 'add' : 'edit'
  const modChange: HistoryChange = {
    context: type,
    id: docid,
    ref: change.after.ref,
    action: action,
    uid: uid,
    timestamp: new Date(),
    newVal: document,
    prevVal: prevDoc
  }
  admin.firestore().collection(`messageMessage`).doc(docid).collection('history').add(modChange).then(() => {
    return Sentry.addBreadcrumb({
      category: 'message',
      message: `Cloud Function (history-${type}) - message history point added successful: ${docid} - ${action}`,
      level: 'info'
    })
  }).catch(err => {
    return Sentry.captureException(err)
  })
}

exports.historyModules = functions.firestore.document('messageMessage/{messageid}/modules/{moduleid}').onWrite((change, context) => { return addHistory(change, context, 'module') })
exports.historySections = functions.firestore.document('messageMessage/{messageid}/sections/{sectionid}').onWrite((change, context) => { return addHistory(change, context, 'section') })
exports.historyStructure = functions.firestore.document('messageMessage/{messageid}/structure/{structureid}').onWrite((change, context) => { return addHistory(change, context, 'structure') })

exports.searchMedia = functions.https.onCall(async (data, context) => {
  await Sentry.setSentryUser(context, context.auth.uid)
  const searchTerms = data.searchTerms
  const searchTypes = data.searchTypes
  const uid = context.auth.uid

  const searchOptions = {
    shouldSort: true,
    findAllMatches: true,
    keys: [{
      name: 'tags',
      weight: 0.3
    }, {
      name: 'text',
      weight: 0.4
    }, {
      name: 'title',
      weight: 0.2
    }, {
      name: 'author',
      weight: 0.1
    }]
  }

  const media = []
  const queryPromises = []

  searchTypes.forEach((type) => {
    const capType = type.charAt(0).toUpperCase() + type.slice(1)
    queryPromises.push(firestore.collection(`message${capType}`).where('user', '==', uid).get())
  })

  return Promise.all(queryPromises).then((values) => {
    values.forEach((query, index) => {
      query.forEach((doc) => {
        const val = doc.data()
        val.id = doc.id
        val.type = searchTypes[index]
        media.push(val)
      })
    })
    const fuse = new Fuse(media, searchOptions)
    Sentry.addBreadcrumb({
      category: 'message',
      message: `Cloud Function (searchMedia) - search successful: ${searchTerms}`,
      level: 'info'
    })
    return { searchTerms: searchTerms, searchTypes: searchTypes, uid: uid, results: fuse.search(searchTerms) }
  })
  .catch((err) => {
    Sentry.captureException(err)
    return { message: 'Some error in searching', err: err }
  })
})

async function addDocUser (docType, docid: string, users: string[], originuid: string) {
  simpleLog('addDocUser started')
  console.log('addDocUser started', docType, docid, users.length, originuid)
  return admin.firestore().collection(`message${docType.charAt(0).toUpperCase()}${docType.slice(1)}`).doc(docid).update({
    modifiedDate: new Date(),
    modifiedBy: originuid,
    users: fbAdmin.firestore.FieldValue.arrayUnion( ...users )
  }).then(async () => {
    if (docType === 'series') {
      try {
        const batch = admin.firestore().batch()
        const seriesData = await admin.firestore().collection('messageSeries').doc(docid).get()
        seriesData.data().messageOrder.forEach(message => {
          batch.update(admin.firestore().collection('messageMessage').doc(message), {
            users: fbAdmin.firestore.FieldValue.arrayUnion( ...users )
          })
        })
        batch.update(admin.firestore().collection('messageSeries').doc(docid), {
          sharedWith: fbAdmin.firestore.FieldValue.arrayUnion( ...users )
        })
        await batch.commit()
      } catch (err) {
        simpleLog('addDocUse - series messages updates failed')
        console.error(err)
        return Sentry.captureException(err)
      }
    }
    if (docType === 'message') {
      admin.firestore().collection('messageMessage').doc(docid).get().then((res) => {
        if (res.data().seriesid !== '') {
          admin.firestore().collection('messageSeries').doc(res.data().seriesid).update({
            users: fbAdmin.firestore.FieldValue.arrayUnion( ...users )
          })
        }
      })
    }
    try {
      const notification = new Notification({ uid: originuid, username: (await admin.auth().getUser(originuid)).displayName }, 'invite', `Invite to ${docType}`, `shared a ${docType} with you!`)
      notification.setAction(new NotificationAction('message', 'view', docType, docid))
      await Promise.all(users.map(e => { return addNotification(e, notification) }))
      return true
    } catch (err) {
      simpleLog('addDocUser - add notification failed')
      console.error(err)
      return Sentry.captureException(err)
    }
  }).catch(err => {
    simpleLog('addDocUser - document update failed')
    console.error(err)
    return Sentry.captureException(err)
  })
}

async function addTempUser (email: string, inviteduid: string, docType: string, docid: string) {
  // Start looking to add user
  try {
    // Add temp doc with email as id in tempUser
    await firestore.collection('userTemp').doc(email).set({
      invitedBy: inviteduid,
      invitedDate: new Date(),
      shareDoc: fbAdmin.firestore.FieldValue.arrayUnion({ docType, docid })
    }, { merge: true })
    simpleLog('userTemp data added')
    // Send invite email to email
    await sendEmail('invite', email, { username: (await admin.auth().getUser(inviteduid)).displayName, docType, app: 'message' })
      .then(([response, body]) => {
        console.info('New user invited!', email, response.statusCode)
        return { status: 200, message: 'New user invited!' }
      })
      .catch(err => {
        Sentry.captureException(err)
        simpleLog('addTempUser - Error sending new user email')
        console.error(err)
        return { status: 400, message: 'Error sending new user email', err }
      })
    simpleLog('email sent')
    return true
  } catch (err) {
    simpleLog('addTempUser - adding user failed')
    console.error(err)
    await Sentry.captureException(err)
    return false
  }
}

function isUser (email: string) {
  return new Promise(async (resolve, reject) => {
    try {
      const user = await admin.auth().getUserByEmail(email)
      resolve(user.uid)
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        resolve(false)
      } else {
        reject(err)
      }
    }
  })
}

exports.shareDoc = functions.https.onCall(async ({ docType, docid, emails }, context) => {
  simpleLog('before set sentry')
  await Sentry.setSentryUser(context, context.auth.uid)
  simpleLog('after set sentry')
  let users: string[] = []
  let newEmails: string[] = []
  simpleLog('emails', emails)
  let emailError = false
  // emails.forEach(async (email: string) => {
  //   try {
  //     simpleLog(`try user - ${email}`)
  //     const user = await admin.auth().getUserByEmail(email)
  //     users.push(user.uid)
  //     simpleLog('user after push', users)
  //   } catch (error) {
  //     if (error.code === 'auth/user-not-found') {
  //       newEmails.push(email)
  //     } else {
  //       simpleLog('shareDoc - finding user failed', error)
  //       console.error(error)
  //       Sentry.captureException(error)
  //       emailError = true
  //     }
  //   }
  // })
  await Promise.all(emails.map(async (e: string) => {
    return { email: e, isUser: await isUser(e) }
  })).then(val => {
    val.forEach((e: { email: string, isUser: any }) => {
      if (e.isUser) {
        users.push(e.isUser)
      } else {
        newEmails.push(e.email)
      }
      simpleLog('email done', e)
    })
  }).catch((error) => {
    simpleLog('shareDoc - finding user failed', error)
    console.error(error)
    Sentry.captureException(error)
    emailError = true
  })
  if (emailError) {
    return false
  }
  simpleLog('users', users)
  if (users.length > 0) {
    simpleLog('users length greater than zero')
    await addDocUser(docType, docid, users, context.auth.uid)
  }
  if (newEmails.length > 0) {
    simpleLog('newEmails length greater than zero')
    await Promise.all(newEmails.map(e => { return addTempUser(e, context.auth.uid, docType, docid) }))
  }
  return { success: true }
})

exports.archiveMessage = functions.https.onRequest(async (req, res) => {
  const dateCheck = new Date()
  dateCheck.setMonth(dateCheck.getMonth() - 6)
  const messages = await firestore.collection('messageMessage').where('modifiedDate', '<', dateCheck).get()
  if (!messages.empty) {
    messages.docs.forEach(async (doc) => {
      try {
        const id = doc.id
        const message = doc.data()
        const structure = (await firestore.collection('messageMessage').doc(id).collection('structure').get())
        const sections = await firestore.collection('messageMessage').doc(id).collection('sections').get()
        const modules = await firestore.collection('messageMessage').doc(id).collection('modules').get()
        const history = await firestore.collection('messageMessage').doc(id).collection('history').get()
        firestore.collection('messageArchive').doc(message.ownedBy).set({
          messages: fbAdmin.firestore.FieldValue.arrayUnion({ id, title: message.title, mainIdea: message.mainIdea, tags: message.tags, bibleRefs: message.bibleRefs })
        }, { merge: true })
        const file = storage.bucket('real-dev-users').file(`/${message.ownedBy}/${id}`)
        await file.save(JSON.stringify({ id, message, structure, sections, modules, history }))
        res.send({ status: 'done', message: 'File saved!'})
      } catch (err) {
        res.sendStatus(500).send({ status: 'failed', message: 'Something went wrong...' })
      }
    })
  } else {
    res.send({ status: 'done', message: 'No messages to archive' })
  }
})

exports.restoreMessage = functions.https.onCall(async (data, context) => {
  await Sentry.setSentryUser(context, context.auth.uid)
  const id = data.id
  const uid = context.auth.uid
  if (!uid) {
    return { status: 'failed', message: 'No user ID' }
  }
  const file = await storage.bucket('real-dev-users').file(`/${uid}/${id}`).get()
  return file
})