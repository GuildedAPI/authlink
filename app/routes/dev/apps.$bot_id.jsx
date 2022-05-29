import { Form, Link, useActionData, useLoaderData, useSubmit, useTransition } from '@remix-run/react'
import { json, redirect } from '@remix-run/server-runtime'

import { useState } from 'react'
import { useFloating, shift, useInteractions, useClick } from '@floating-ui/react-dom-interactions'

import pool from '~/psql.server'
import { boilerplateLoader } from '~/sessions.server'
import { randomString } from '~/common/random'
import { tryBot, getBotWithMethod } from '~/common/bots'

import { Button, ErrorBlock, PopoutSelectables, CopyArea } from '~/common/components'

export async function loader({ request, params }) {
    const guildedData = await boilerplateLoader({request})

    const connection = await pool.acquire()
    let result = null
    let authorizationCount = 0
    try {
        const statement = await connection.prepare('SELECT * FROM applications WHERE bot_id = $1 AND owner_id = $2')
        result = await statement.execute({params: [params.bot_id, guildedData.user.id]})
        if (result.rows.length < 1) {
            throw json({message: 'You do not own an application with that ID, or it does not exist.'}, {status: 404})
        }
        const authStatement = await connection.prepare('SELECT COUNT(*) FROM authorizations WHERE client_id = $1')
        const authResult = await authStatement.execute({params: [params.bot_id]})
        if (authResult.rows.length > 0) {
            authorizationCount = authResult.rows[0][0]
        }
    } finally {
        await connection.close()
    }

    const row = result.rows[0]
    const application = {
        bot_id: row[0],
        redirect_uris: row[2] || [],
        name: row[4],
        icon_hash: row[5],
        user_id: row[6],
        team_id: row[7],
        show_linked_server: row[11],
        authorization_count: authorizationCount,
    }

    return {
        user: guildedData.user,
        application,
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
    const actionData = useActionData() || {}
    const submit = useSubmit()
    const transition = useTransition()
    const app = loaderData.application

    let iconUrl = 'https://img.guildedcdn.com/asset/Default/Gil-sm.png'
    if (app.icon_hash) {
        iconUrl = `https://img.guildedcdn.com/UserAvatar/${app.icon_hash}-Small.webp`
    }

    const [error, setError] = useState(null)
    const [uris, setDraftingURIs] = useState(actionData.redirect_uris ?? app.redirect_uris)
    const draftingURIs = [...uris]
    const [showDeletePrompt, setDeletePrompt] = useState(false)
    const authState = {
        scopes: [],
        prompt: 'consent',
        redirectUri: null,
    }

    function updateSelectedScopes(event) {
        if (event.target.checked) {
            authState.scopes.push(event.target.value)
        } else {
            authState.scopes.splice(authState.scopes.indexOf(event.target.value), 1)
        }
        document.getElementById('generated-url').value = generateUrl()
    }

    function updateSelectedPrompt(event) {
        authState.prompt = event.target.value
        document.getElementById('generated-url').value = generateUrl()
    }

    function generateUrl() {
        if (!authState.redirectUri) return 'Please select a redirect URI'
        else if (authState.scopes.length === 0) return 'Please select at least one scope'

        const authURL = new URL('https://authlink.guildedapi.com/auth')
        authURL.searchParams.append('client_id', app.bot_id)
        if (authState.scopes.length > 0) authURL.searchParams.append('scope', authState.scopes.join(' '))
        if (authState.redirectUri) authURL.searchParams.append('redirect_uri', authState.redirectUri)
        if (authState.prompt != 'consent') authURL.searchParams.append('prompt', authState.prompt)
        return String(authURL)
    }
    const authURL = generateUrl()

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
                <div className='mt-4'>
                    <p className='font-bold text-xl'>Authorization Page</p>
                    <p className='text-lg'>Support Server</p>
                    <p className='text-guilded-subtitle text-sm'>
                        This server--your bot's internal server--shows up on your application's authorization page.
                        If it is not an appropriate place for your users to contact you about your application, you can hide it below.
                    </p>
                    <Form
                        onChange={(e) => {
                            submit(e.currentTarget, { method: 'post', replace: true })
                        }}
                    >
                        <input
                            name='_action'
                            value='update_linked_server'
                            readOnly
                            hidden
                        />
                        <label>
                            <input
                                name='show_linked_server'
                                type='checkbox'
                                defaultChecked={app.show_linked_server === null ? true : app.show_linked_server}
                            />
                            {' '}Show linked server
                        </label>
                    </Form>
                    <p className='text-lg mt-4'>Link Generator</p>
                    <p><Link to='/dev/docs#authorization' className='text-guilded-link'>Read more about authorization URLs</Link></p>
                    <h5 className='mt-2 text-guilded-subtitle'>Scopes</h5>
                    <label>
                        <input
                            name='scope'
                            value='identify'
                            type='checkbox'
                            onChange={updateSelectedScopes}
                        /> identify
                    </label>
                    <br/>
                    <label>
                        <input
                            name='scope'
                            value='servers'
                            type='checkbox'
                            onChange={updateSelectedScopes}
                        /> servers
                    </label>
                    <br/>
                    <label>
                        <input
                            name='scope'
                            value='servers.members.read'
                            type='checkbox'
                            onChange={updateSelectedScopes}
                        /> servers.members.read
                    </label>
                    <h5 className='mt-2 text-guilded-subtitle'>Prompt</h5>
                    <label>
                        <input
                            name='prompt'
                            value='consent'
                            type='radio'
                            onChange={updateSelectedPrompt}
                        /> consent (default)
                    </label>
                    <br/>
                    <label>
                        <input
                            name='prompt'
                            value='none'
                            type='radio'
                            onChange={updateSelectedPrompt}
                        /> none
                    </label>
                    <h5 className='mt-2 text-guilded-subtitle'>Redirect URI</h5>
                    <select
                        className='rounded p-2 bg-guilded-slate border border-white/10'
                        defaultValue='null'
                        onChange={(event) => {
                            authState.redirectUri = event.target.selectedOptions[0].value
                            document.getElementById('generated-url').value = generateUrl()
                        }}
                    >
                        <option value='null' disabled>Select a URI</option>
                        {app.redirect_uris.map((uri, index) => (
                            <option key={`link-uri-${uri}-${index}`} value={uri}>
                                {uri}
                            </option>
                        ))}
                    </select>
                    <h5 className='mt-2 text-guilded-subtitle'>Link</h5>
                    <CopyArea value={authURL} id='generated-url' />
                </div>
            </div>
        </div>
    )
}
