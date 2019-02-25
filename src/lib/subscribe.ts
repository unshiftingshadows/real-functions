import * as functions from 'firebase-functions'
const axios = require('axios')
const cors = require('cors')({ origin: true })

const listids = {
  all: 'a31b4682bb'
}

exports.mcSubscribe = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    const type = req.body.type

    const subscriber = JSON.stringify({
      'email_address': req.body.email,
      'status': 'subscribed'
    })

    res.status(200).send({ request: req.body, status: subscriber, type })

    // axios({
    //   method: 'post',
    //   url: `https://us15.api.list-manage.com/3.0/lists/${listids[type]}/members/`,
    //   data: subscriber,
    //   dataType: 'json',
    //   contentType: 'application/json; charset=utf-8',
    //   headers: {
    //     'Authorization': `apikey ${functions.config().mailchimp.key}`
    //   }
    // }).then((result) => {
    //   console.log('success', result)
    //   res.status(200).send({ request: req.body, result })
    // }).catch((err) => {
    //   console.error('mailchimp...', err)
    //   res.status(501).send({ request: req.body, err })
    // })
  })
})