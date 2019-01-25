import * as functions from 'firebase-functions'

const sgClient = require('@sendgrid/client')
sgClient.setApiKey(functions.config().sendgrid.key)

type EMAIL_TYPES = 'new' | 'invite'

const templates = {
  new: {
    id: 'd-eefc40f0276c48dda0988c8b234430d6',
    address: 'login@realchurch.app',
    name: 'REAL Church Login'
  },
  invite: {
    id: 'd-0a66d8df8eca4edcacc34f6bc83ed15a',
    address: 'invite@realchurch.app',
    name: 'REAL Church Invite'
  }
}

interface EmailBody {
  from: {
    email: string,
    name: string
  },
  personalizations: [
    {
      to: [
        {
          email: string
        }
      ],
      dynamic_template_data: any
    }
  ],
  template_id
}

class EmailDocument {
  url: string = '/v3/mail/send'
  method: string = 'POST'
  body: EmailBody = {
    from: {
      email: '',
      name: ''
    },
    personalizations: [
      {
        to: [
          {
            email: ''
          }
        ],
        dynamic_template_data: {}
      }
    ],
    template_id: ''
  }
  constructor (type: EMAIL_TYPES, to: string, data: any) {
    console.log('email object', this, type)
    // Set template id
    this.body.template_id = templates[type].id
    // Set to address
    this.body.personalizations[0].to[0].email = to
    // Set from
    this.body.from.email = templates[type].address
    this.body.from.name = templates[type].name
    // Set other data
    switch (type) {
      case 'new':
        this.body.personalizations[0].dynamic_template_data.email = to
        this.body.personalizations[0].dynamic_template_data.rand_pswd = data.pswd
        break
      case 'invite':
        this.body.personalizations[0].dynamic_template_data.email = to
        this.body.personalizations[0].dynamic_template_data.username = data.username
        this.body.personalizations[0].dynamic_template_data.docType = data.docType
        this.body.personalizations[0].dynamic_template_data.app = data.app
        break
      default:
        return
    }
  }
}

export function sendEmail (type: EMAIL_TYPES, address: string, data: any) {
  const email = new EmailDocument(type, address, data)
  return sgClient.request(email)
}