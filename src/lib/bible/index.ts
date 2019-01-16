import * as functions from 'firebase-functions'
import { defaultApp as admin } from '../../db'
const bcv_parser = require('bible-passage-reference-parser/js/en_bcv_parser').bcv_parser
const htmlToText = require('html-to-text')
const axios = require('axios')

const Sentry = require('@sentry/node')
Sentry.init({
  dsn: 'https://d3d741dcf97f43969ea1cb4416073960@sentry.io/1373107',
  environment: JSON.parse(process.env.FIREBASE_CONFIG).projectId === 'real-45953' ? 'prod' : 'staging'
})
Sentry.configureScope(scope => {
  scope.setTag('function', 'bible')
})

async function setSentryUser(context) {
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

const versionList = {
  'esv': getESV,
  'kjv': getDBP,
  'nas': getDBP,
  'nkj': getDBP,
  'asv': getDBP,
  'web': getDBP,
  'niv': getDBP,
  'net': getNET,
  'leb': getBiblia,
  'nlt': getNLT
}

const otBooks = ['Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1Sam', '2Sam', '1Kgs', '2Kgs', '1Chr', '2Chr', 'Ezra', 'Neh', 'Esth', 'Job', 'Ps', 'Prov', 'Eccl', 'Song', 'Isa', 'Jer', 'Lam', 'Ezek', 'Dan', 'Hos', 'Joel', 'Amos', 'Obad', 'Jonah', 'Mic', 'Nah', 'Hab', 'Zeph', 'Hag', 'Zech', 'Mal']
const ntBooks = ['Matt', 'Mark', 'Luke', 'John', 'Acts', 'Rom', '1Cor', '2Cor', 'Gal', 'Eph', 'Phil', 'Col', '1Thess', '2Thess', '1Tim', '2Tim', 'Titus', 'Phlm', 'Heb', 'Jas', '1Pet', '2Pet', '1John', '2John', '3John', 'Jude', 'Rev']

function getESV(parsedRef, version) {
  var bcv = new bcv_parser
  // console.log('parsed esv', parsedRef.osis())
  return axios.get('https://api.esv.org/v3/passage/text/?q=' + parsedRef.osis(), {
    params: {
      'include-passage-references': false,
      'include-first-verse-numbers': false,
      'include-verse-numbers': false,
      'include-footnotes': false,
      'include-footnote-body': false,
      'include-short-copyright': false,
      'include-copyright': false,
      'include-passage-horizontal-lines': false,
      'include-heading-horizontal-lines': false,
      'include-headings': false
    },
    headers: {
      'Authorization': functions.config().esv.key
    }
  })
  .then((data) => {
    return {
      parse: parsedRef,
      text: data.data.passages.join('...')
    }
  })
  .catch((err) => {
    Sentry.captureException(err)
    return false
  })
}

function getDBP(parsedRef, version) {
  var ver = version.toUpperCase()
  var otnt = otBooks.indexOf(parsedRef.osis().split('.')[0]) > -1 ? 'O' : ntBooks.indexOf(parsedRef.osis().split('.')[0]) > -1 ? 'N' : Sentry.captureException(Error('Cloud Function (bibleText) - DBP book not found, ot/nt'))
  if (parsedRef.entities[0].type === 'sequence') {
    // Handle sequence of verses
    Sentry.captureException(Error('Cloud Function (bibleText) - DBP sequences not handled'))
  } else if (parsedRef.entities[0].type === 'range') {
    // Handle range of verses
    // console.log('dbp-range')
    if (parsedRef.entities[0].passages[0].start.b === parsedRef.entities[0].passages[0].end.b) {
      if (parsedRef.entities[0].passages[0].start.c === parsedRef.entities[0].passages[0].end.c) {
        var url = 'http://dbt.io/text/verse?key=' + functions.config().dbp.key + '&dam_id=ENG' + ver + otnt + '2ET&book_id=' + parsedRef.entities[0].passages[0].start.b + '&chapter_id=' + parsedRef.entities[0].passages[0].start.c + '&verse_start=' + parsedRef.entities[0].passages[0].start.v + '&verse_end=' + parsedRef.entities[0].passages[0].end.v + '&v=2'
        // console.log('url', url)
        return axios.get(url).catch((err) => {
          Sentry.captureException(err)
          // console.error(err)
          return false
        })
      } else {
        var currentChapter = parsedRef.entities[0].passages[0].start.c
        var queries = []
        queries.push(axios.get('http://dbt.io/text/verse?key=' + functions.config().dbp.key + '&dam_id=ENG' + ver + otnt + '2ET&book_id=' + parsedRef.entities[0].passages[0].start.b + '&chapter_id=' + parsedRef.entities[0].passages[0].start.c + '&verse_start=' + parsedRef.entities[0].passages[0].start.v + '&verse_end=1000&v=2'))
        currentChapter++
        for (; currentChapter < parsedRef.entities[0].passages[0].end.c; currentChapter++) {
          // console.log('loop for chapter ' + currentChapter)
          var url = 'http://dbt.io/text/verse?key=' + functions.config().dbp.key + '&dam_id=ENG' + ver + otnt + '2ET&book_id=' + parsedRef.entities[0].passages[0].start.b + '&chapter_id=' + currentChapter + '&v=2'
          // console.log('url', url)
          queries.push(axios.get(url))
        }
        queries.push(axios.get('http://dbt.io/text/verse?key=' + functions.config().dbp.key + '&dam_id=ENG' + ver + otnt + '2ET&book_id=' + parsedRef.entities[0].passages[0].start.b + '&chapter_id=' + parsedRef.entities[0].passages[0].end.c + '&verse_start=1&verse_end=' + parsedRef.entities[0].passages[0].end.v + '&v=2'))
        return axios.all(queries)
          .then(axios.spread((...args) => {
            return {
              parse: parsedRef,
              text: args.map(e => { return e.data.map(f => { return f.verse_text }).join(' ') }).join(' ')
            }
          }))
          .catch(err => {
            Sentry.captureException(err)
            return false
          })
      }
    } else {
      Sentry.captureException(Error('Cloud Functions (bibleText) - DBP books in range don\'t match'))
      console.error('dbp: books in range don\'t match...')
      return false
    }
  } else if (parsedRef.entities[0].type === 'bcv') {
    // Handle individual verse
    var url = 'http://dbt.io/text/verse?key=' + functions.config().dbp.key + '&dam_id=ENG' + ver + otnt + '2ET&book_id=' + parsedRef.entities[0].passages[0].start.b + '&chapter_id=' + parsedRef.entities[0].passages[0].start.c + '&verse_start=' + parsedRef.entities[0].passages[0].start.v + '&v=2'
    // console.log('url', url)
    return axios.get(url)
      .then((data) => {
        // console.log('dbp-data', data.data.map(e => { return e.verse_text }).join(' '))
        return {
          parse: parsedRef,
          text: data.data.map(e => { return e.verse_text }).join(' ')
        }
      })
      .catch((err) => {
        Sentry.captureException(err)
        return false
      })
  }

}

function getNET(parsedRef, version) {
  var formattedRef = ''
  if (parsedRef.entities[0].type === 'sequence') {
    // Return sequenced ref
    Sentry.captureException(Error('Cloud Functions (bibleText) - NET sequences not handled'))
    return false
  } else if (parsedRef.entities[0].type === 'range') {
    // Return range ref
    if (parsedRef.entities[0].passages[0].start.c === parsedRef.entities[0].passages[0].end.c) {
      formattedRef = parsedRef.entities[0].passages[0].start.b + '+' + parsedRef.entities[0].passages[0].start.c + '.' + parsedRef.entities[0].passages[0].start.v + '-' + parsedRef.entities[0].passages[0].end.v
    } else {
      formattedRef = parsedRef.entities[0].passages[0].start.b + '+' + parsedRef.entities[0].passages[0].start.c + '.' + parsedRef.entities[0].passages[0].start.v + '-' + parsedRef.entities[0].passages[0].end.c + '.' + parsedRef.entities[0].passages[0].end.v
    }
  } else if (parsedRef.entities[0].type === 'bcv') {
    // Return formatted ref
    formattedRef = parsedRef.osis().split('.')[0] + '+' + parsedRef.osis().split('.').slice(1).join('.')
  }
  // console.log(formattedRef)
  return axios.get('http://labs.bible.org/api/?passage=' + formattedRef + '&formatting=plain')
    .then((data) => {
      // console.log('net-data', data.data)
      var text = data.data.replace(/\d:\d+ /g, '')
      text = text.replace(/ +\d+/g, '')
      return {
        parse: parsedRef,
        text: text
      }
    })
    .catch((err) => {
      Sentry.captureException(err)
      return false
    })
}

function getBiblia(parsedRef, version) {
  var ver = version.toUpperCase()
  return axios.get('https://api.biblia.com/v1/bible/content/' + ver + '.html?passage=' + parsedRef.osis() + '&key=' + functions.config().biblia.key + '&style=bibleTextOnly')
    .then((data) => {
      console.log('leb-data', data.data)
      return {
        parse: parsedRef,
        text: htmlToText.fromString(data.data)
      }
    })
    .catch((err) => {
      Sentry.captureException(err)
      return false
    })
}

function getNLT(parsedRef, version) {
  return axios.get('http://api.nlt.to/api/passages?ref=' + parsedRef.osis())
    .then((data) => {
      return {
          parse: parsedRef,
          text: htmlToText.fromString(data.data)
      }
    })
    .catch((err) => {
      Sentry.captureException(err)
      return false
    })
}

exports.bibleText = functions.https.onCall((data, context) => {
  setSentryUser(context)
  if (!context.auth) {
    Sentry.captureException(Error('Cloud Function (bibleText) - The function must be called while authenticated'))
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called while authenticated.');
  }
  // functions.config().someservice.id
  const ref = data.bibleRef
  const version = data.version
  console.log('ref', ref)

  const bcv = new bcv_parser
  const parsedRef = bcv.parse(ref)
  // return axios.get('https://api.esv.org/v3/passage/text/?q=' + parsedRef.osis(), {
  //   params: {
  //     'include-passage-references': false,
  //     'include-first-verse-numbers': false,
  //     'include-verse-numbers': false,
  //     'include-footnotes': false,
  //     'include-footnote-body': false,
  //     'include-short-copyright': false,
  //     'include-copyright': false,
  //     'include-passage-horizontal-lines': false,
  //     'include-heading-horizontal-lines': false,
  //     'include-headings': false
  //   },
  //   headers: {
  //     'Authorization': functions.config().esv.key
  //   }
  // })
  if (Object.keys(versionList).indexOf(version) === -1) {
    Sentry.captureException(Error(`Cloud Function (bibleText) - ${version} version invalid`))
    return false
  }
  return versionList[version](parsedRef, version)
    .then((esvData) => {
      Sentry.addBreadcrumb({
        category: 'bible',
        message: `Cloud Function (bibleText) - text retrieved successfully`,
        level: 'info'
      })
      return {
        parse: parsedRef,
        text: esvData.data.passages.join('...')
      }
    })
    .catch((err) => {
      Sentry.captureException(err)
      return {
        err: err
      }
    })
})