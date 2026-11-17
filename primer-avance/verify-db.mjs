import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const expected=JSON.parse(await readFile('public/pilot/manifest.json','utf8')).count;
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as
$$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;`);
await db.exec(await readFile('supabase/001_pilot.sql','utf8'));
await db.exec(await readFile('supabase/002_seed.sql','utf8'));
const u='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
await db.exec(`insert into auth.users values('${u}'),('${other}');
insert into public.memberships values('00000000-0000-4000-8000-000000000001','${u}');`);
async function denied(sql,code) {
  try {await db.exec(sql);assert.fail('Acción permitida inesperadamente');}
  catch(e) {assert.equal(e.code,code);}
}
await db.exec('set role anon');
assert.equal((await db.query('select count(*)::int n from public.candidates')).rows[0].n,expected);
await denied('select * from public.reviews','42501');
await denied("update public.candidates set published=false",'42501');
await denied("select public.record_review('agua-1','Otra causa','test',0)",'42501');
await db.exec('reset role; set role authenticated');
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
assert.equal((await db.query('select * from public.review_heads')).rows.length,0);
await denied("select public.record_review('agua-1','Otra causa','test',0)",'42501');
await denied(`insert into public.memberships values('00000000-0000-4000-8000-000000000001','${other}')`,'42501');
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[u]);
assert.equal((await db.query("select public.record_review('agua-1','Información insuficiente','Ensayo SQL',0) as v")).rows[0].v,1);
assert.equal((await db.query('select author from public.reviews')).rows[0].author,u);
await denied("select public.record_review('agua-1','Otra causa','obsoleta',0)",'40001');
await denied("select public.record_review('agua-1','Confirmado','forzado',1)",'22023');
assert.equal((await db.query('select count(*)::int n from public.reviews')).rows[0].n,1);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
assert.equal((await db.query('select * from public.reviews')).rows.length,0);
assert.equal((await db.query('select * from public.review_heads')).rows.length,0);
await db.exec('reset role');
assert.equal((await db.query('select version from public.review_heads')).rows[0].version,1);
await db.close();
console.log('OK ·',expected,'candidatos · anon solo lee publicados · aislamiento · membresía protegida · autor de sesión · conflicto de versión · rollback íntegro');
