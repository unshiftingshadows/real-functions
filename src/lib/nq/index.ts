import * as functions from 'firebase-functions';
import { auth, nqAuth, nqFirestore } from './../../db';

const snippetTypes = [ 'quote', 'idea', 'illustration', 'outline' ]

exports.login = functions.https.onCall(async (data, context) => {
  const userRecord = await auth.getUser(context.auth.uid)
  if ((userRecord.customClaims as any).realAdmin) {
    const nquid = data.uid
    try {
      const token = await nqAuth.createCustomToken(nquid)
      return { status: true, token }
    } catch (error) {
      return { status: false, error}
    }
  } else {
    return { status: false, error: new Error('invalid credentials - not REAL Admin user') }
  }
})

exports.topic = functions.https.onCall(async (data, context) => {
  const userRecord = await auth.getUser(context.auth.uid)
  if ((userRecord.customClaims as any).realAdmin) {
    const topicList = data.topics

    const topicData = (await Promise.all(topicList.map(e => {
      return nqFirestore.collection('topics').doc(e).get()
    }))).map(e => { return { ...(e as any).data(), id: (e as any).id } })

    const initResources = (await Promise.all(topicList.map(e => {
      return nqFirestore.collection('topics').doc(e).collection('resources').get()
    }))).map(e => { return (e as any).docs.map(f => { return f.data() }) })

    const midResources = await Promise.all(initResources.map(async e => {
      const resourceData = (await Promise.all(e.map(async f => {
        return await nqFirestore.collection(f.type + 's').doc(f.id).get()
      }))).map(f => { return (f as any).data() })
      const mediaData = (await Promise.all(e.map(async (g, index) => {
        if (snippetTypes.indexOf(g.type) > -1) {
          return await nqFirestore.collection(resourceData[index].mediaType + 's').doc(resourceData[index].mediaid).get()
        } else {
          return null
        }
      }))).map(g => { return g !== null ? (g as any).data() : {} })
      console.log('resourceData', resourceData)
      console.log('mediaData', mediaData)
      return e.map((h, index) => {
        return {...h, media: snippetTypes.indexOf(h.type) > -1 ? {...resourceData[index], media: mediaData[index]} : resourceData[index]}
      })
    }))

    console.log('midResources', midResources)

    return { topicData, joined: await topicData.map((e, index) => { return {...e, resources: midResources[index]} }) }
  } else {
    return false
  }
})