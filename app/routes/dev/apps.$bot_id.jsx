import { Form, useActionData, useLoaderData, useSubmit, useTransition } from '@remix-run/react'
import { json, redirect } from '@remix-run/server-runtime'

import { useState } from 'react'
import { useFloating, shift, useInteractions, useClick } from '@floating-ui/react-dom-interactions'

import pool from '~/psql.server'
import { boilerplateLoader } from '~/sessions.server'
import { randomString } from '~/common/random'
import { tryBot, getBotWithMethod } from '~/common/bots'

import { Button, ErrorBlock, PopoutSelectables } from '~/common/components'


export async function loader({ request, params }) {
  const guildedData = await boilerplateLoader({request})

  const connection = await pool.acquire()
  let result = null
  let authorizationCount = 0
  let vanity = {}
  try {
    const statement = await connection.prepare(
      `
      SELECT
        bot_id,
        redirect_uris,
        name,
        icon_hash,
        user_id,
        team_id,
        show_team
      FROM
        applications
      WHERE
        bot_id = $1
        AND owner_id = $2
      `
    )
    result = await statement.execute({params: [ params.bot_id, guildedData.user.id ]})
    if (result.rows.length < 1) {
      throw json({ message: 'You do not own an application with that ID, or it does not exist.' }, { status: 404 })
    }
    const authStatement = await connection.prepare('SELECT COUNT(*) FROM authorizations WHERE client_id = $1')
    const authResult = await authStatement.execute({params: [params.bot_id]})
    if (authResult.rows.length > 0) {
      authorizationCount = authResult.rows[0][0]
    }
    const vanityStatement = await connection.prepare(
      `
      SELECT
        code,
        scopes,
        redirect_uri,
        prompt,
        disabled_at
      FROM
        vanity_codes
      WHERE
        client_id = $1
      `
    )
    const vanityResult = await vanityStatement.execute({params: [params.bot_id]})
    if (vanityResult.rows.length > 0) {
      vanity = {
        code: vanityResult.rows[0][0],
        scopes: vanityResult.rows[0][1],
        redirect_uri: vanityResult.rows[0][2],
        prompt: vanityResult.rows[0][3],
        disabled_at: vanityResult.rows[0][4],
      }
    }
  } finally {
    await connection.close()
  }

  const row = result.rows[0]
  const application = {
    bot_id: row[0],
    redirect_uris: row[1] ?? [],
    name: row[2],
    icon_hash: row[3],
    user_id: row[4],
    team_id: row[5],
    show_linked_server: row[6],
    authorization_count: authorizationCount,
  }

  return {
    user: guildedData.user,
    application,
    vanity,
  }
}

export async function action({ request, params }) {
  const guildedData = await boilerplateLoader({request})
  const data = await request.formData()

  let connection = null
  switch (data.get('_action')) {
    case 'set_redirect_uris':
      const redirectURIs = data.getAll('redirect_uri')
      if (redirectURIs.length > 10) {
        return {
          error: true,
          message: 'Cannot exceed maximum number of redirect URIs (10).',
        }
      }
      for (const uri of redirectURIs) {
        if (uri.length > 2000) {
          return {
            error: true,
            message: 'Cannot save a redirect URI over 2,000 characters.',
          }
        } else if (!uriRegex.test(uri)) {
          return {
            error: true,
            message: `"${uri}" is not a valid URI.`,
          }
        }
      }
      connection = await pool.acquire()
      try {
        const statement = await connection.prepare('UPDATE applications SET redirect_uris = $1 WHERE bot_id = $2 AND owner_id = $3')
        await statement.execute({params: [JSON.stringify(redirectURIs), params.bot_id, guildedData.user.id]})
      } finally {
        await connection.close()
      }
      return {
        redirect_uris: redirectURIs,
      }

    case 'reset_client_secret':
      const newSecret = generateSecret(params.bot_id)
      connection = await pool.acquire()
      try {
        const statement = await connection.prepare('UPDATE applications SET client_secret = $1 WHERE bot_id = $2 AND owner_id = $3')
        await statement.execute({params: [newSecret, params.bot_id, guildedData.user.id]})
      } finally {
        await connection.close()
      }
      return {
        secret: newSecret,
      }

    case 'update_profile':
      const bot_ = JSON.parse(data.get('bot'))
      bot_.id = params.bot_id
      const attempt = await getBotWithMethod(data.get('method'), bot_)
      if (attempt.error) {
        return attempt
      }
      const bot = attempt.bot
      connection = await pool.acquire()
      try {
        const statement = await connection.prepare('UPDATE applications SET name = $1, icon_hash = $2 WHERE bot_id = $3 AND owner_id = $4')
        await statement.execute({params: [bot.name, bot.iconHash, params.bot_id, guildedData.user.id]})
      } finally {
        await connection.close()
      }
      break

    case 'update_linked_server':
      connection = await pool.acquire()
      try {
        const statement = await connection.prepare('UPDATE applications SET show_team = $1 WHERE bot_id = $2 AND owner_id = $3')
        await statement.execute({params: [data.get('show_linked_server') == 'on', params.bot_id, guildedData.user.id]})
      } finally {
        await connection.close()
      }
      break

    case 'set_vanity_code':
      const vanityCode = data.get('vanity_code')
      if (!/^[\w-]{1,100}$/.test(vanityCode)) {
        return {
          error: true,
          message: 'Invalid vanity code.',
        }
      } else if (/(guilded|guiided|gullded|gulided|authlink|official|verified)/gi.test(vanityCode.toLowerCase())) {
        return {
          error: true,
          message: 'Vanity code includes a forbidden word or phrase. If you have a legitimate use case for this phrase, please bring up this issue in guilded.gg/authlink.',
        }
      }
      const vanityRedirectUri = data.get('redirect_uri')
      if (!vanityRedirectUri) {
        return {
          error: true,
          message: 'Must provide a redirect URI.',
        }
      } else if (vanityRedirectUri.length > 2000) {
        return {
          error: true,
          message: 'Cannot save a redirect URI over 2,000 characters.',
        }
      } else if (!uriRegex.test(vanityRedirectUri)) {
        return {
          error: true,
          message: `"${vanityRedirectUri}" is not a valid URI.`,
        }
      }

      connection = await pool.acquire()
      try {
        // Make sure the current user owns the application
        const checkOwnerStatement = await connection.prepare(
          `
          SELECT redirect_uris
          FROM applications
          WHERE bot_id = $1
          AND owner_id = $2
          `
        )
        const checkOwnerResult = await checkOwnerStatement.execute({params: [params.bot_id, guildedData.user.id]})
        if (checkOwnerResult.rows.length === 0) {
          return {
            error: true,
            message: 'You do not own an application with that ID, or it does not exist.',
          }
        }
        const validRedirectUris = checkOwnerResult.rows[0][0]
        if (!validRedirectUris.includes(vanityRedirectUri)) {
          return {
            error: true,
            message: 'Provided redirect URI is not an existing saved URI.',
          }
        }

        // Make sure the code isn't already in use
        const existStatement = await connection.prepare(`SELECT client_id FROM vanity_codes WHERE code = $1`)
        const existResult = await existStatement.execute({params: [vanityCode]})
        if (existResult.rows.length > 0 && existResult.rows[0][0] !== params.bot_id) {
          return {
            error: true,
            message: 'This vanity code is already in use by a different application.',
          }
        }

        // Modify the vanity
        const statement = await connection.prepare(
          `
          INSERT INTO vanity_codes
          (client_id, code, scopes, redirect_uri, prompt, disabled_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (client_id)
          DO UPDATE SET
            code = $2,
            scopes = $3,
            redirect_uri = $4,
            prompt = $5,
            disabled_at = $6
          WHERE
            vanity_codes.client_id = $1
          `
        )
        await statement.execute({params: [
          params.bot_id,
          vanityCode,
          JSON.stringify(data.getAll('scope') ?? []),
          vanityRedirectUri,
          data.get('prompt'),
          null,
        ]})
      } finally {
        await connection.close()
      }
      break

    case 'delete':
      connection = await pool.acquire()
      try {
        const appStatement = await connection.prepare('DELETE FROM applications WHERE bot_id = $1 AND owner_id = $2')
        const result = await appStatement.execute({params: [params.bot_id, guildedData.user.id]})
        if (result.rowsAffected > 0) {
          const authStatement = await connection.prepare('DELETE FROM authorizations WHERE client_id = $1')
          await authStatement.execute({params: [params.bot_id]})
        }
      } finally {
        await connection.close()
      }
      return redirect('/dev/apps')

    default:
      break
  }
  return null
}

function generateSecret(client_id) {
  return randomString(32)
}

const uriRegex = /^((?:\w{1,32}):\/\/[^\s<]+[^<.,:;"'\]\s])$/

export default function DevApps() {
  // Profile context menu
  const [open, setOpen] = useState(false)
  const {x, y, reference, floating, strategy, context} = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'left-start',
    middleware: [shift()],
  })
  const {getReferenceProps, getFloatingProps} = useInteractions([useClick(context)])

  const loaderData = useLoaderData()
  const actionData = useActionData() ?? {}
  const submit = useSubmit()
  const transition = useTransition()
  const app = loaderData.application

  const iconUrl = app.icon_hash
    ? `https://img.guildedcdn.com/UserAvatar/${app.icon_hash}-Small.webp`
    : 'https://img.guildedcdn.com/asset/Default/Gil-sm.png'

  const [error, setError] = useState(null)
  const [uris, setDraftingURIs] = useState(actionData.redirect_uris ?? app.redirect_uris)
  const draftingURIs = [...uris]
  const [showDeletePrompt, setDeletePrompt] = useState(false)

  return (
    <div className='w-full'>
      <ErrorBlock>{actionData.error ? actionData.message : error}</ErrorBlock>
      {showDeletePrompt && (
        <div className='mb-4 bg-[#3e3f4a] p-3 rounded border border-white/10 w-full'>
          <h1 className='font-bold text-2xl text-red-400'>HOLD IT!</h1>
          <p>Are you sure you want to delete <span className='font-bold'>{app.name}</span> and its {app.authorization_count.toLocaleString()} active authorization{app.authorization_count === 1 ? '' : 's'}?</p>
          <div className='mt-2'>
            <Button stylename='danger' onClick={() => {submit({ _action: 'delete' }, { method: 'post' })}}>Destroy it!</Button>
            <button className='ml-4 text-guilded-subtitle font-bold hover:text-white transition-colors' onClick={() => {setDeletePrompt(false)}}>Actually, no thanks</button>
          </div>
        </div>
      )}
      <h1 className='font-bold text-2xl flex' id='title'>
        <img src={iconUrl} className='rounded-full mr-3 h-10'/>
        <span className='my-auto'>{app.name}</span>
        <button
          className='ml-auto text-2xl hover:text-gray-400 transition-colors'
          {...getReferenceProps({ref: reference})}
        >
          <i className='ci-more_vertical'/>
        </button>
      </h1>
      {open && (
        <div
          {...getFloatingProps({
            ref: floating,
            style: {
              position: strategy,
              top: y ?? '',
              left: x ?? '',
            },
          })}
        >
        <PopoutSelectables
          items={[
            {
              icon: <i className='ci-refresh_02' />,
              label: 'Refresh profile',
              callback: async () => {
                setOpen(false)
                setError(null)

                const attempt = await tryBot({bot_id: app.bot_id})
                if (!attempt.bot) {
                  setError('Bot does not exist or it is not published.')
                  return
                } else if (attempt.bot.createdBy && attempt.bot.createdBy != loaderData.user.id) {
                  setError('You do not own this bot.')
                  return
                }

                submit({
                  _action: 'update_profile',
                  method: attempt.method,
                  bot: JSON.stringify({
                    userId: attempt.bot.userId,
                    teamId: attempt.bot.teamId,
                  }),
                }, {
                  method: 'post',
                  replace: true,
                })
              },
            },
            {
              icon: <i className='ci-trash_full' />,
              label: 'Delete application',
              callback: () => {
                setOpen(false)
                setDeletePrompt(true)
              },
            },
          ]}
        />
        </div>
      )}
      <div className='mt-2 w-full'>
        <div className='flex flex-wrap'>
          <div className='mr-4'>
            <p className='text-guilded-subtitle'>Client ID</p>
            <p>{app.bot_id}</p>
          </div>
          <div>
            <p className='text-guilded-subtitle'>Client Secret</p>
            {actionData.secret && <p className='mb-2'>{actionData.secret}</p>}
            <Button
              onClick={() => {
                submit({_action: 'reset_client_secret'}, {method: 'post', replace: true})
              }}
            >Reset
            </Button>
          </div>
        </div>
        <div className='mt-4'>
          <p className='text-guilded-subtitle'>Redirect URIs</p>
          <p>You can have up to 10 redirect URIs. Any valid URI under 2,000 characters is accepted.</p>
          {uris.map((uri, index) => (
            <div className='w-full mt-2 flex' key={`uri-${uri}-${index}`}>
              <input
                className='p-2 w-full rounded bg-guilded-slate border valid:border-green-400/70 invalid:border-rose-400/70 transition-colors'
                defaultValue={uri}
                pattern={uriRegex.source}
                maxLength={2000}
                placeholder='https://example.com/callback'
                onChange={(event) => {
                  // Update draft cache with the new value
                  draftingURIs.splice(index, 1, event.target.value)
                }}
              />
              <button onClick={() => {
                draftingURIs.splice(index, 1)
                setDraftingURIs(draftingURIs)
              }}>
                <i className='ci-trash_full text-2xl border border-white/10 hover:border-rose-400/70 ml-3 rounded bg-guilded-slate p-2 h-full transition-colors'/>
              </button>
            </div>
          ))}
          <Button
            className='mt-2'
            disabled={uris.length >= 10}
            onClick={() => {
              if (uris.length >= 10) {
                setError('Cannot exceed maximum number of redirect URIs (10).')
                return
              }
              setError(null)
              draftingURIs.push('')
              setDraftingURIs(draftingURIs)
            }}
          >New URI
          </Button>
          <Button
            disabled={draftingURIs === app.redirect_uris}
            className='ml-3'
            onClick={() => {
              const data = new FormData()
              data.append('_action', 'set_redirect_uris')
              for (const uri of draftingURIs) {data.append('redirect_uri', uri)}
              submit(data, {method: 'post', replace: true})
              setDraftingURIs(draftingURIs)
            }}
          >
            {
              transition.submission && transition.submission.formData.get('_action') === 'set_redirect_uris'
              ? transition.state === 'submitting'
                ? 'Saving...'
                : transition.state === 'loading'
                  ? 'Saved'
                  : 'Save'
              : 'Save'
            }
          </Button>
        </div>
        <div>
          <hr className='border border-guilded-slate mt-6 mb-4' />
          <h2 className='font-bold text-2xl'>Authorization</h2>
          <Form
            onChange={(e) => {
              submit(e.currentTarget, { method: 'patch', replace: true })
            }}
          >
            <div className='text-xl mt-2'>
              <label className='flex'>
                <input name='_action' value='update_linked_server' readOnly hidden/>
                <input
                  name='show_linked_server'
                  type='checkbox'
                  defaultChecked={app.show_linked_server === null ? true : app.show_linked_server}
                  className='mr-2 my-auto'
                />
                Show support server
              </label>
            </div>
            <p className='text-guilded-subtitle'>
              Your bot's internal server shows up on your application's authorization page.
              If it is not an appropriate place for your users to contact you about your application,
              you can hide it by disabling the above tickbox.
            </p>
          </Form>
          <Form method='post' replace={true}>
            <input name='_action' value='set_vanity_code' readOnly hidden />
            <h2 className='text-xl mt-4'>Vanity code</h2>
            <p className='text-guilded-subtitle'>
              A custom string to easily share your authorization page with your users,
              available at authlink.guildedapi.com/a/{'<code>'}.
              Must be at most 100 characters and contain only letters, numbers, hyphens, and underscores.
            </p>
            <div className='flex flex-wrap'>
              <div className='mt-2 mr-6'>
                <label>
                  Code
                  <input
                    name='vanity_code'
                    className='p-2 w-full rounded bg-guilded-slate border valid:border-green-400/70 invalid:border-rose-400/70 transition-colors'
                    defaultValue={loaderData.vanity.code ?? ''}
                    maxLength={100}
                    pattern='^[\w-]{1,100}$'
                    required
                  />
                </label>
              </div>
              <div className='mt-2 mr-6'>
                <p>Scopes</p>
                <label>
                  <input name='scope' type='checkbox' value='identify' defaultChecked={(loaderData.vanity.scopes ?? []).includes('identify')} /> identify
                </label>
                <br/>
                <label>
                  <input name='scope' type='checkbox' value='servers' defaultChecked={(loaderData.vanity.scopes ?? []).includes('servers')} /> servers
                </label>
                <br/>
                <label>
                  <input name='scope' type='checkbox' value='servers.members.read' defaultChecked={(loaderData.vanity.scopes ?? []).includes('servers.members.read')} /> servers.members.read
                </label>
              </div>
              <div className='mt-2 mr-6'>
                <p>Prompt</p>
                <label>
                  <input name='prompt' type='radio' value='consent' defaultChecked={loaderData.vanity.prompt === 'consent'} /> consent
                </label>
                <br/>
                <label>
                  <input name='prompt' type='radio' value='none' defaultChecked={loaderData.vanity.prompt === 'none'} /> none
                </label>
              </div>
              <div className='mt-2 mr-6'>
                <p>Redirect URI</p>
                <select
                  name='redirect_uri'
                  className='p-2 w-full rounded bg-guilded-slate'
                  defaultValue={loaderData.vanity.redirect_uri ?? 'null'}
                  required
                >
                  <option
                    value='null'
                    disabled
                  >
                    Select a redirect URI
                  </option>
                  {uris.map((uri, index) => {
                    return (
                      <option
                        key={`vanity-uri-${uri}-${index}`}
                        value={uri}
                      >
                        {uri}
                      </option>
                    )
                  })}
                </select>
              </div>
            </div>
            <Button
              className='mt-4'
            >
              {
                transition.submission && transition.submission.formData.get('_action') === 'set_vanity_code'
                ? transition.state === 'submitting'
                  ? 'Saving...'
                  : transition.state === 'loading'
                    ? 'Saved'
                    : 'Save'
                : 'Save'
              }
            </Button>
          </Form>
        </div>
      </div>
    </div>
  )
}
