import styles from '~/styles/coolicons.css'

import {
    Link,
    Links,
    LiveReload,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    useCatch,
    useLoaderData,
    useSubmit,
} from '@remix-run/react'

import { getSession } from '~/sessions.server'
import { PopoutSelectables } from '~/common/components'

import { useState } from 'react'
import { useFloating, shift, useInteractions, useHover } from '@floating-ui/react-dom-interactions'

export const links = () => {
    return [
        { rel: 'stylesheet', href: styles },
        { rel: 'stylesheet', href: '/tailwindcss' },
    ]
}

export const meta = () => ({
    charset: 'utf-8',
    title: 'Guilded Authlink',
    viewport: 'width=device-width,initial-scale=1',
})

export async function loader({ request }) {
    const session = await getSession(request.headers.get('Cookie'))
    if (session.has('guilded')) {
        return {
            user: session.get('guilded').user,
        }
    }
    return null
}

const Navbar = () => {
    const data = useLoaderData()
    const submit = useSubmit()

    const [open, setOpen] = useState(false)
    const {x, y, reference, floating, strategy, context} = useFloating({
        open,
        onOpenChange: setOpen,
        placement: 'bottom-end',
        middleware: [shift()],
    })
    const {getReferenceProps, getFloatingProps} = useInteractions([useHover(context)])

    return (
        <div className='mr-2 mb-3 rounded-md flex text-sm'>
            <div className='my-auto'>
                <img src='/images/Guilded_Logomark_White.svg' className='h-10' alt='Guilded Logo'/>
            </div>
            <div className='my-auto'>
                <p className='text-guilded-subtitle text-xs'>This site is not affiliated with guilded.gg.</p>
            </div>
            <div className='ml-auto my-auto'>
                <p>
                    <Link to='/dev/docs' className='text-guilded-link'>Developers</Link>
                    {' ' + String.fromCodePoint(0x2022) + ' '}
                    <Link to='/' className='text-guilded-link'>About</Link>
                </p>
            </div>
            {(data && data.user) && (
                <div
                    className='ml-2 my-auto'
                    {...getReferenceProps({ref: reference})}
                >
                    <Link to='/me'>
                        <img
                            className='h-7 rounded-full hover:shadow transition-shadow'
                            src={
                                data.user.profilePicture
                                ? data.user.profilePicture
                                : 'https://img.guildedcdn.com/asset/DefaultUserAvatars/profile_1.png'
                            }
                        />
                    </Link>
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
                        className='pt-2'
                    >
                    <PopoutSelectables
                        items={[
                            {
                                icon: <i className='ci-external_link' />,
                                label: 'Your profile',
                                link: {to: `https://www.guilded.gg/profile/${data.user.id}`, external: true},
                            },
                            {
                                icon: <i className='ci-folder' />,
                                label: 'Your applications',
                                link: {to: '/dev/apps'},
                            },
                            {
                                icon: <i className='ci-file_blank_outline' />,
                                label: 'Documentation',
                                link: {to: '/dev/docs'},
                            },
                            {
                                separator: true,
                            },
                            {
                                icon: <i className='ci-home_minus' />,
                                label: 'Log out',
                                callback: (event) => {
                                    event.currentTarget.parentNode.classList.add('hidden')
                                    submit({_action: 'logout'}, {method: 'post', action: '/me', replace: true})
                                },
                            },
                        ]}
                    />
                    </div>
                )}
                </div>
            )}
        </div>
    )
}

export default function App() {
    return (
        <html lang='en'>
            <head>
                <Meta />
                <Links />
            </head>
            <body className='bg-guilded-gray text-guilded-white p-5 mx-auto max-w-2xl'>
                <Navbar />
                <Outlet />
                <ScrollRestoration />
                <Scripts />
                <LiveReload />
            </body>
        </html>
    )
}

export function ErrorBoundary({ error }) {
    console.error(error)
    return (
        <html lang='en'>
            <head>
                <Meta />
                <Links />
            </head>
            <body className='bg-guilded-gray text-guilded-white p-5 mx-auto max-w-2xl'>
                <Navbar />
                <h1 className='font-bold text-2xl'>Something went wrong</h1>
                <p>{error.message}</p>
                <p className='mt-2'>You might want to report this on <a href='https://www.guilded.gg/authlink' className='text-guilded-link' target='_blank'>the Authlink server</a>.</p>
                <Scripts />
            </body>
        </html>
    )
}

export function CatchBoundary() {
    const caught = useCatch()
    const data = caught.data || {}
    return (
        <html lang='en'>
            <head>
                <Meta />
                <Links />
            </head>
            <body className='bg-guilded-gray text-guilded-white p-5 mx-auto max-w-2xl'>
                <Navbar />
                <h1 className='font-bold text-2xl'>{data.message || caught.statusText}</h1>
                <p className='text-guilded-subtitle italic'>Your complimentary status code is {caught.status}.</p>
                <p className='mt-2'>Maybe you should just <Link to='/' className='text-guilded-link'>go home</Link>.</p>
                <p>If this looks like it shouldn't have happened, you should report this on <a href='https://www.guilded.gg/authlink' className='text-guilded-link' target='_blank'>the Authlink server</a>.</p>
                <Scripts />
            </body>
        </html>
    )
}
