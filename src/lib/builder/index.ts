import * as functions from 'firebase-functions';
import { defaultApp as admin, firestore } from './../../db';

const Sentry = require('@sentry/node')
Sentry.init({
  dsn: 'https://d3d741dcf97f43969ea1cb4416073960@sentry.io/1373107',
  environment: JSON.parse(process.env.FIREBASE_CONFIG).projectId === 'real-45953' ? 'prod' : 'staging'
})
Sentry.configureScope(scope => {
  scope.setTag('function', 'builder')
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

const defaultDevo = {
  editing: false,
  title: '',
  mainIdea: '',
  bibleRefs: [],
  notes: '',
  sectionOrder: [],
  status: 'build',
  usedResources: []
}

const defaultGuide = {
  sectionOrder: [],
  status: 'build'
}

const defaultReview = {
  sectionOrder: [],
  status: 'build'
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

const guideTypes = [ 'lecture', 'discussion', 'question', 'answer', 'expositional' ]

exports.addLesson = functions.firestore.document('curriculumEdit/{seriesid}/lessons/{lessonid}').onCreate((snap, context) => {
  setSentryUser(context)
  const devosRef = snap.ref.collection('devos')
  const guidesRef = snap.ref.collection('guides')
  const reviewRef = snap.ref.collection('review')

  const devoBatch = firestore.batch()
  const guideBatch = firestore.batch()
  const reviewBatch = firestore.batch()

  const devoContentBatch = firestore.batch()
  const guideContentBatch = firestore.batch()

  // Setup devo batch
  // Add 7 devos ids 1 through 7
  for (let x = 1; x <=7; x++) {
    devoBatch.set(devosRef.doc(x.toString()), defaultDevo)
    devoContentBatch.set(devosRef.doc(`${x.toString()}/structure/hook`), defaultHook)
    devoContentBatch.set(devosRef.doc(`${x.toString()}/structure/application`), defaultApplication)
    devoContentBatch.set(devosRef.doc(`${x.toString()}/structure/prayer`), defaultPrayer)
  }

  // Setup guide batch
  // Add guide for each type in guideTypes
  guideTypes.forEach((type) => {
    guideBatch.set(guidesRef.doc(type), defaultGuide)
    guideContentBatch.set(guidesRef.doc(`${type}/structure/hook`), defaultHook)
    guideContentBatch.set(guidesRef.doc(`${type}/structure/application`), defaultApplication)
    guideContentBatch.set(guidesRef.doc(`${type}/structure/prayer`), defaultPrayer)
  })

  // Setup review batch
  // Just one review document
  reviewBatch.set(reviewRef.doc('review'), defaultReview)

  return Promise.all([devoBatch.commit(), guideBatch.commit(), reviewBatch.commit(), devoContentBatch.commit(), guideContentBatch.commit()])
    .then(() => {
      Sentry.addBreadcrumb({
        category: 'builder',
        message: `Cloud Function (addLesson) - lesson added successfully: ${snap.ref.id}`,
        level: 'info'
      })
    })
    .catch(err => { Sentry.captureException(err) })
})

exports.removeLesson = functions.firestore.document('curriculumEdit/{seriesid}/lessons/{lessonid}').onDelete((snap, context) => {
  setSentryUser(context)
  const paths = []
  // Devo collection paths
  for (let x = 1; x <= 7; x++) {
    paths.push(`${snap.ref.path}/devos`)
    paths.push(`${snap.ref.path}/devos/${x}/structure`)
    paths.push(`${snap.ref.path}/devos/${x}/sections`)
    paths.push(`${snap.ref.path}/devos/${x}/modules`)
  }

  // Guide collection paths
  guideTypes.forEach((type) => {
    paths.push(`${snap.ref.path}/guides`)
    paths.push(`${snap.ref.path}/guides/${type}/structure`)
    paths.push(`${snap.ref.path}/guides/${type}/sections`)
    paths.push(`${snap.ref.path}/guides/${type}/modules`)
  })

  // Review collection path
  paths.push(`${snap.ref.path}/review`)
  paths.push(`${snap.ref.path}/review/review/structure`)
  paths.push(`${snap.ref.path}/review/review/sections`)
  paths.push(`${snap.ref.path}/review/review/modules`)

  return Promise.all(paths.map((path) => {
    return deleteCollection(firestore, path, 10)
  })).then(() => {
    Sentry.addBreadcrumb({
      category: 'builder',
      message: `Cloud Function (removeLesson) - lesson removed successfully: ${snap.ref.id}`,
      level: 'info'
    })
  }).catch(err => { Sentry.captureException(err) })
})

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
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref)
      })

      return batch.commit().then(() => {
        return snapshot.size;
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
    })
    .catch(err => {
      Sentry.captureException(err)
      reject(err)
    })
}