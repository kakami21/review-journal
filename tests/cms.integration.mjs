import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const port=Number(process.env.CMS_TEST_PORT ?? 4321);
assert(Number.isInteger(port) && port > 0 && port < 65536, 'ローカルのポート番号を指定してください。');
const base=`http://127.0.0.1:${port}`;
// 公式の開発専用セットアップをローカルでだけ利用する。本番ではこのエンドポイントは403となる。
const setup = await fetch(base+'/_emdash/api/setup/dev-bypass?content=0&token=1',{method:'POST'});
const token = (await setup.json()).data?.token;
assert(token, '先にnpm run dev:astroを起動してください。');
async function api(path,method='GET',body){const r=await fetch(base+'/_emdash/api/'+path,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return r.json();}
const source=await readFile(new URL('../src/cms/review-store.ts', import.meta.url),'utf8');
const temp = await mkdtemp(join(tmpdir(), 'table-notes-cms-test-'));
const compiled=join(temp, 'store.mjs');
const compilerOptions={module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext};
await writeFile(compiled,ts.transpileModule(source,{compilerOptions}).outputText.replaceAll('"./review-data"','"./review-data.mjs"'));
const dataSource=await readFile(new URL('../src/cms/review-data.ts', import.meta.url),'utf8');
await writeFile(join(temp,'review-data.mjs'),ts.transpileModule(dataSource,{compilerOptions}).outputText);
const {CmsReviewStore}=await import(pathToFileURL(compiled).href);
let lastDate;
const db={prepare:()=>({bind:date=>({run:async()=>{lastDate=date;}})})};
const cms={handleContentCreate:(c,b)=>api('content/'+c,'POST',b),handleContentList:(c,p)=>api('content/'+c+'?'+new URLSearchParams(Object.entries(p).filter(([,v])=>v!==undefined))),handleContentListTrashed:(c,p)=>api('content/'+c+'/trash?'+new URLSearchParams(Object.entries(p).filter(([,v])=>v!==undefined)))};
const store=new CmsReviewStore(cms,db);
const sourceId='integration-'+Date.now();
const review={id:sourceId,detailUrl:'https://tabelog.com/rvwr/test/'+sourceId,name:'結合テスト店舗',url:'https://tabelog.com/restaurant/test',title:null,body:'取得原文\n2行目',reviewDate:'2026-10',rating:4,likeCount:3};
// 同じ取得元IDを同時に取り込み、DBの一意制約と競合後の照合を実CMSで確認する。
const concurrent=await Promise.all([store.importNew([review],'2026-10-26T00:00:00.000Z'),store.importNew([review],'2026-10-26T00:00:00.000Z')]);
assert.equal(concurrent.reduce((sum,result)=>sum+result.addedCount,0),1);
assert.equal(lastDate,'2026-10-26T00:00:00.000Z');
const list=await api('content/reviews');const item=list.data.items.find(i=>i.data.source_id===sourceId);assert(item);assert.equal(item.status,'draft');
async function publicList(){const r=await fetch(base+'/api/reviews');assert.equal(r.status,200);return (await r.json()).reviews;}
assert(!(await publicList()).some(i=>i.id===sourceId));
let published=await api('content/reviews/'+item.id+'/publish','POST',{});assert(published.success,JSON.stringify(published));
assert.equal((await publicList()).find(i=>i.id===sourceId).body,review.body);
let updated=await api('content/reviews/'+item.id,'PUT',{data:{body:'管理画面で編集した本文'}});assert(updated.success,JSON.stringify(updated));
assert.equal((await publicList()).find(i=>i.id===sourceId).body,review.body,'編集中の下書きを公開しない');
published=await api('content/reviews/'+item.id+'/publish','POST',{});assert(published.success,JSON.stringify(published));
assert.equal((await publicList()).find(i=>i.id===sourceId).body,'管理画面で編集した本文');
assert.equal((await store.importNew([review],'2026-10-26T01:00:00.000Z')).addedCount,0);
assert.equal((await publicList()).find(i=>i.id===sourceId).body,'管理画面で編集した本文');
const rejected=await api('content/reviews/'+item.id,'PUT',{data:{source_id:'modified-id'}});assert.equal(rejected.success,false,JSON.stringify(rejected));
const removed=await api('content/reviews/'+item.id,'DELETE');assert(removed.success,JSON.stringify(removed));
assert.equal((await store.importNew([review],'2026-10-26T02:00:00.000Z')).addedCount,0);
assert(!(await publicList()).some(i=>i.id===sourceId));
console.log('PASS: 実CMSで下書き追加・公開・編集・公開版保護・再取得保護・取得元変更拒否・ゴミ箱再追加防止');

await rm(temp, {recursive:true,force:true});
