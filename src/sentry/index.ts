import { defaultApp as admin } from '../db'

const Sentry = require('@sentry/node')

Sentry.init({
  dsn: 'https://d3d741dcf97f43969ea1cb4416073960@sentry.io/1373107',
  environment: JSON.parse(process.env.FIREBASE_CONFIG).projectId === 'real-45953' ? 'prod' : 'staging'
})

export function captureException(error) {
  return Sentry.captureException(error)
}

export function addBreadcrumb(crumb) {
  return Sentry.addBreadcrumb(crumb)
}

export function captureMessage(msg) {
  return Sentry.captureMessage(msg)
}

export function setSentryScope(tag) {
  return Sentry.configureScope(scope => {
    scope.setTag('function', tag)
  })
}

export function configureScope(ip) {
  return Sentry.configureScope(scope => {
    scope.setUser({
      ip_address: ip
    })
  })
}

export async function setSentryUser(context, uid?) {
  const user = uid !== '' ? await admin.auth().getUser(uid) : { email: '', displayName: '' }
  return Sentry.configureScope(scope => {
    scope.setUser({
      email: user.email,
      id: context.auth.uid,
      username: user.displayName,
      ip_address: context.rawRequest.ip
    })
  })
}