import { useLoaderData, useSubmit } from '@remix-run/react'
import { json, redirect } from '@remix-run/server-runtime'

import pool from '~/psql.server'
import client from '~/redis.server'
import { getSession } from '~/sessions.server'
import { randomString } from '~/common/random'
import { Button } from '~/common/components'

export async function loader({ request }) {
  const url = new URL(request.url)
  const query = url.searchParams

  const clientId = query.get('client_id')
  if (!clientId) {
    throw json({message: 'No client ID provided.'}, {status: 400})
  }
  const redirectUri = query.get('redirect_uri')
  if (!redirectUri) {
    throw json({message: 'No redirect URI provided.'}, {status: 400})
  }
  const scopeStr = query.get('scope')
  if (!scopeStr) {
    throw json({message: 'No scope provided.'}, {status: 400})
  }
  const scopes = scopeStr.split(' ')
  for (const scope of scopes) {
    if (!Object.keys(scopeNames).includes(scope)) {
      throw json({message: 'Invalid scope(s) provided.'}, {status: 400})
    }
  }
  const state = query.get('state')

  const session = await getSession(request.headers.get('Cookie'))
  if (!session.has('guilded')) {
    return redirect(`/start?${query}`)
  }
  const guildedData = session.get('guilded')

  const connection = await pool.acquire()
  let appResult = null
  let authResult = null
  try {
    const appStatement = await connection.prepare('SELECT * FROM applications WHERE bot_id = $1')
    appResult = await appStatement.execute({params: [clientId]})

    const authStatement = await connection.prepare('SELECT * FROM authorizations WHERE client_id = $1 AND user_id = $2')
    authResult = await authStatement.execute({params: [clientId, guildedData.user.id]})
  } finally {
    await connection.close()
  }

  if (appResult.rows.length < 1) {
    throw json({message: 'No such client with that ID.'}, {status: 404})
  }

  const valid_redirect_uris = appResult.rows[0][2] || []
  if (!valid_redirect_uris.includes(redirectUri)) {
    throw json({message: 'Invalid redirect URI.'}, {status: 400})
  }

  const alltimeScopes = []
  for (const row of authResult.rows) {
    if (row[4] <= Date.now()) {
      // expires_at <= now
      continue
    }
    for (const scope of row[3]) {
      // This will inevitably have duplicates but it doesn't matter
      alltimeScopes.push(scope)
    }
  }
  let alreadyHasAllScopes = true
  for (const scope of scopes) {
    if (!alltimeScopes.includes(scope)) {
      alreadyHasAllScopes = false
      break
    }
  }

  if (query.get('prompt') === 'none' && (alreadyHasAllScopes)) {
    const code = randomString(32)
    const uri = new URL(redirectUri)
    uri.searchParams.append('code', code)
    if (state) uri.searchParams.append('state', state)
    await client.set(
      `guilded_authlink_oauth_code_${code}`,
      JSON.stringify({
        client_id: clientId,
        scopes: scopes,
        redirect_uri: redirectUri,
        user_id: guildedData.user.id,
      }),
      {
        EX: 15
        // 15s is a pretty exorbitant amount of time; it may be shortened later.
      },
    )
    return redirect(uri)
  }
  const appRow = appResult.rows[0]
  return {
    application: {
      bot_id: appRow[0],
      name: appRow[4],
      icon_hash: appRow[5],
      //user_id: appRow[6],
      team_id: appRow[11] === false ? null : appRow[7],
      created_at: appRow[8],
      //bot_created_at: appRow[9],
    },
    redirectUri,
    scopes,
    state,
  }
}

export async function action({ request }) {
  const data = await request.formData()
  const clientId = data.get('client_id')
  const scope = data.get('scope')
  const state = data.get('state')
  const redirectUri = data.get('redirectUri')
  const uri = new URL(redirectUri)
  if (state) uri.searchParams.append('state', state)

  const session = await getSession(request.headers.get('Cookie'))
  if (!session.has('guilded')) {
    const query = new URLSearchParams({
      client_id: clientId,
      scope: scope,
      redirect_uri: redirectUri,
    })
    return redirect(`/start?${query}`)
  }
  const guildedData = session.get('guilded')

  const code = randomString(32)
  uri.searchParams.append('code', code)
  await client.set(
    `guilded_authlink_oauth_code_${code}`,
    JSON.stringify({
      client_id: clientId,
      scopes: scope.split(' '),
      redirect_uri: redirectUri,
      user_id: guildedData.user.id,
    }),
    {
      EX: 15
      // 15s is a pretty exorbitant amount of time; it may be shortened later.
    },
  )
  return redirect(uri)
}

export const scopeNames = {
  identify: 'Your Guilded user profile (name, avatar, etc.)',
  servers: 'A list of the servers that you\'re in',
  'servers.members.read': 'Your server-specific member data (nickname, roles, etc.) for public servers that you\'re in',
}

export default function Authorize() {
  const submit = useSubmit()
  const data = useLoaderData()
  const app = data.application
  const createdAt = new Date(app.created_at)
  //const botCreatedAt = new Date(app.bot_created_at)

  let iconUrl = 'https://img.guildedcdn.com/asset/Default/Gil-sm.png'
  if (app.icon_hash) {
    iconUrl = `https://img.guildedcdn.com/UserAvatar/${app.icon_hash}-Small.webp`
  }

  const redirectUri = new URL(data.redirectUri)

  return (
    <div className='w-96 max-w-full mx-auto bg-guilded-slate border border-white/10 rounded-lg p-5 h-full shadow-2xl'>
      <div className='flex'>
        <img src={iconUrl} className='mr-4 rounded-full h-14'/>
        <h1 className='my-auto text-3xl font-bold'>{app.name}</h1>
      </div>
      <hr className='border-black/50 my-5'/>
      <p>If authorized, this application will be able to access the following read-only data:</p>
      <ul className='mt-2'>
        {data.scopes.map(scope => (
          <li key={scope} className='flex'>
            <i className='ci-circle_check text-2xl text-green-500 mr-2'/>{' '}
            <p className='my-auto'>{scopeNames[scope] || scope}</p>
          </li>
        ))}
      </ul>
      <hr className='border-black/50 my-5'/>
      <ul className='text-guilded-subtitle text-xs cursor-default space-y-1'>
        <li className='flex'>
          <i className='ci-clock mr-2 mt-[2px]' />
          <p>This application was created on {createdAt.toLocaleString('en', {dateStyle: 'medium'})}.</p>
        </li>
        {app.team_id && (
          <li className='flex'>
            <i className='ci-location_outline mr-2 mt-[2px]' />
            <p>You can reach {app.name}'s developer on <a href={`https://www.guilded.gg/teams/${app.team_id}`} target='_blank' className='text-guilded-link'>its linked server</a>.</p>
            {/*
              TODO: I'm not really happy with this wording but it's the best I could come up with.
              "its linked server" is supposed to mean "the application's linked server", but that's too cumbersome.
              The problem is that it seems like "it" refers to the developer instead of the application.
              I considered "the linked server" but was afraid this would be mistaken for an Authlink server instead.
            */}
          </li>
        )}
        <li className='flex'>
          <i className='ci-external_link mr-2 mt-[2px]' />
          <p>You will be redirected to a non-Guilded site: <span className='text-guilded-gilded font-bold'>{redirectUri.origin}</span></p>
        </li>
      </ul>
      <hr className='border-black/50 mt-5 mb-4'/>
      <div className='flex flex-wrap-reverse'>
        <button
          className='mr-4 text-guilded-subtitle hover:text-white transition-colors'
          onClick={() => {
            window.history.length > 1
            ? window.history.back()
            : open('/', '_self')
          }}
        >No thanks</button>
        <Button
          className='ml-auto'
          onClick={() => {
            const d = {
              _action: 'authorize',
              client_id: app.bot_id,
              redirectUri: data.redirectUri,
              scope: data.scopes.join(' '),
            }
            if (data.state) d.state = data.state
            submit(d, {
              method: 'post',
            })
          }}
        >Authorize
        </Button>
      </div>
    </div>
  )
}
