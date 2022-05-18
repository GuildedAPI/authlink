import { redirect } from '@remix-run/server-runtime'
import { Outlet, Link } from '@remix-run/react'

export async function loader({ request }) {
    if (new URL(request.url).pathname === '/dev') return redirect('/dev/docs')
    return null
}

export default function Developers() {
    return (
        <div className='sm:flex'>
            <div className='w-full mb-4 sm:w-32 sm:mb-0 sm:mr-4 bg-guilded-slate p-2 rounded h-full' id='sidebar'>
                <div className='flex text-guilded-subtitle text-xs'>
                    <h3 className='font-bold'>Menu</h3>
                </div>
                <ul className='text-guilded-link text-sm'>
                    <li><Link to='/dev/apps'>Your Apps</Link></li>
                    <li><Link to='/dev/docs'>Docs</Link></li>
                </ul>
            </div>
            <Outlet/>
        </div>
    )
}
