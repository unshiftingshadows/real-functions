import * as functions from 'firebase-functions';
import { auth, firestore } from './../../db'

const messageApp = {
  prefs: {
    contentType: {
      lesson: true,
      scratch: true,
      sermon: true
    },
    mediaType: {
      illustration: true,
      image: true,
      lyric: false,
      quote: true,
      video: true
    },
    sermonStructure: {
      hook: true,
      application: true,
      prayer: true
    },
    lessonStructure: {
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
    numsermon: 0,
    numlesson: 0,
    numscratch: 0,
    numarchive: 0,
    numquote: 0,
    numimage: 0,
    numvideo: 0,
    numlyric: 0,
    numillustration: 0
  }
}

const curriculumApp = {}

const prayerApp = {}

const databaseApp = {}

const appDefaults = {
  message: messageApp,
  curriculum: curriculumApp,
  prayer: prayerApp,
  database: databaseApp
}

exports.addUser = functions.https.onRequest((request, response) => {
  const newUser = {
    name: request.body.name,
    email: request.body.email,
    churchid: request.body.churchid || false,
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

  switch (request.body.app) {
    case 'message':
      newUser.app.message = messageApp
      break
    default:
      console.error('not acceptable app type')
  }

  auth.createUser({
    email: request.body.email,
    password: 'password',
    emailVerified: true
  }).then((userRecord) => {
    firestore.collection('user').doc(userRecord.uid).set(newUser)
      .then(() => {
        console.log('New user data added!', newUser.email)
        response.send('New user added!')
      }).catch((err) => {
        console.error('Error adding new user data', err)
        response.status(400).send('Error adding new user data')
      })
  }).catch((err) => {
    console.error('Error creating new user: ', err)
    response.status(400).send('Error creating new user')
  })
})

exports.appAuth = functions.https.onCall((data, context) => {
  const uid = context.auth.uid

  if (uid !== null) {
    return auth.createCustomToken(uid).then((customToken) => {
      return { customToken: customToken, uid: uid, status: 'success' }
    }).catch((err) => {
      return { err: err, status: 'error' }
    })
  } else {
    return { uid: uid, status: 'nouid' }
  }
})

exports.appAdd = functions.https.onCall((data, context) => {
  const uid = context.auth.uid
  const appName = data.appName

  const newData = { app: {} }

  if (Object.keys(appDefaults).indexOf(appName) !== -1) {
    newData[appName] = appDefaults[appName]
  } else {
    return Promise.reject('App name invalid')
  }

  if (uid !== null) {
    return firestore.collection('user').doc(uid).set(newData, { merge: true })
  } else {
    return Promise.reject('Uid invalid')
  }
})

async function grantRealAdminRole(email: string): Promise<void> {
  const user = await auth.getUserByEmail(email)
  if (user.customClaims && (user.customClaims as any).realAdmin === true) {
    return
  }
  return auth.setCustomUserClaims(user.uid, {
    realAdmin: true
  })
}

exports.addReal = functions.https.onCall((data, context) => {
  if (context.auth.token.realAdmin !== true) {
    return {
      error: "Request not authorized"
    }
  }
  const email = data.email
  return grantRealAdminRole(email).then(() => {
    return {
      result: `Request fulfilled! ${email} is now a REAL Admin`
    }
  })
})

async function grantChurchAdminRole(email: string): Promise<void> {
  const user = await auth.getUserByEmail(email)
  if (user.customClaims && (user.customClaims as any).churchAdmin === true) {
    return
  }
  return auth.setCustomUserClaims(user.uid, {
    churchAdmin: true
  })
}

exports.addAdmin = functions.https.onCall((data, context) => {
  if (context.auth.token.realAdmin !== true) {
    return {
      error: "Request not authorized"
    }
  }
  const email = data.email
  return grantChurchAdminRole(email).then(() => {
    return {
      result: `Request fulfilled! ${email} is now a moderator`
    }
  })
})