import {Pool} from 'postgresql-client'

export const pool = new Pool({
    host: process.env.PSQL_URI,
    pool: {
        max: 30,
        idleTimeoutMillis: 3000,
        acquireMaxRetries: 3,
    }
})

export default pool
