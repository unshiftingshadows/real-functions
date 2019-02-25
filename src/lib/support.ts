import * as functions from 'firebase-functions'
const nodemailer = require('nodemailer')

exports.sendSupport = functions.https.onCall((data, context) => {
  var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: functions.config().gmail.email,
      pass: functions.config().gmail.pswd
    }
  })
  const mailOptions = {
    from: data.email,
    to: 'support@realchurch.app',
    subject: data.subject,
    html: data.body
  }
  return transporter.sendMail(mailOptions).then((err, info) => {
    if (err) {
      console.error(err)
      return { status: 'error', err }
    } else {
      console.log(info)
      return { status: 'success', info }
    }
  })
})