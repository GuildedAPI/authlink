import { Link } from '@remix-run/react'
import { copyText } from './utilities'

export const Button = (props) => {
    const style = props.stylename || 'normal'
    const styleNormal = (
        'shadow-[0_0_6px_0_rgba(255,234,0,0.5)] hover:shadow-[0_0_10px_0_rgba(255,234,0,0.5)] '
        + 'bg-gradient-to-r from-[#ffb400] via-[#e4c519] to-[#edd75c] hover:bg-[99%_0] '
        + 'text-guilded-black transition '
    )
    const styleDanger = (
        'bg-red-500 hover:bg-red-400 text-white transition-colors '
    )

    return (
        <button
            className={
                'px-3 py-[0.3rem] rounded disabled:shadow-none '
                + 'font-bold disabled:bg-none disabled:bg-transparent '
                + 'disabled:text-guilded-subtitle disabled:border disabled:border-guilded-subtitle disabled:cursor-not-allowed '
                + (
                    style === 'normal'
                    ? styleNormal
                    : style === 'danger'
                    ? styleDanger
                    : ''
                )
                + (props.className || '')
            }
            onClick={props.onClick}
            type={props.type}
        >
            {props.children}
        </button>
    )
}

export const ErrorBlock = (props) => {
    return (
        <div className='rounded bg-[#df5353] border-2 border-[#e37575] px-3 py-2 mb-4 w-full font-bold empty:hidden' id='error'>
            {props.children}
        </div>
    )
}

export const InlineCode = (props) => {
    return (
        // This is intentionally not the exact same as the client;
        // I felt the background was too light and the border radius too subtle.
        <code className='bg-[#1F2024] px-[4px] pb-[2px] rounded text-[0.9em]'>
            {props.children}
        </code>
    )
}

export const PopoutSelectables = (props) => {
    return (
        <ul
            className='bg-[#4e505c] p-1 rounded-md border border-white/10 shadow'
            {...props}
        >
            {props.items.map((item, index) => {
                if (item.separator) {
                    return <hr key={`separator-${index}`} className='border-guilded-white/10 my-0.5'/>
                }
                const Wrapper = (props) => {
                    return item.link
                    ? item.link.external
                        ? <a key={item.label} href={item.link.to} target='_blank'>{props.children}</a>
                        : <Link key={item.label} to={item.link.to}>{props.children}</Link>
                    : <>{props.children}</>
                }
                return (
                    <Wrapper>
                    <li
                        className='flex group hover:bg-[#575964] rounded px-1 py-0.5 cursor-pointer transition-colors'
                        key={item.label}
                        onClick={item.callback}
                    >
                        <div className='text-lg -mb-[2px] mt-auto mr-2 text-gray-300 group-hover:text-white transition-colors'>{item.icon}</div>
                        <div className='text-[0.9rem] pr-4 my-auto'>
                            {item.label}
                        </div>
                    </li>
                    </Wrapper>
                )
            })}
        </ul>
    )
}

export const Modal = (props) => {
    return <></>
}

export const CopyArea = (props) => {
    return (
        <div className='flex'>
            <input
                id={props.id}
                className='p-2 w-full h-full my-auto rounded bg-guilded-slate border border-white/10 hover:border-white/30 transition-colors cursor-default'
                value={props.value}
                readOnly
                disabled
            />
            <button
                onClick={(event) => {
                    copyText(props.value)

                    const icon = event.currentTarget.children[0]
                    icon.classList.add('border-green-500/70')
                    icon.classList.add('hover:border-green-500')
                    icon.classList.remove('border-white/10')
                    icon.classList.remove('hover:border-white/30')
                    icon.classList.remove('ci-copy')
                    icon.classList.add('ci-check_big')
                    setTimeout(() => {
                        icon.classList.remove('border-green-500/70')
                        icon.classList.remove('hover:border-green-500')
                        icon.classList.add('border-white/10')
                        icon.classList.add('hover:border-white/30')
                        icon.classList.add('ci-copy')
                        icon.classList.remove('ci-check_big')
                    }, 2300)
                }}
            >
                <i className='ci-copy my-auto h-full text-2xl border border-white/10 hover:border-white/30 ml-3 rounded bg-guilded-slate p-2 h-full transition-colors'/>
            </button>
        </div>
    )
}
