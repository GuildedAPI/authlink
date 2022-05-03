import { Link, useActionData, useLoaderData, useSubmit } from '@remix-run/react'

import pool from '~/psql.server'
import { boilerplateLoader } from '~/sessions.server'

import { search, getTeamMembers } from '~/common/guilded'
import { tryBot, getBotWithMethod } from '~/common/bots'
import { Button, ErrorBlock } from '~/common/components'
import { useState } from 'react'

export async function loader({ request }) {
    const guildedData = await boilerplateLoader({request})

    const connection = await pool.acquire()
    let result = null
    try {
        const statement = await connection.prepare('SELECT * FROM applications WHERE owner_id = $1')
        result = await statement.execute({params: [guildedData.user.id]})
    } finally {
        await connection.close()
    }

    const applications = result.rows.map(row => ({
        bot_id: row[0],
        name: row[4],
        icon_hash: row[5],
    }))

    return {
        user: guildedData.user,
        applications,
    }
}

export async function action({ request }) {
    const guildedData = await boilerplateLoader({request})
    const data = await request.formData()

    if (data.get('_action') === 'create_prompt') {return {_action: 'create_prompt'}}
    else if (data.get('_action') === 'create') {
        const attempt = await getBotWithMethod(data.get('method'), JSON.parse(data.get('bot')))
        if (attempt.error) {
            return attempt
        }
        const bot = attempt.bot
        if (bot.createdBy && bot.createdBy != guildedData.user.id) {
            return {
                error: true,
                message: 'Cannot create an application using a bot not owned by you.',
            }
        }

        const connection = await pool.acquire()
        try {
            const getStatement = await connection.prepare('SELECT name FROM applications WHERE bot_id = $1')
            const getResult = await getStatement.execute({params: [bot.id]})
            if (getResult.rows.length > 0) {
                return {
                    error: true,
                    message: 'An application linked to this bot already exists.',
                }
            }

            const insStatement = await connection.prepare(`
                INSERT INTO applications
                (bot_id, owner_id, name, created_at, bot_created_at, icon_hash, user_id, team_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `)
            await insStatement.execute({params: [
                bot.id, guildedData.user.id, bot.name, new Date().toISOString(), bot.createdAt, bot.iconHash, bot.userId, bot.teamId
            ]})
        } finally {
            await connection.close()
        }
    }
    return null
}

const searchCache = {}

async function searchTeams(query) {
    const data = await search(query, 'team', 10)
    return data.results.teams
}

export default function Applications() {
    const [errorMsg, setErrorMsg] = useState(null)
    const [strategy, setStrategy] = useState(null)
    const [searchState, setSearchState] = useState([])
    const [selectedTeam, setSelectedTeam] = useState(null)

    const loaderData = useLoaderData()
    const actionData = useActionData() || {}
    const submit = useSubmit()

    return (
        <div className='w-full'>
            <ErrorBlock>{actionData.error ? actionData.message : errorMsg}</ErrorBlock>
            <div className='flex'>
                <h1 className='font-bold text-2xl'>Your Applications</h1>
                {actionData._action != 'create_prompt' && (
                    <Button
                        className='ml-auto'
                        onClick={() => {
                            submit({_action: 'create_prompt'}, {method: 'post', replace: true})
                        }}
                    >New</Button>
                )}
            </div>
            {actionData._action === 'create_prompt' && (
                <div className='mt-2 bg-[#3e3f4a] p-3 rounded border border-white/10 w-full'>
                    {strategy && (
                        <button
                            className='flex text-guilded-subtitle text-sm hover:text-white transition-colors'
                            onClick={() => {setStrategy(null)}}
                        >
                            <i className='ci-chevron_big_left mr-2 my-auto' />
                            <p>Go Back</p>
                        </button>
                    )}
                    <h1 className='font-bold text-lg'>New Application</h1>
                    <p>
                        Applications are created by linking them to bots created inside the Guilded interface (Server settings <i className='ci-long_right' /> Bots).
                    </p>
                    {strategy === 'id' ? (
                        <label className='text-guilded-subtitle'>
                            Bot ID
                            <div className='flex'>
                                <input
                                    id='bot-id'
                                    type='text'
                                    pattern='\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b'
                                    placeholder='62ca5dc8-4de1-4209-a770-2bf88e4433a0'
                                    className='w-full mr-2 py-1 px-2 rounded bg-[#32343d] text-white'
                                />
                                <Button
                                    onClick={async () => {
                                        setErrorMsg(null)

                                        const attempt = await tryBot({bot_id: document.getElementById('bot-id').value})
                                        if (!attempt.bot) {
                                            setErrorMsg('Bot does not exist or it is not published.')
                                            return
                                        } else if (attempt.bot.createdBy && attempt.bot.createdBy != loaderData.user.id) {
                                            setErrorMsg('You do not own this bot.')
                                            return
                                        }
                                        submit({
                                            _action: 'create',
                                            method: attempt.method,
                                            bot: JSON.stringify({
                                                id: attempt.bot.id,
                                                userId: attempt.bot.userId,
                                                teamId: attempt.bot.teamId,
                                            }),
                                        }, {
                                            method: 'post',
                                            replace: true,
                                        })
                                    }}
                                >
                                    Submit
                                </Button>
                            </div>
                        </label>
                    ) : strategy === 'team' ? (
                        <>
                        <label className='text-guilded-subtitle'>
                            Search for a server
                            <div className='flex'>
                                <input
                                    id='team-id'
                                    type='text'
                                    placeholder={`${loaderData.user.name}'s cool server`}
                                    className='w-full py-1 px-2 rounded bg-[#32343d] text-white'
                                    onChange={async (event) => {
                                        const query = event.target.value
                                        if (!query) {
                                            setSearchState([])
                                            return
                                        }
                                        let results = searchCache[query]
                                        if (!results) {
                                            results = await searchTeams(query)
                                            searchCache[query] = results
                                        }
                                        setSearchState(results)
                                    }}
                                />
                            </div>
                        </label>
                        {searchState.length > 0 && (
                            <p className='text-guilded-subtitle mt-2 -mb-2'>Public servers</p>
                        )}
                        {searchState.map((team) => {
                            // TODO: Default letter icons
                            let iconUrl = 'https://img.guildedcdn.com/asset/Default/Gil-sm.png'
                            if (team.profilePicture) {
                                iconUrl = team.profilePicture
                            }
                            return (
                                <div key={team.id}>
                                    <button
                                        className='flex mt-2 bg-[#32343d] hover:bg-[#1f2126] transition-colors rounded w-full p-2'
                                        onClick={async () => {
                                            setErrorMsg(null)
                                            if (!team.bots) {
                                                const data = await getTeamMembers(team.id)
                                                team.bots = data.bots.filter(bot => (
                                                    bot.enabled
                                                    && !loaderData.applications.map(app => app.bot_id).includes(bot.id)
                                                ))
                                                // Unfortunately Guilded doesn't return the bot creator in the above endpoint
                                                // so we have to check membership role instead, for a guess equating to
                                                // "this user is _probably_ allowed to manage bots"
                                                team.members = data.members
                                                team.currentUser = team.members.filter(member => member.id === loaderData.user.id)[0]
                                            }
                                            if (!team.currentUser || team.currentUser.membershipRole != 'admin') {
                                                setSelectedTeam(null)
                                                setErrorMsg('You must have "admin" status in this server to select a bot from it.')
                                                return
                                            } else if (team.bots.length === 0) {
                                                setSelectedTeam(null)
                                                setErrorMsg('This server has no available bots.')
                                                return
                                            }
                                            setSelectedTeam(team.id)
                                        }}
                                    >
                                        <img src={iconUrl} className='rounded-md mr-2 h-8' />
                                        <span className='my-auto'>{team.name}</span>
                                    </button>
                                    {selectedTeam === team.id && (
                                        <>
                                        {(team.bots || []).map((bot) => {
                                            let iconUrl = 'https://img.guildedcdn.com/asset/Default/Gil-sm.png'
                                            if (bot.iconUrl) {
                                                iconUrl = bot.iconUrl
                                            }
                                            return (
                                                <div className='flex'>
                                                {/* TODO: make this the bot svg */}
                                                <i className='ci-sub_right text-[2rem] text-[#32343d] mx-1 my-auto' />
                                                <button
                                                    key={bot.id}
                                                    className='flex mt-2 bg-[#32343d] hover:bg-[#1f2126] transition-colors rounded w-full p-2'
                                                    onClick={() => {
                                                        setErrorMsg(null)
                                                        submit({
                                                            _action: 'create',
                                                            method: !bot.internalBotId ? 2 : 1,
                                                            bot: JSON.stringify({
                                                                id: bot.internalBotId || bot.id,
                                                                userId: bot.userId,
                                                                teamId: bot.teamId,
                                                            }),
                                                        }, {
                                                            method: 'post',
                                                            replace: true,
                                                        })
                                                    }}
                                                >
                                                    <img src={iconUrl} className='rounded-full mr-2 h-8' />
                                                    <span className='my-auto'>{bot.name}</span>
                                                </button>
                                                </div>
                                            )
                                        })}
                                        </>
                                    )}
                                </div>
                            )
                        })}
                        </>
                    ) : (
                        <>
                            <button
                                className='w-full mt-2 mr-2 px-2 py-1 rounded bg-[#32343d] flex text-white hover:translate-x-1 transition-transform'
                                onClick={() => {setStrategy('id')}}
                            >
                                <img src='/images/external_bot.svg' className='w-6 my-auto mr-2' />
                                <span className='my-auto'>Input a bot ID directly</span>
                                <i className='ci-chevron_big_right ml-auto text-xl' />
                            </button>
                            <button
                                className='w-full mt-2 mr-2 px-2 py-1 rounded bg-[#32343d] flex text-white hover:translate-x-1 transition-transform'
                                onClick={() => {setStrategy('team')}}
                            >
                                <img src='/images/team_filled.svg' className='w-6 my-auto mr-2' />
                                <span className='my-auto'>Find a server and select one of its bots</span>
                                <i className='ci-chevron_big_right ml-auto text-xl' />
                            </button>
                        </>
                    )}
                </div>
            )}
            <div className='mt-2'>
                {loaderData.applications.map((app) => {
                    let iconUrl = 'https://img.guildedcdn.com/asset/Default/Gil-sm.png'
                    if (app.icon_hash) {
                        iconUrl = `https://img.guildedcdn.com/UserAvatar/${app.icon_hash}-Small.png`
                    }
                    return (
                        <Link to={`/dev/apps/${app.bot_id}`} key={app.bot_id}>
                            <div className='bg-[#3e3f4a] hover:bg-white/10 transition-colors rounded p-3 mb-2 border border-white/10 w-full flex'>
                                <img
                                    src={iconUrl}
                                    className='rounded-full mr-2 h-8'
                                />
                                <span className='my-auto'>{app.name}</span>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
