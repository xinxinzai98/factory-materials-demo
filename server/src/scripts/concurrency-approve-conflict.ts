/**
 * 并发审批冲突复现脚本
 * 步骤:
 *  1. 创建一个入库草稿
 *  2. 并发多个请求尝试 approve (使用 If-Match 头携带版本 1)
 *  3. 统计成功 1 次，其余应 409 ERR_VERSION_STALE
 */
import fetch from 'node-fetch';
import crypto from 'crypto';

const base = process.env.BASE || 'http://localhost:8080';
// 支持多账号回退：优先环境变量提供；否则尝试 admin / testadmin / op
const primaryUser = process.env.LOGIN_USER; // 避免误用 shell USER
const primaryPass = process.env.LOGIN_PASS;
const attempts = +(process.env.ATTEMPTS || 8);

async function login(){
  const candidates = primaryUser ? [{u:primaryUser,p:primaryPass||''}] : [
    {u:'admin',p:'123456'},
    {u:'testadmin',p:'pass123'},
    {u:'op',p:'123456'}
  ];
  for (const c of candidates){
    try {
  const r = await fetch(base + '/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:c.u,password:c.p})});
  if(!r.ok) { console.log('[login] fail', c.u, r.status); continue; }
      const j:any = await r.json();
      console.log('[login] using', c.u);
      return j.token as string;
    } catch { /* continue */ }
  }
  throw new Error('login failed for all candidates');
}

async function draft(token:string, code:string){
  for (let attempt=1; attempt<=3; attempt++) {
    const r = await fetch(base + '/api/inbounds/draft',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({code,sourceType:'PURCHASE',supplier:'SUP1',items:[{materialCode:'M001',qty:1,batchNo:'B'+Date.now()}]})});
    if(r.ok) return;
    if (attempt===3) throw new Error('draft '+r.status);
    await new Promise(res=>setTimeout(res, 40*attempt));
  }
}

async function approveOnce(token:string, code:string){
  const r = await fetch(base + `/api/inbounds/${code}/approve`, {method:'POST', headers:{Authorization:'Bearer '+token, 'If-Match':'1'}});
  const body = await r.text();
  return {status:r.status, body};
}

async function main(){
  const token = await login();
  const code = 'IB' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
  await draft(token, code);
  const promises = Array.from({length: attempts}).map(()=>approveOnce(token, code));
  const results = await Promise.all(promises);
  let ok=0, stale=0, other:number[]=[];
  for(const r of results){
    if(r.status === 200) ok++; else if(r.status===409){ stale++; } else other.push(r.status);
  }
  console.log(JSON.stringify({attempts, ok, stale, other}, null, 2));
  if(ok!==1 || stale !== attempts-1){
    console.error('Unexpected distribution (expect ok=1, stale=' + (attempts-1) + ')');
    process.exit(1);
  }
  console.log('[conflict] OK');
}

main().catch(e=>{console.error(e);process.exit(1);});
