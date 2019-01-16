import * as functions from 'firebase-functions'
import { defaultApp as admin, firestore } from './../../db'
// import { Fuse } from 'fuse.js'
const Fuse = require('fuse.js')

const Sentry = require('@sentry/node')
Sentry.init({
  dsn: 'https://d3d741dcf97f43969ea1cb4416073960@sentry.io/1373107',
  environment: JSON.parse(process.env.FIREBASE_CONFIG).projectId === 'real-45953' ? 'prod' : 'staging'
})
Sentry.configureScope(scope => {
  scope.setTag('function', 'message')
})

async function setSentryUser (context) {
  const user = await admin.auth().getUser(context.auth.uid)
  return Sentry.configureScope(scope => {
    scope.setUser({
      email: user.email,
      id: context.auth.uid,
      username: user.displayName,
      ip_address: context.rawRequest.ip
    })
  })
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
        tags: [],
        text: '',
        title: '',
        users: []
      }
    default:
      return false
  }
}

type MediaTypes = 'quote' | 'image' | 'video' | 'illustration' | 'lyric'

function defaultMedia (type: MediaTypes) {
  switch (type) {
    case 'quote':
      return {
        author: '',
        bibleRefs: [],
        dateAdded: new Date(),
        dateModified: new Date(),
        mediaType: '',
        tags: [],
        text: '',
        title: '',
        user: ''
      }
    case 'video':
      return {
        bibleRefs: [],
        dateAdded: new Date(),
        dateModified: new Date(),
        embedURL: '',
        pageURL: '',
        service: '',
        tags: [],
        thumbURL: '',
        title: '',
        user: '',
        videoID: ''
      }
    case 'illustration':
      return {
        author: '',
        bibleRefs: [],
        dateAdded: new Date(),
        dateModified: new Date(),
        tags: [],
        title: '',
        text: '',
        users: []
      }
    case 'image':
      return {
        bibleRefs: [],
        dateAdded: new Date(),
        dateModified: new Date(),
        imageURL: '',
        service: '',
        storageID: '',
        tags: [],
        thumbURL: '',
        user: ''
      }
    case 'lyric':
      return {
        author: '',
        bibleRefs: [],
        dateAdded: new Date(),
        dateModified: new Date(),
        medium: '',
        tags: [],
        text: '',
        title: '',
        user: ''
      }
    default:
      return false
  }
}

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
  await setSentryUser(context)
  const initData = snap.data()
  const contentRef = snap.ref

  const contentObj = defaultContent(type)

  if (contentObj) {
    // Setup properties
    contentObj.title = initData.title
    contentObj.createdBy = initData.createdBy
    contentObj.users = [initData.createdBy]
    if (type === 'message') {
      contentObj.prefs = initData.prefs
      contentObj.seriesid = initData.seriesid || ''
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

async function createMediaHandler (snap: FirebaseFirestore.DocumentSnapshot, context: functions.EventContext, type: MediaTypes) {
  await setSentryUser(context)
  console.log(snap.data())
  const initData = snap.data()
  const mediaRef = snap.ref

  const mediaObj = defaultMedia(type)

  if (mediaObj) {
    // Setup properties
    Object.keys(initData).forEach((key) => {
      mediaObj[key] = initData[key]
    })
    Sentry.addBreadcrumb({
      category: 'message',
      message: `Cloud Function (createMedia) - ${type} media added successfully`,
      level: 'info'
    })
    return mediaRef.set(mediaObj).catch(err => { Sentry.captureException(err) })
  }

  Sentry.captureException(Error(`Cloud Function (createMedia) - Unsupported media type ${type}`))
  return Promise.reject('Unsupported media type')  
}

exports.addSeries = functions.firestore.document('messageSeries/{id}').onCreate((snap, context) => { return createContentHandler(snap, context, 'series') })
exports.addMessage = functions.firestore.document('messageMessage/{id}').onCreate((snap, context) => { return createContentHandler(snap, context, 'message') })
exports.addScratch = functions.firestore.document('messageScratch/{id}').onCreate((snap, context) => { return createContentHandler(snap, context, 'scratch') })
exports.addQuote = functions.firestore.document('messageQuote/{id}').onCreate((snap, context) => { return createMediaHandler(snap, context, 'quote') })
exports.addImage = functions.firestore.document('messageImage/{id}').onCreate((snap, context) => { return createMediaHandler(snap, context, 'image') })
exports.addVideo = functions.firestore.document('messageVideo/{id}').onCreate((snap, context) => { return createMediaHandler(snap, context, 'video') })
exports.addIllustration = functions.firestore.document('messageIllustration/{id}').onCreate((snap, context) => { return createMediaHandler(snap, context, 'illustration') })
exports.addLyric = functions.firestore.document('messageLyric/{id}').onCreate((snap, context) => { return createMediaHandler(snap, context, 'lyric') })

async function deleteContentHandler (snap, context, type) {
  await setSentryUser(context)
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

exports.searchMedia = functions.https.onCall(async (data, context) => {
  await setSentryUser(context)
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