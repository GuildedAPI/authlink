const BASE = 'https://www.guilded.gg/api'

async function request(method, path, props={}) {
    const headers = {}

    let data = undefined
    if (props.json) {
        data = JSON.stringify(props.json)
        headers['Content-Type'] = 'application/json'
    }

    if (props.headers) {
        Object.assign(headers, props.headers)
    }

    const url = new URL(BASE + path)

    if (props.params) {
        for (const key of Object.keys(props.params)) {
            url.searchParams.append(key, props.params[key])
        }
    }

    const response = await fetch(url, {
        method,
        data,
        headers,
    })
    if (response.status == 204) {
        return {}
    }
    if (response.headers.get('Content-Type') == 'application/json') {
        return await response.json()
    }
    return await response.data()
}

export async function getUser(id) {
    return await request('GET', `/users/${id}`)
}

export async function getUserPost(user_id, post_id) {
    return await request('GET', `/users/${user_id}/posts/${post_id}`)
}

export async function getUserPosts(id, limit = 7) {
    return await request('GET', `/users/${id}/posts`, {
        params: {
            maxPosts: limit,
        }
    })
}

export async function search(query, type, limit) {
    return await request('GET', '/search', {
        params: {
            query: query,
            entityType: type,
            maxResultsPerType: limit,
        }
    })
}

export async function getTeamInfo(server_id) {
    return await request('GET', `/teams/${server_id}/info`)
}

export async function getTeamMembers(server_id) {
    return await request('GET', `/teams/${server_id}/members`)
}

export async function getDetailedTeamMembers(server_id, user_ids=[], user_ids_for_basic_info=[]) {
    return await request('POST', `/teams/${server_id}/members/detail`, {
        json: {
            userIds: user_ids,
            userIdsForBasicInfo: user_ids_for_basic_info,
        }
    })
}

export async function getExternalBot(bot_id) {
    return await request('GET', `/external-bots/${bot_id}`)
}
