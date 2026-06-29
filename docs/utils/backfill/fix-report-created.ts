import mysql from "mysql2/promise";

const c = await mysql.createConnection(process.env.DATABASE_URL as string);

const [d] = (await c.query(
  "update reports set created_at = concat(period_end, ' 23:00:00') where kind='daily'",
)) as unknown as [{ affectedRows: number }];
const [w] = (await c.query(
  "update reports set created_at = concat(period_end, ' 22:00:00') where kind='weekly'",
)) as unknown as [{ affectedRows: number }];
console.log("updated — daily:", d.affectedRows, "| weekly:", w.affectedRows);

const [chk] = (await c.query(
  "select count(*) n from reports where date(created_at) <> period_end",
)) as unknown as [{ n: number }[]];
console.log("보정 후 불일치 잔여(목표 0):", chk[0].n);
await c.end();
