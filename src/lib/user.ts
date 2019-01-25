import * as functions from 'firebase-functions';
import * as fbAdmin from 'firebase-admin'
import { defaultApp as admin, auth, firestore } from '../db'
import { sendEmail } from './email'
import { DocumentSnapshot } from '@google-cloud/firestore';
import { APP } from './notifications';

const Sentry = require('@sentry/node')
Sentry.init({
  dsn: 'https://d3d741dcf97f43969ea1cb4416073960@sentry.io/1373107',
  environment: JSON.parse(process.env.FIREBASE_CONFIG).projectId === 'real-45953' ? 'prod' : 'staging'
})
Sentry.configureScope(scope => {
  scope.setTag('function', 'user')
})

async function setSentryUser (context, uid) {
  const user = uid !== '' ? await admin.auth().getUser(uid) : { email: '', displayName: '' }
  return Sentry.configureScope(scope => {
    scope.setUser({
      email: user.email,
      id: uid || '',
      username: user.displayName,
      ip_address: context.rawRequest ? context.rawRequest.ip : ''
    })
  })
}

// Message pref defaults
const messageApp = {
  prefs: {
    contentType: {
      message: true,
      scratch: true,
      series: true
    },
    mediaType: {
      illustration: true,
      image: true,
      lyric: false,
      quote: true,
      video: true
    },
    messageStructure: {
      hook: true,
      application: true,
      prayer: true
    },
    structureNames: {
      application: "Application",
      hook: "Hook",
      prayer: "Prayer"
    },
    speakingSpeed: 120
  },
  stats: {
    nummessage: 0,
    numscratch: 0,
    numarchive: 0,
    numquote: 0,
    numimage: 0,
    numvideo: 0,
    numlyric: 0,
    numillustration: 0
  }
}

// Curriculum pref defaults
const curriculumApp = {}

// Prayer pref defaults
const prayerApp = {}

// Database pref defaults
const databaseApp = {}

// Pull defaults of app called
const appDefaults = {
  message: messageApp,
  curriculum: curriculumApp,
  prayer: prayerApp,
  database: databaseApp
}

/**
 * Cloud Function - Add User
 * app callable function for admins that adds a user
 * once user is created, an email with a random password is sent to them
 * 
 * @param name new user's name - an object with first and last
 * @param email new user's email
 * @param churchid (optional) id of the church to add this user to
 * @param apps can add default prefs for any number of apps upon registering
 */
exports.adminAddUser = functions.https.onCall(async (data, context) => {
  await setSentryUser(context, context.auth.uid)
  if (context.auth.token.realAdmin !== true) {
    Sentry.captureMessage(`Cloud Function (adminAddUser) not authorized | uid: ${context.auth.uid}`)
    return {
      error: "Request not authorized"
    }
  }

  const randompass = Math.random().toString(36).slice(-8);

  return auth.createUser({
    email: data.email,
    password: randompass,
    emailVerified: true
  }).then((userRecord) => {
    return addUserData(userRecord.uid, data.name, data.email, data.apps, data.churchid)
      .then(() => {
        return sendEmail('new', data.email, { pswd: randompass })
          .then(([response, body]) => {
            console.log('New user data added!', data.email, response.statusCode)
            return { status: 200, message: 'New user data added!' }
          })
          .catch(err => {
            Sentry.captureException(err)
            console.error('Error sending new user email', err)
            return { status: 400, message: 'Error sending new user email', err }
          })
      }).catch((err) => {
        Sentry.captureException(err)
        console.error('Error adding new user data', err)
        return { status: 400, message: 'Error adding new user data', err }
      })
  }).catch((err) => {
    Sentry.captureException(err)
    console.error('Error creating new user: ', err)
    return { status: 400, message: 'Error creating new user', err }
  })
})

/**
 * Cloud Function - Add User
 * https callable function that adds a user
 * once user is created, an email with a random password is sent to them
 * 
 * @param name new user's name - an object with first and last
 * @param email new user's email
 * @param churchid (optional) id of the church to add this user to
 * @param app can add default prefs for a specific app upon registering
 */
exports.addUser = functions.https.onRequest((request, response) => {
  Sentry.configureScope(scope => {
    scope.setUser({
      ip_address: request.ip
    })
  })
  if (request.body.email === '' || request.body.email === null || request.body.email === undefined) {
    Sentry.captureException(Error('Cloud Function (addUser) - no email'))
    response.status(400).send('Error - no email')
    return
  }

  const randompass = Math.random().toString(36).slice(-8);

  auth.createUser({
    email: request.body.email,
    password: randompass,
    emailVerified: true
  }).then((userRecord) => {
    addUserData(userRecord.uid, request.body.name, request.body.email, [request.body.app], request.body.churchid).then(() => {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'New user created (https request)',
        level: 'info'
      })
      console.log('New user data added!', userRecord.email)
      response.send('New user added!')
      return
    }).catch((err) => {
      Sentry.captureException(err)
      console.error('Error adding new user data', err)
      response.status(400).send('Error adding new user data')
      return
    })
  }).catch((err) => {
    Sentry.captureException(err)
    console.error('Error creating new user: ', err)
    response.status(400).send('Error creating new user')
    return
  })
})

exports.addUserData = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    Sentry.captureMessage(`Cloud Function (addUserData) not authorized...`)
    return {
      error: 'Request not authorized'
    }
  }
  await setSentryUser(context, context.auth.uid)
  return addUserData(context.auth.uid, data.name, data.email, [data.app], data.churchid).then(() => {
    return { message: 'Success!' }
  }).catch(err =>{
    Sentry.captureException(err)
    return { message: 'Failed', err }
  })
})

async function addUserData (uid: string, name: { first: string, last: string }, email: string, apps: [APP], churchid?: string) {
  await admin.auth().updateUser(uid, { displayName: name.first + ' ' + name.last })

  const newUser = {
    name: name,
    email: email,
    churchid: churchid || false,
    churchRoles: {},
    newUser: true,
    nqUser: false,
    app: {
      prefs: {
        theme: 'light',
        bibleTranslation: 'nas'
      },
      lastPage: {
        host: '',
        path: ''
      },
      message: {}
    },
    supportRestore: {
      message: ''
    },
    realUser: false,
    realRoles: {}
  }

  apps.forEach(app => {
    newUser.app[app] = appDefaults[app]
  })

  return firestore.collection('user').doc(uid).set(newUser)
}

exports.newUserCheck = functions.auth.user().onCreate(async (user) => {
  let tempData: DocumentSnapshot
  try {
    tempData = await firestore.collection('userTemp').doc(user.email).get()
  } catch (err) {
    return false
  }
  // TODO: Log the fact that an invited user signed up
  // Set new user data
  // Set new uid to any docs that need to be shared
  const batch = firestore.batch()
  tempData.data().shareDoc.forEach((doc: { docType: string, docid: string }) => {
    batch.update(firestore.collection(`message${doc.docType.charAt(0).toUpperCase()}${doc.docType.slice(1)}`).doc(doc.docid), {
      users: fbAdmin.firestore.FieldValue.arrayUnion(user.uid)
    })
    batch.delete(tempData.ref)
  })
  return batch.commit()
})

/**
 * Cloud Function - App Auth
 * Custom auth function allowing users to login at login.realchurch.app
 * and use any of the REAL Church apps without having to re-login
 */
exports.appAuth = functions.https.onCall(async (data, context) => {
  await setSentryUser(context, context.auth.uid)
  const uid = context.auth.uid

  if (uid !== null) {
    return auth.createCustomToken(uid).then((customToken) => {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: `Cloud Function (appAuth) authorized user | ${uid}`,
        level: 'info'
      })
      return { customToken: customToken, uid: uid, status: 'success' }
    }).catch((err) => {
      Sentry.captureException(err)
      return { err: err, uid: uid, status: 'error' }
    })
  } else {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Cloud Function (appAuth) no uid',
      level: 'info'
    })
    return { uid: uid, status: 'nouid' }
  }
})

/**
 * Cloud Function - Add App
 * Add an app's default preferences to a user
 * 
 * @param appName app to be added to user's prefs
 */
exports.appAdd = functions.https.onCall(async (data, context) => {
  await setSentryUser(context, context.auth.uid)
  const uid = context.auth.uid
  const appName = data.appName

  const newData = { app: {} }

  if (Object.keys(appDefaults).indexOf(appName) !== -1) {
    newData[appName] = appDefaults[appName]
  } else {
    Sentry.captureException(Error('Cloud Function (appAdd) - app name invalid'))
    return Promise.reject('App name invalid')
  }

  if (uid !== null) {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: `Cloud Function (appAdd) added app ${appName} | uid ${uid}`,
      level: 'info'
    })
    return firestore.collection('user').doc(uid).update(newData)
  } else {
    Sentry.captureException(Error('Cloud Function (appAdd) - uid invalid'))
    return Promise.reject('Uid invalid')
  }
})

/**
 * Grants a realAdmin role to a user
 * - should only be granted by a realAdmin user
 *
 * @param {string} email user's email
 * @returns {Promise<void>} resolves promise once the claim is set
 */
async function grantRealAdminRole(email: string): Promise<void> {
  const user = await auth.getUserByEmail(email)
  if (user.customClaims && (user.customClaims as any).realAdmin === true) {
    return
  }
  return auth.setCustomUserClaims(user.uid, {
    realAdmin: true
  })
}

/**
 * Cloud Function - Add REAL
 * Adds the realAdmin token to a user
 * - can only be authorized by a current realAdmin user
 * 
 * @param email user to be authorized as a realAdmin
 * @returns {Promise<void>} resolves promise once the claim is set
 */
exports.addReal = functions.https.onCall(async (data, context) => {
  await setSentryUser(context, context.auth.uid)
  if (context.auth.token.realAdmin !== true) {
    Sentry.captureMessage(`Cloud Function (addReal) not authorized | uid: ${context.auth.uid}`)
    return {
      error: "Request not authorized"
    }
  }
  const email = data.email
  return grantRealAdminRole(email).then(() => {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: `Cloud Function (addReal) added real admin | email ${email}`,
      level: 'info'
    })
    return {
      result: `Request fulfilled! ${email} is now a REAL Admin`
    }
  })
})

/**
 * Grants a churchAdmin role to a user
 * - should only be granted by a realAdmin user or by another churchAdmin from the same church
 *
 * @param {string} email user's email
 * @returns {Promise<void>} promise resolves after claim is set
 */
async function grantChurchAdminRole(email: string, churchid: string): Promise<void> {
  const user = await auth.getUserByEmail(email)
  if (user.customClaims && (user.customClaims as any).churchAdmin === churchid) {
    return
  }
  return auth.setCustomUserClaims(user.uid, {
    churchAdmin: churchid
  })
}

/**
 * Cloud Function - Add Admin
 * Adds churchAdmin token to a user
 * - can only be granted by a realAdmin user or by a current churchAdmin
 * 
 * @param {string} email user's email
 * @returns {Promise<void>} promise resolves after claim is set
 */
exports.addAdmin = functions.https.onCall(async (data, context) => {
  await setSentryUser(context, context.auth.uid)
  if (context.auth.token.realAdmin !== true && context.auth.token.churchAdmin !== data.churchid) {
    Sentry.captureMessage(`Cloud Function (addAdmin) not authorized | uid: ${context.auth.uid}`)
    return {
      error: "Request not authorized"
    }
  }
  const email = data.email
  const churchid = data.churchid
  return grantChurchAdminRole(email, churchid).then(() => {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: `Cloud Function (addAdmin) added church admin | email ${email} churchid ${churchid}`,
      level: 'info'
    })
    return {
      result: `Request fulfilled! ${email} is now a Church Admin`
    }
  })
})