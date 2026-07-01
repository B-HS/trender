import mysql, { ResultSetHeader, RowDataPacket } from 'mysql2/promise'

const OFFSET_HOURS = 9
const SOURCE_IDS = [6, 286]
const dry = process.env.DRY === '1'

const c = await mysql.createConnection(process.env.DATABASE_URL as string)

const where = `source_id in (${SOURCE_IDS.join(',')}) and published_at is not null and timestampdiff(hour, published_at, fetched_at) < 6`

const [target] = await c.query<RowDataPacket[]>(
    `select source_id, count(*) n, min(published_at) minp, max(published_at) maxp from articles where ${where} group by source_id`,
)
console.log('KST-wallclock target (gap<6h):')
for (const r of target) console.log(`  source_id=${r.source_id} rows=${r.n} range=${r.minp} .. ${r.maxp}`)

const [kept] = await c.query<RowDataPacket[]>(
    `select count(*) n from articles where source_id in (${SOURCE_IDS.join(',')}) and published_at is not null and timestampdiff(hour, published_at, fetched_at) >= 6`,
)
console.log('UTC rows kept (gap>=6, untouched):', kept[0].n)

if (dry) {
    console.log('DRY=1 — no update')
} else {
    const [res] = await c.query<ResultSetHeader>(`update articles set published_at = published_at - interval ${OFFSET_HOURS} hour where ${where}`)
    console.log('affectedRows:', res.affectedRows)
    const [after] = await c.query<RowDataPacket[]>(`select count(*) n from articles where ${where}`)
    console.log('remaining gap<6h (should be 0):', after[0].n)
}

await c.end()
