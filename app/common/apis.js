export async function request(method, path, props) {
    const headers = {}

    let data = undefined
    if (props.json) {
        data = JSON.stringify(props.json)
        headers['Content-Type'] = 'application/json'
    }

    if (props.headers) {
        Object.assign(headers, props.headers)
    }

    const url = new URL(props.BASE + path)

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
    if (props.returnResponse) {
        return response
    }
    if (response.status == 204) {
        return {}
    }
    if (response.headers.get('Content-Type') == 'application/json') {
        return await response.json()
    }
    return await response.data()
}
