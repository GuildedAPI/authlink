import { getUser, getExternalBot, getTeamMembers } from './guilded'

export function stripCdnUrl(url) {
    return url
        .replace('https://www.guilded.gg', '')
        .replace('https://img.guildedcdn.com', '')
        .replace('https://s3-us-west-2.amazonaws.com/www.guilded.gg', '')
        .replace(/\/(?:asset\/)?([a-zA-Z]+)\//, '')
        .replace(
            /(?:-(Small|Medium|Large|HeroMd|Hero|Full))?\.(webp|jpeg|jpg|png|gif|apng)(?:\?.+)$/,
            ''
        )
}

export async function tryBot(app) {
    let findMethod = -1
    let bot = null
    if (app.user_id) {
        findMethod = 0
        let user = await getUser(app.user_id)
        user = user.user
        if (user) {
            bot = {
                id: app.bot_id,
                userId: user.id,
                name: user.name,
                iconUrl: user.profilePicture,
                createdAt: user.createdAt || user.joinDate,
            }
        }
    } else {
        if (app.bot_id) {
            findMethod = 1
            const externalBot = await getExternalBot(app.bot_id)
            bot = externalBot.bot
        }
        if (!bot && app.team_id) {
            findMethod = 2
            const teamMembers = await getTeamMembers(app.team_id)
            if (!teamMembers.bots) {
                return {
                    error: true,
                    message: 'This application\'s bot has been deleted or its internal server is private.',
                }
            } else {
                bot = teamMembers.bots.filter(val => (val.internalBotId || val.id) === app.bot_id)[0]
                if (!bot) {
                    return {
                        error: true,
                        message: 'This application\'s bot has been deleted.',
                    }
                }
            }
        }
    }
    return {
        method: findMethod,
        bot: bot,
    }
}

export async function getBotWithMethod(method, props) {
    let bot = null
    switch (method.toString()) {
        case '0':
            const user = await getUser(props.userId)
            if (user) {
                bot = {
                    userId: user.id,
                    name: user.name,
                    iconUrl: user.profilePicture,
                }
            }
        case '1':
            const externalBot = await getExternalBot(props.id)
            bot = externalBot.bot
            break
        case '2':
            const teamMembers = await getTeamMembers(props.teamId)
            bot = (teamMembers.bots || []).filter(val => (val.internalBotId || val.id) === props.id)[0]
            break
    }
    if (bot) {
        bot.iconHash = null
        if (bot.iconUrl) {bot.iconHash = stripCdnUrl(bot.iconUrl)}
        return {
            bot,
        }
    } else {
        return {
            error: true,
            message: 'This application\'s bot could not be found using the method indicated.',
        }
    }
}
