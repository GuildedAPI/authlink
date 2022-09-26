import { Link, useActionData, useLoaderData, useSubmit } from '@remix-run/react'

import pool from '~/psql.server'
import { boilerplateLoader } from '~/sessions.server'

import { search, getTeamMembers } from '~/common/guilded'
import { tryBot, getBotWithMethod } from '~/common/bots'
import { Button, ErrorBlock } from '~/common/components'
import { useState } from 'react'

const defaultBotNames = ['XP Bot', 'Howdy Bot', 'Twitch Bot', 'Patreon Bot', 'YouTube Bot']

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

  if (data.get('_action') === 'create') {
    const attempt = await getBotWithMethod(data.get('method'), JSON.parse(data.get('bot')))
    if (attempt.error) {
      return attempt
    }
    const bot = attempt.bot
    if ((bot.iconUrl ?? '').includes('DefaultBotAvatars') || defaultBotNames.includes(bot.name)) {
      // In reality there is no real way to detect this, but this check avoids some weirdness
      return {
        error: true,
        message: 'Cannot create an application using a default bot.',
      }
    }
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

async function searchBots(query) {
  const data = await search(query, 'botAndMeta', 10)
  return data.results.botsAndMetas
}

export default function Applications() {
  const [errorMsg, setErrorMsg] = useState(null)
  const [strategy, setStrategy] = useState(null)
  const [serverSearchState, setServerSearchState] = useState([])
  const [botSearchState, setBotSearchState] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [showCreatePrompt, setCreatePrompt] = useState(false)

  const loaderData = useLoaderData()
  const actionData = useActionData() || {}
  const submit = useSubmit()

  return (
    <div className='w-full'>
      <ErrorBlock>{actionData.error ? actionData.message : errorMsg}</ErrorBlock>
      <div className='flex'>
        <h1 className='font-bold text-2xl'>Your Applications</h1>
        {!showCreatePrompt && (
          <Button
            className='ml-auto'
            onClick={() => {setCreatePrompt(true)}}
          >New</Button>
        )}
      </div>
      {showCreatePrompt && (
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
          <p className='mb-2'>
            Applications are created by linking them to bots created inside the Guilded interface
            (Server settings <i className='ci-long_right' /> Bots).
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
                    setCreatePrompt(false)
                  }}
                >
                  Submit
                </Button>
              </div>
            </label>
          ) : strategy === 'bot-search' ? (
            <>
            <label className='text-guilded-subtitle'>
              Bot name
              <div className='flex'>
                <input
                  id='team-id'
                  type='text'
                  placeholder={`${loaderData.user.name}'s cool bot`}
                  className='w-full py-1 px-2 rounded bg-[#32343d] text-white'
                  onChange={async (event) => {
                    const query = event.target.value
                    if (!query) {
                      setBotSearchState([])
                      return
                    }
                    let results = searchCache[query]
                    if (!results) {
                      results = await searchBots(query)
                      searchCache[query] = results
                    }
                    setBotSearchState(results)
                  }}
                />
              </div>
            </label>
            {botSearchState.filter(botAndMeta => botAndMeta.externalBotMeta && (botAndMeta.externalBotMeta.createdBy === loaderData.user.id)).map(botAndMeta => {
              const bot = botAndMeta.bot
              let iconUrl = 'https://img.guildedcdn.com/asset/Default/Gil-sm.png'
              if (bot.iconUrl) {
                iconUrl = bot.iconUrl
              }

              return (
                <div key={bot.id}>
                  <button
                    className='flex mt-2 bg-[#32343d] hover:bg-[#1f2126] transition-colors rounded w-full p-2'
                    onClick={() => {
                      setErrorMsg(null)
                      submit({
                        _action: 'create',
                        method: 1,
                        bot: JSON.stringify({
                          id: bot.id,
                          userId: bot.userId,
                        }),
                      }, {
                        method: 'post',
                        replace: true,
                      })
                      setCreatePrompt(false)
                    }}
                  >
                    <img src={iconUrl} className='rounded-full mr-2 h-8' />
                    <span className='my-auto'>{bot.name}</span>
                  </button>
                </div>
              )
            })}
            </>
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
                      setServerSearchState([])
                      return
                    }
                    let results = searchCache[query]
                    if (!results) {
                      results = await searchTeams(query)
                      searchCache[query] = results
                    }
                    setServerSearchState(results)
                  }}
                />
              </div>
            </label>
            {serverSearchState.map((team) => {
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
                          !!bot.enabled
                          && !loaderData.applications.map(app => app.bot_id).includes(bot.id)
                          && !(bot.iconUrl ?? '').includes('DefaultBotAvatars')
                          && !defaultBotNames.includes(bot.name)
                          && !bot.internalBotId
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
                        <div className='flex' key={`team-${bot.id}`}>
                          <i className='ci-sub_right text-[2rem] text-[#32343d] mx-1 my-auto' />
                          <button
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
                              setCreatePrompt(false)
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
                className='w-full mt-2 mr-2 px-2 py-1 rounded bg-[#32343d] flex text-white hover:translate-x-1 transition-transform group'
                onClick={() => {setStrategy('id')}}
              >
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='w-5 h-7 my-auto mr-2 fill-guilded-subtitle group-hover:hidden'
                  shapeRendering='geometricPrecision'
                >
                  <defs>
                    <symbol id='bot-icon' viewBox='0 0 800 800'>
                      <path d='M700 275H450v-88.38A100 100 0 0 0 500 100 100 100 0 0 0 400 0a100 100 0 0 0-100 100 100 100 0 0 0 50 86.62V275H100A100 100 0 0 0 0 375v325a100 100 0 0 0 100 100h600a100 100 0 0 0 100-100V375a100 100 0 0 0-100-100ZM300 537.5a87.51 87.51 0 0 1-87.5 87.5 87.51 87.51 0 0 1-87.5-87.5 87.51 87.51 0 0 1 87.5-87.5 87.51 87.51 0 0 1 87.5 87.5Zm375 0a87.51 87.51 0 0 1-87.5 87.5 87.51 87.51 0 0 1-87.5-87.5 87.51 87.51 0 0 1 87.5-87.5 87.51 87.51 0 0 1 87.5 87.5Z' />
                    </symbol>
                  </defs>
                  <use
                    xmlSpace='http://www.w3.org/1999/xlink'
                    xlinkHref='#bot-icon'
                  />
                </svg>
                <svg
                  xmlnsXlink='http://www.w3.org/1999/xlink'
                  xmlns='http://www.w3.org/2000/svg'
                  className='w-5 h-7 my-auto mr-2 fill-guilded-subtitle group-hover:fill-guilded-white hidden group-hover:inline transition-colors'
                  shapeRendering='geometricPrecision'
                >
                  <defs>
                    <symbol id='bot-icon-external' viewBox='0 0 800 800'>
                      <path d='M700 275H450v-62.5a100 100 0 0 0 50-86.62 100 100 0 0 0-100-100 100 100 0 0 0-100 100 100 100 0 0 0 50 86.62V275H100A100 100 0 0 0 0 375v325a100 100 0 0 0 100 100h600a100 100 0 0 0 100-100V375a100 100 0 0 0-100-100ZM300 537.5a87.5 87.5 0 0 1-175 0 87.5 87.5 0 0 1 175 0Zm375 0a87.5 87.5 0 0 1-175 0 87.5 87.5 0 0 1 175 0ZM725 125a324.1 324.1 0 0 1-9.52 78.19A37.6 37.6 0 0 0 751.85 250a37.53 37.53 0 0 0 36.43-28.43 403.72 403.72 0 0 0 0-193.14A37.53 37.53 0 0 0 751.85 0a37.59 37.59 0 0 0-36.37 46.81A324.1 324.1 0 0 1 725 125ZM48.15 250a37.59 37.59 0 0 0 36.37-46.81 325.86 325.86 0 0 1 0-156.38A37.6 37.6 0 0 0 48.15 0a37.53 37.53 0 0 0-36.43 28.43 403.72 403.72 0 0 0 0 193.14A37.52 37.52 0 0 0 48.15 250Z' />
                      <path d='M609.2 200a37.5 37.5 0 0 0 36.94-30.91 253.73 253.73 0 0 0 0-88.18A37.5 37.5 0 0 0 609.2 50a37.53 37.53 0 0 0-36.92 44.18 176 176 0 0 1 0 61.64A37.53 37.53 0 0 0 609.2 200ZM190.8 200a37.53 37.53 0 0 0 36.92-44.18 176 176 0 0 1 0-61.64A37.53 37.53 0 0 0 190.8 50a37.5 37.5 0 0 0-36.94 30.91 253.73 253.73 0 0 0 0 88.18A37.5 37.5 0 0 0 190.8 200Z' />
                    </symbol>
                  </defs>
                  <use
                    xmlSpace='http://www.w3.org/1999/xlink'
                    xlinkHref='#bot-icon-external'
                  />
                </svg>
                <span className='my-auto'>Input a bot ID directly</span>
                <i className='ci-chevron_big_right ml-auto text-xl' />
              </button>
              <button
                className='w-full mt-2 mr-2 px-2 py-1 rounded bg-[#32343d] flex text-white hover:translate-x-1 transition-transform group'
                onClick={() => {setStrategy('bot-search')}}
              >
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='w-5 h-7 my-auto mr-2 fill-guilded-subtitle group-hover:hidden'
                  shapeRendering='geometricPrecision'
                >
                  <defs>
                    <symbol id='bot-icon' viewBox='0 0 800 800'>
                      <path d='M700 275H450v-88.38A100 100 0 0 0 500 100 100 100 0 0 0 400 0a100 100 0 0 0-100 100 100 100 0 0 0 50 86.62V275H100A100 100 0 0 0 0 375v325a100 100 0 0 0 100 100h600a100 100 0 0 0 100-100V375a100 100 0 0 0-100-100ZM300 537.5a87.51 87.51 0 0 1-87.5 87.5 87.51 87.51 0 0 1-87.5-87.5 87.51 87.51 0 0 1 87.5-87.5 87.51 87.51 0 0 1 87.5 87.5Zm375 0a87.51 87.51 0 0 1-87.5 87.5 87.51 87.51 0 0 1-87.5-87.5 87.51 87.51 0 0 1 87.5-87.5 87.51 87.51 0 0 1 87.5 87.5Z' />
                    </symbol>
                  </defs>
                  <use
                    xmlSpace='http://www.w3.org/1999/xlink'
                    xlinkHref='#bot-icon'
                  />
                </svg>
                <svg
                  xmlnsXlink='http://www.w3.org/1999/xlink'
                  xmlns='http://www.w3.org/2000/svg'
                  className='w-5 h-7 my-auto mr-2 fill-guilded-subtitle group-hover:fill-guilded-white hidden group-hover:inline transition-colors'
                  shapeRendering='geometricPrecision'
                >
                  <defs>
                    <symbol id='bot-icon-external' viewBox='0 0 800 800'>
                      <path d='M700 275H450v-62.5a100 100 0 0 0 50-86.62 100 100 0 0 0-100-100 100 100 0 0 0-100 100 100 100 0 0 0 50 86.62V275H100A100 100 0 0 0 0 375v325a100 100 0 0 0 100 100h600a100 100 0 0 0 100-100V375a100 100 0 0 0-100-100ZM300 537.5a87.5 87.5 0 0 1-175 0 87.5 87.5 0 0 1 175 0Zm375 0a87.5 87.5 0 0 1-175 0 87.5 87.5 0 0 1 175 0ZM725 125a324.1 324.1 0 0 1-9.52 78.19A37.6 37.6 0 0 0 751.85 250a37.53 37.53 0 0 0 36.43-28.43 403.72 403.72 0 0 0 0-193.14A37.53 37.53 0 0 0 751.85 0a37.59 37.59 0 0 0-36.37 46.81A324.1 324.1 0 0 1 725 125ZM48.15 250a37.59 37.59 0 0 0 36.37-46.81 325.86 325.86 0 0 1 0-156.38A37.6 37.6 0 0 0 48.15 0a37.53 37.53 0 0 0-36.43 28.43 403.72 403.72 0 0 0 0 193.14A37.52 37.52 0 0 0 48.15 250Z' />
                      <path d='M609.2 200a37.5 37.5 0 0 0 36.94-30.91 253.73 253.73 0 0 0 0-88.18A37.5 37.5 0 0 0 609.2 50a37.53 37.53 0 0 0-36.92 44.18 176 176 0 0 1 0 61.64A37.53 37.53 0 0 0 609.2 200ZM190.8 200a37.53 37.53 0 0 0 36.92-44.18 176 176 0 0 1 0-61.64A37.53 37.53 0 0 0 190.8 50a37.5 37.5 0 0 0-36.94 30.91 253.73 253.73 0 0 0 0 88.18A37.5 37.5 0 0 0 190.8 200Z' />
                    </symbol>
                  </defs>
                  <use
                    xmlSpace='http://www.w3.org/1999/xlink'
                    xlinkHref='#bot-icon-external'
                  />
                </svg>
                <span className='my-auto'>Search for a published bot</span>
                <i className='ci-chevron_big_right ml-auto text-xl' />
              </button>
              <button
                className='w-full mt-2 mr-2 px-2 py-1 rounded bg-[#32343d] flex text-white hover:translate-x-1 transition-transform group'
                onClick={() => {setStrategy('team')}}
              >
                <svg
                  xmlnsXlink='http://www.w3.org/1999/xlink'
                  xmlns='http://www.w3.org/2000/svg'
                  className='w-5 h-7 my-auto mr-2 fill-guilded-subtitle group-hover:hidden'
                  shapeRendering='geometricPrecision'
                >
                  <defs>
                    <symbol id='team-icon-outline' viewBox='0 0 800 800'>
                      <path d='M614.31 220.18a22.46 22.46 0 0 0-17.25-8 22.49 22.49 0 1 0 17.25 8ZM539.88 157.72a22.53 22.53 0 0 0-11.24-3 22.58 22.58 0 0 0-19.5 11.28 22.5 22.5 0 1 0 30.74-8.24ZM448.58 124.49a22.56 22.56 0 0 0-3.92-.34 22.49 22.49 0 1 0 3.92.34ZM355.35 124.15a22.59 22.59 0 0 0-3.93.34 22.52 22.52 0 1 0 3.93-.34ZM271.36 154.71a22.5 22.5 0 1 0 11.26 42 22.51 22.51 0 0 0 8.24-30.71 22.58 22.58 0 0 0-19.5-11.29ZM217.39 217.4a22.53 22.53 0 0 0-14.45-5.26 22.49 22.49 0 1 0 14.45 5.26Z' />
                      <path d='M400 0C179.09 0 0 179.09 0 400s179.09 400 400 400 400-179.09 400-400S620.91 0 400 0Zm0 755a353.83 353.83 0 0 1-108.75-17v-95.5a52.56 52.56 0 0 1 52.5-52.5h112.5a52.56 52.56 0 0 1 52.5 52.5V738A353.83 353.83 0 0 1 400 755Zm327.12-216.83a353.13 353.13 0 0 1-50.73 84.63 97.42 97.42 0 0 0-78.89-40.3 22.5 22.5 0 0 0 0 45 52.55 52.55 0 0 1 47.25 29.64 353.53 353.53 0 0 1-91 63V642.5a97.61 97.61 0 0 0-97.5-97.5h-112.5a97.61 97.61 0 0 0-97.5 97.5v77.59a353.53 353.53 0 0 1-91-63 52.55 52.55 0 0 1 47.25-29.59 22.5 22.5 0 0 0 0-45 97.4 97.4 0 0 0-78.89 40.3 355 355 0 1 1 603.51-361 356.32 356.32 0 0 1 0 276.34Z' />
                      <path d='M400 510a110 110 0 1 1 110-110 110.13 110.13 0 0 1-110 110Zm0-175a65 65 0 1 0 65 65 65.08 65.08 0 0 0-65-65ZM558.37 529.34a97.38 97.38 0 0 1-41.32-9.19 22.5 22.5 0 0 1 19.11-40.74 52.5 52.5 0 1 0 18.15-99.89 22.5 22.5 0 0 1-3.53-44.86 97.49 97.49 0 0 1 17.44 194.18 95.55 95.55 0 0 1-9.85.5Z' />
                      <path d='M241.63 529.34a95.55 95.55 0 0 1-9.85-.5 97.49 97.49 0 0 1 17.44-194.18 22.5 22.5 0 0 1-3.53 44.86 52.79 52.79 0 0 0-56.31 47 52.51 52.51 0 0 0 74.46 52.86A22.5 22.5 0 0 1 283 520.15a97.38 97.38 0 0 1-41.37 9.19Z' />
                    </symbol>
                  </defs>
                  <use
                    xmlSpace='http://www.w3.org/1999/xlink'
                    xlinkHref='#team-icon-outline'
                  />
                </svg>
                <svg
                  xmlnsXlink='http://www.w3.org/1999/xlink'
                  xmlns='http://www.w3.org/2000/svg'
                  className='w-5 h-7 my-auto mr-2 fill-guilded-subtitle group-hover:fill-guilded-white hidden group-hover:inline transition-colors'
                  shapeRendering='geometricPrecision'
                >
                  <defs>
                    <symbol id='team-icon' viewBox='0 0 800 800'>
                      <path d='M400 0C179.09 0 0 179.09 0 400a398.6 398.6 0 0 0 105.45 270.63 97.64 97.64 0 0 1 97.05-88.13 22.5 22.5 0 0 1 0 45A52.56 52.56 0 0 0 150 680v32.26a400 400 0 0 0 96.25 57.12V642.5a97.61 97.61 0 0 1 97.5-97.5h112.5a97.61 97.61 0 0 1 97.5 97.5v126.88A400 400 0 0 0 650 712.26V680a52.56 52.56 0 0 0-52.5-52.5 22.5 22.5 0 0 1 0-45 97.64 97.64 0 0 1 97 88.13A398.6 398.6 0 0 0 800 400C800 179.09 620.91 0 400 0Zm182.61 217.4a22.53 22.53 0 0 1 14.45-5.26 22.5 22.5 0 1 1-14.45 5.26ZM509.14 166a22.58 22.58 0 0 1 19.5-11.25 22.5 22.5 0 1 1-11.26 42 22.51 22.51 0 0 1-8.24-30.75Zm-86.63-23.22a22.46 22.46 0 0 1 22.14-18.59 22.5 22.5 0 1 1-22.15 18.59Zm-85.61-9a22.36 22.36 0 0 1 14.52-9.25 22.59 22.59 0 0 1 3.93-.34 22.5 22.5 0 1 1-18.45 9.59Zm-87.26 37.64a22.48 22.48 0 0 1 21.72-16.67 22.58 22.58 0 0 1 19.5 11.25 22.5 22.5 0 1 1-41.22 5.42Zm-63.95 48.79a22.48 22.48 0 0 1 17.25-8 22.49 22.49 0 0 1 22.4 20.54 22.5 22.5 0 1 1-39.65-12.51Zm97.26 300a97.38 97.38 0 0 1-41.32 9.19 95.55 95.55 0 0 1-9.85-.5 97.49 97.49 0 0 1 17.44-194.18 22.5 22.5 0 0 1-3.53 44.86 52.49 52.49 0 1 0 18.15 99.89A22.5 22.5 0 0 1 283 520.15ZM400 510a110 110 0 1 1 110-110 110.13 110.13 0 0 1-110 110Zm168.22 18.84a95.55 95.55 0 0 1-9.85.5 97.35 97.35 0 0 1-41.32-9.19 22.5 22.5 0 0 1 19.11-40.74 52.5 52.5 0 1 0 18.15-99.89 22.5 22.5 0 0 1-3.53-44.86 97.49 97.49 0 0 1 17.44 194.18Z' />
                      <circle cx={400} cy={400} r={65} />
                      <path d='M508.75 642.5a52.56 52.56 0 0 0-52.5-52.5h-112.5a52.56 52.56 0 0 0-52.5 52.5V785A400.55 400.55 0 0 0 400 800a400.55 400.55 0 0 0 108.75-15Z' />
                    </symbol>
                  </defs>
                  <use
                    xmlSpace='http://www.w3.org/1999/xlink'
                    xlinkHref='#team-icon'
                  />
                </svg>
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
            iconUrl = `https://img.guildedcdn.com/UserAvatar/${app.icon_hash}-Small.webp`
          }
          return (
            <Link to={`/dev/apps/${app.bot_id}`} key={`app-${app.bot_id}`}>
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
