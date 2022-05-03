export function cloneFormData(data, props={}) {
    const cloned = {}
    const keepAll = props.keepAllKeys || []
    for (const key of Object.keys(data._fields)) {
        if (keepAll.includes(key)) {
            cloned[key] = data.getAll(key)
        } else {
            cloned[key] = data.get(key)
        }
    }
    return cloned
}

export function copyText(text) {
    const input = document.createElement('textarea')
    input.value = text
    input.style.position = 'fixed'
    input.style.opacity = '0'

    const root = document.body
    root.append(input)

    input.focus()
    input.select()

    document.execCommand('copy')

    input.remove()
}  
