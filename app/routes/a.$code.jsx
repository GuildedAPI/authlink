import { json, redirect } from '@remix-run/server-runtime'

import pool from '~/psql.server'
import client from '~/redis.server'
import { getSession } from '~/sessions.server'
import { randomString } from '~/common/random'

import AuthRenderFunction, { action as authAction, scopeNames } from '~/routes/auth'


export async function loader({ request, params }) {
  const url = new URL(request.url)
  const query = url.searchParams
  const code = params.code
  if (!/[\w-]{1,100}/.test(code)) {
    throw json({message: 'Invalid vanity code.'}, {status: 400})
  }

  const connection = await pool.acquire()
  const vanityStatement = await connection.prepare(
    `
    SELECT
      client_id,
      applications.name,
      scopes,
      redirect_uri,
      prompt,
      disabled_at,
      applications.icon_hash,
      applications.team_id,
      applications.redirect_uris,
      applications.show_team,
      applications.created_at
    FROM
      vanity_codes,
      applications
    WHERE
      code = $1
      AND client_id = applications.bot_id
    `
  )
  const vanityResult = await vanityStatement.execute({params: [code]})
  if (vanityResult.rows.length === 0) {
    throw json({message: 'No such vanity code found.'}, {status: 404})
  }
  const row = vanityResult.rows[0]
  if (row[5] != null) {
    throw json({message: 'This vanity code is currently disabled.'}, {status: 404})
  }

  const askDev = ` Ask the developer of ${row[1]} to check this application's settings.`
  const clientId = row[0]
  const redirectUri = query.get('redirect_uri') ?? row[3]
  if (!redirectUri) {
    throw json({message: `This vanity has no redirect URI connected.` + askDev}, {status: 500})
  }
  const scopeStr = query.get('scope')
  let scopes = []
  if (!scopeStr) {
    scopes = row[2]
    if (!scopes) {
      throw json({message: `This vanity has no scopes connected.` + askDev}, {status: 500})
    }
  } else {
    scopes = scopeStr.split(' ')
  }
  for (const scope of scopes) {
    if (!Object.keys(scopeNames).includes(scope)) {
      throw json({message: 'Invalid scope(s) requested.'}, {status: 400})
    }
  }
  const state = query.get('state')
  const prompt = query.get('prompt') ?? row[4]

  const session = await getSession(request.headers.get('Cookie'))
  if (!session.has('guilded')) {
    return redirect(`/start?${query}`)
  }
  const guildedData = session.get('guilded')
  
  const validRedirectUris = row[8] ?? []
  if (!validRedirectUris.includes(redirectUri)) {
    throw json({message: 'Invalid redirect URI.'}, {status: 400})
  }

  if (prompt === 'none') {
    const authStatement = await connection.prepare('SELECT * FROM authorizations WHERE client_id = $1 AND user_id = $2')
    const authResult = await authStatement.execute({params: [clientId, guildedData.user.id]})

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

    if (alreadyHasAllScopes) {
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
  }

  await connection.close()

  return {
    application: {
      bot_id: row[0],
      name: row[1],
      icon_hash: row[6],
      team_id: row[9] === false ? null : row[7],
      created_at: row[10],
    },
    redirectUri,
    scopes,
    state,
  }
}

export const action = authAction
export default AuthRenderFunction
