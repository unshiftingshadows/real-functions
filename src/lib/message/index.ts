import * as functions from 'firebase-functions'
import { firestore } from './../../db'
// import { Fuse } from 'fuse.js'
const Fuse = require('fuse.js')

type ContentTypes = 'sermon' | 'lesson' | 'scratch' | 'series'

function defaultContent (type: ContentTypes) {
  switch (type) {
    case 'series':
      return {
        createdBy: '',
        dateAdded: new Date(),
        dateModified: new Date(),
        mainIdea: '',
        tags: [],
        title: '',
        users: [],
        lastUser: ''
      }
    case 'sermon':
      return {
        bibleRefs: [],
        createdBy: '',
        dateAdded: new Date(),
        dateModified: new Date(),
        mainIdea: '',
        prefs: {
          hook: true,
          application: true,
          prayer: true
        },
        sectionOrder: [],
        tags: [],
        template: '',
        title: '',
        users: [],
        lastUser: ''
      }
    case 'lesson':
      return {
        bibleRefs: [],
        createdBy: '',
        dateAdded: new Date(),
        dateModified: new Date(),
        mainIdea: '',
        prefs: {
          hook: true,
          application: true,
          prayer: true
        },
        sectionOrder: [],
        tags: [],
        template: '',
        title: '',
        users: [],
        lastUser: ''
      }
    case 'scratch':
      return {
        createdBy: '',
        bibleRefs: [],
        dateAdded: new Date(),
        dateModified: new Date(),
        tags: [],
        text: '',
        title: '',
        users: [],
        lastUser: ''
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
  show: true,
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
  editing: false,
  show: true
}

const defaultPrayer = {
  pos: 'after',
  text: '',
  wordcount: 0,
  time: 0,
  editing: false,
  show: true
}

function createContentHandler (snap: FirebaseFirestore.DocumentSnapshot, context: functions.EventContext, type: ContentTypes) {
  const initData = snap.data()
  const contentRef = snap.ref

  const contentObj = defaultContent(type)

  if (contentObj) {
    // Setup properties
    contentObj.title = initData.title
    contentObj.createdBy = initData.createdBy
    contentObj.users = [initData.createdBy]
    contentObj.prefs = initData.prefs
    const batch = firestore.batch()
    if (initData.template !== '') {
      // Add template modules and sections to the batch commit
    }
    batch.set(contentRef, contentObj)
    batch.set(contentRef.collection('structure').doc('hook'), defaultHook)
    batch.set(contentRef.collection('structure').doc('application'), defaultApplication)
    batch.set(contentRef.collection('structure').doc('prayer'), defaultPrayer)
    return batch.commit()
  }

  return Promise.reject('Unsupported content type')
}

function createMediaHandler (snap: FirebaseFirestore.DocumentSnapshot, context: functions.EventContext, type: MediaTypes) {
  console.log(snap.data())
  const initData = snap.data()
  const mediaRef = snap.ref

  const mediaObj = defaultMedia(type)

  if (mediaObj) {
    // Setup properties
    Object.keys(initData).forEach((key) => {
      mediaObj[key] = initData[key]
    })
    return mediaRef.set(mediaObj)
  }

  return Promise.reject('Unsupported media type')  
}

exports.addSeries = functions.firestore.document('messageSeries/{id}').onCreate((snap, context) => { return createContentHandler(snap, context, 'series') })
exports.addLesson = functions.firestore.document('messageLesson/{id}').onCreate((snap, context) => { return createContentHandler(snap, context, 'lesson') })
exports.addSermon = functions.firestore.document('messageSermon/{id}').onCreate((snap, context) => { return createContentHandler(snap, context, 'sermon') })
exports.addScratch = functions.firestore.document('messageScratch/{id}').onCreate((snap, context) => { return createContentHandler(snap, context, 'scratch') })
exports.addQuote = functions.firestore.document('messageQuote/{id}').onCreate((snap, context) => { return createMediaHandler(snap, context, 'quote') })
exports.addImage = functions.firestore.document('messageImage/{id}').onCreate((snap, context) => { return createMediaHandler(snap, context, 'image') })
exports.addVideo = functions.firestore.document('messageVideo/{id}').onCreate((snap, context) => { return createMediaHandler(snap, context, 'video') })
exports.addIllustration = functions.firestore.document('messageIllustration/{id}').onCreate((snap, context) => { return createMediaHandler(snap, context, 'illustration') })
exports.addLyric = functions.firestore.document('messageLyric/{id}').onCreate((snap, context) => { return createMediaHandler(snap, context, 'lyric') })

function deleteContentHandler (snap, context, type) {
  // All subcollection paths
  const paths = []
  paths.push(`${snap.ref.path}/structure`)
  paths.push(`${snap.ref.path}/modules`)
  paths.push(`${snap.ref.path}/sections`)

  return Promise.all(paths.map((path) => {
    return deleteCollection(firestore, path, 10)
  }))
}

exports.removeSeries = functions.firestore.document('messageSeries/{id}').onDelete((snap, context) => { return deleteContentHandler(snap, context, 'series') })
exports.removeLesson = functions.firestore.document('messageLesson/{id}').onDelete((snap, context) => { return deleteContentHandler(snap, context, 'lesson') })
exports.removeSermon = functions.firestore.document('messageSermon/{id}').onDelete((snap, context) => { return deleteContentHandler(snap, context, 'sermon') })
exports.removeScratch = functions.firestore.document('messageScratch/{id}').onDelete((snap, context) => { return deleteContentHandler(snap, context, 'scratch') })

function deleteCollection(db, collectionPath, batchSize) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, batchSize, resolve, reject);
  });
}

function deleteQueryBatch(db, query, batchSize, resolve, reject) {
  query.get()
    .then((snapshot) => {
      // When there are no documents left, we are done
      if (snapshot.size === 0) {
        return 0;
      }

      // Delete documents in a batch
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      return batch.commit().then(() => {
        return snapshot.size;
      });
    }).then((numDeleted) => {
      if (numDeleted === 0) {
        resolve();
        return;
      }

      // Recurse on the next process tick, to avoid
      // exploding the stack.
      process.nextTick(() => {
        deleteQueryBatch(db, query, batchSize, resolve, reject);
      });
    })
    .catch(reject);
}

exports.searchMedia = functions.https.onCall((data, context) => {
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
    return { searchTerms: searchTerms, searchTypes: searchTypes, uid: uid, results: fuse.search(searchTerms) }
  })
  .catch((err) => {
    return { message: 'Some error in searching', err: err }
  })
})