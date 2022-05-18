import { useActionData, useLoaderData, useSubmit } from '@remix-run/react'
import { redirect } from '@remix-run/server-runtime'

import pool from '~/psql.server'
import { boilerplateLoader, getSession, destroySession } from '~/sessions.server'

import { useState } from 'react'
import { useFloating, shift, useInteractions, useClick } from '@floating-ui/react-dom-interactions'

import { scopeNames } from '~/routes/auth'
import { Button, ErrorBlock, PopoutSelectables } from '~/common/components'
import { cloneFormData } from '~/common/utilities'
import images from '~/common/images'

export async function loader({ request }) {
    const guildedData = await boilerplateLoader({request})

    const connection = await pool.acquire()
    let authResult = null
    let appResult = null
    try {
        const authStatement = await connection.prepare('SELECT * FROM authorizations WHERE user_id = $1')
        authResult = await authStatement.execute({params: [guildedData.user.id]})
        clientIds = []
        for (const row of authResult.rows) {
            if (!clientIds.includes(row[1])) {
                clientIds.push(row[1])
            }
        }
        if (clientIds.length > 0) {
            const appStatement = await connection.prepare('SELECT * FROM applications WHERE bot_id = ANY($1::text[])')
            appResult = await appStatement.execute({params: [`{${clientIds.join(',')}}`]})
        }
    } finally {
        await connection.close()
    }

    const scopesByAppId = {}
    authResult.rows.forEach((row) => {
        const scopes = scopesByAppId[row[1]] = scopesByAppId[row[1]] || []
        row[3].forEach(scope => {if (!scopes.includes(scope)) scopes.push(scope)})
    })

    const applications = !appResult ? [] : appResult.rows.map(row => ({
        bot_id: row[0],
        name: row[4],
        icon_hash: row[5],
        team_id: row[7],
        scopes: scopesByAppId[row[0]],
    }))

    return {
        user: guildedData.user,
        applications,
    }
}

export async function action({ request }) {
    const data = await request.formData()

    if (data.get('_action') === 'prompt_deauthorize') {
        return cloneFormData(data)
    } else if (data.get('_action') === 'deauthorize') {
        const guildedData = await boilerplateLoader({request})
        const connection = await pool.acquire()
        try {
            const getStatement = await connection.prepare('DELETE FROM authorizations WHERE client_id = $1 AND user_id = $2')
            await getStatement.execute({params: [data.get('id'), guildedData.user.id]})
        } finally {
            await connection.close()
        }
    } else if (data.get('_action') === 'logout') {
        const session = await getSession(request.headers.get('Cookie'))
        return redirect('/', {
            headers: {
                'Set-Cookie': await destroySession(session),
            }
        })
    }
    return null
}

export default function Me() {
    const loaderData = useLoaderData()
    const actionData = useActionData() || {}
    const submit = useSubmit()

    // Applications' context menus
    const [open, setOpen] = useState(false)
    const {x, y, reference, floating, strategy, context} = useFloating({
        open,
        onOpenChange: setOpen,
        placement: 'left-start',
        middleware: [shift()],
    })
    const {getReferenceProps, getFloatingProps} = useInteractions([useClick(context)])

    const user = loaderData.user
    let profilePicture = 'https://img.guildedcdn.com/asset/DefaultUserAvatars/profile_1.png'
    if (user.profilePicture) {
        profilePicture = user.profilePicture.replace('Large', 'Small')
    }

    return (
        <div className='w-full'>
            <ErrorBlock>{actionData.error && actionData.message}</ErrorBlock>
            <h1 className='font-bold text-2xl'>You!</h1>
            <div className='mt-2 bg-[#3e3f4a] p-3 rounded border border-white/10 w-full flex'>
                <img
                    src={profilePicture}
                    className='rounded-full mr-3 shadow h-10'
                />
                <h1 className='font-bold text-lg my-auto'>{user.name}</h1>
                <button
                    className='ml-auto text-2xl hover:text-gray-400 transition-colors'
                    {...getReferenceProps({ref: reference})}
                >
                    <i className='ci-more_vertical'/>
                </button>
            </div>
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
                            icon: <i className='ci-external_link' />,
                            label: 'Your profile',
                            link: {to: `https://www.guilded.gg/profile/${user.id}`, external: true},
                        },
                        {
                            icon: <i className='ci-refresh_02' />,
                            label: 'Swap users',
                            link: {to: '/start'},
                        },
                        {
                            separator: true,
                        },
                        {
                            icon: <i className='ci-home_minus' />,
                            label: 'Log out',
                            callback: (event) => {
                                event.currentTarget.parentNode.classList.add('hidden')
                                submit({_action: 'logout'}, {method: 'post', replace: true})
                            },
                        },
                    ]}
                />
                </div>
            )}
            <h1 className='font-bold text-2xl mt-4'>Authorized Apps</h1>
            {loaderData.applications.length === 0
                ? <div className='select-none text-center'>
                    <img className='max-h-56 mx-auto' src={images.nothing_here} />
                    <p className='font-bold mt-2'>You haven't authorized any applications</p>
                    <a className='text-guilded-subtitle mt-1 hover:underline' target='_blank' href='https://www.youtube.com/watch?v=NAdQyjpOfrs'>If I can't connect apps to my account, then what's this all been about?</a>
                  </div>
                : (loaderData.applications.map((app) => {
                    let iconUrl = 'https://img.guildedcdn.com/asset/Default/Gil-sm.png'
                    if (app.icon_hash) {
                        iconUrl = `https://img.guildedcdn.com/UserAvatar/${app.icon_hash}-Small.webp`
                    }

                    return (
                        <div key={app.bot_id} className='mt-2 bg-[#3e3f4a] p-3 rounded border border-white/10 w-full group'>
                            <div className='flex'>
                                <img
                                    src={iconUrl}
                                    className='rounded-full mr-3 shadow h-10'
                                />
                                <h1 className='font-bold text-lg my-auto'>
                                    {app.name}
                                </h1>
                                {(actionData._action === 'prompt_deauthorize' && actionData.id === app.bot_id) ? (
                                    <>
                                    <Button
                                        stylename='danger'
                                        className='ml-auto my-auto h-full'
                                        onClick={() => {
                                            submit({
                                                _action: 'deauthorize',
                                                id: app.bot_id,
                                            }, {
                                                method: 'post',
                                                replace: true,
                                            })
                                        }}
                                    >Yes, deauthorize this app
                                    </Button>
                                    <button
                                        className='ml-3 my-auto font-bold text-guilded-subtitle hover:text-white'
                                        onClick={() => {
                                            submit(null, {
                                                method: 'get',
                                                replace: true,
                                            })
                                        }}
                                    >Nevermind
                                    </button>
                                    </>
                                ) : (
                                    <Button
                                        stylename='danger'
                                        className='ml-auto my-auto h-full opacity-0 group-hover:opacity-100 transition-all'
                                        onClick={() => {
                                            submit({
                                                _action: 'prompt_deauthorize',
                                                id: app.bot_id,
                                            }, {
                                                method: 'post',
                                                replace: true,
                                            })
                                        }}
                                    >Remove
                                    </Button>
                                )}
                            </div>
                            <p className='mt-2 font-bold text-guilded-subtitle'>This application can see:</p>
                            <ul>
                                {app.scopes.map(scope => (
                                    <li key={scope} className='flex'>
                                        <i className='ci-circle_check_outline text-2xl text-guilded-subtitle mr-2'/>{' '}
                                        <p className='my-auto'>{scopeNames[scope]}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )
                }))
            }
        </div>
    )
}
