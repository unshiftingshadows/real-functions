import * as functions from 'firebase-functions'
const bcv_parser = require('bible-passage-reference-parser/js/en_bcv_parser').bcv_parser
const axios = require('axios')

exports.bibleText = functions.https.onCall((data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called while authenticated.');
  }
  // functions.config().someservice.id
  const ref = data.bibleRef
  console.log('ref', ref)

  const bcv = new bcv_parser
  const parsedRef = bcv.parse(ref)
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
  .then((esvData) => {
    return {
      parse: parsedRef,
      text: esvData.data.passages.join('...')
    }
  })
  .catch((err) => {
    return {
      err: err
    }
  })

})