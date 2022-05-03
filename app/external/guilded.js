import {request} from '~/common/apis'

const BASE = 'https://www.guilded.gg/api'

export async function login(email, password) {
    const response = await request('POST', '/login', {email, password, returnResponse: true, BASE})
    const data = await response.json()
    return {
        data: data,
        cookie: response.headers.get('set-cookie')
    }
}

export async function getUser(id) {
    return await request('GET', `/users/${id}`, {BASE})
}

export async function getUserPost(user_id, post_id) {
    return await request('GET', `/users/${user_id}/posts/${post_id}`, {BASE})
}

export async function getUserPosts(id, limit = 7) {
    return await request('GET', `/users/${id}/posts`, {
        BASE,
        params: {
            maxPosts: limit,
        }
    })
}

export async function search(query, type, limit) {
    return await request('GET', '/search', {
        BASE,
        params: {
            query: query,
            entityType: type,
            maxResultsPerType: limit,
        }
    })
}

export async function getUserTeams(user_id) {
    return await request('GET', `/users/${user_id}/teams`, {BASE})
}

export async function getTeamInfo(server_id) {
    return await request('GET', `/teams/${server_id}/info`, {BASE})
}

export async function getTeamMembers(server_id) {
    return await request('GET', `/teams/${server_id}/members`, {BASE})
}

export async function getDetailedTeamMembers(server_id, user_ids=[], user_ids_for_basic_info=[]) {
    return await request('POST', `/teams/${server_id}/members/detail`, {
        BASE,
        json: {
            userIds: user_ids,
            userIdsForBasicInfo: user_ids_for_basic_info,
        }
    })
}

export async function getExternalBot(bot_id) {
    return await request('GET', `/external-bots/${bot_id}`, {BASE})
}
