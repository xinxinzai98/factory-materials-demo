/**
 * 复合业务压测脚本（登录 → 入库草稿 → 审批 → 上架）
 * 用法：
 *  1. 启动服务 (需 ADMIN 用户 testadmin / pass123 或自动种子 admin/123456)
 *  2. RUN_DB_INT=true tsx src/scripts/load-test-business.ts --base http://localhost:8080 --users 5 --rounds 50
 *  参数：
 *    --base    基础 URL (默认 http://localhost:8080)
 *    --users   并发逻辑用户数（循环复用）
 *    --rounds  每个逻辑用户执行多少个完整单据流
 *  输出：平均/95分位阶段延迟、总成功数、错误计数。
 */
import crypto from 'crypto';
import fetch from 'node-fetch';

interface MetricsSpan { name: string; start: number; end?: number; }
interface FlowResult { ok: boolean; error?: string; spans: MetricsSpan[]; }

function now() { return Date.now(); }
function span(name: string): MetricsSpan { return { name, start: now() }; }

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: any = { base: 'http://localhost:8080', users: 3, rounds: 10 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base') opts.base = args[++i];
    if (args[i] === '--users') opts.users = Number(args[++i]);
    if (args[i] === '--rounds') opts.rounds = Number(args[++i]);
  }
  return opts as { base: string; users: number; rounds: number };
}

async function login(base: string, username: string, password: string) {
  const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  if (!r.ok) throw new Error('login ' + r.status);
  const j: any = await r.json();
  return j.token as string;
}

async function flow(base: string, token: string): Promise<FlowResult> {
  const spans: MetricsSpan[] = [];
  const retryable = (status: number) => [409, 404, 422].includes(status);
  try {
    // 1. 草稿（单次，不预期版本冲突）
    spans.push(span('draft'));
    const code = 'IB' + Date.now() + '-' + crypto.randomBytes(2).toString('hex');
    let r = await fetch(base + '/api/inbounds/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ code, sourceType: 'PURCHASE', supplier: 'SUP1', items: [{ materialCode: 'M001', qty: 1, batchNo: 'B' + Date.now() }] })
    });
    if (!r.ok) throw new Error('draft ' + r.status);
    spans[spans.length - 1].end = now();

    // 2. 审批（允许 2 次重试: 幂等或版本瞬态 409/404/422）
    spans.push(span('approve'));
    for (let attempt = 1; attempt <= 3; attempt++) {
      r = await fetch(base + `/api/inbounds/${code}/approve`, { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
      if (r.ok) { spans[spans.length - 1].end = now(); break; }
      if (attempt === 3 || !retryable(r.status)) throw new Error('approve ' + r.status);
      await new Promise(res => setTimeout(res, 30 * attempt));
    }

    // 3. 上架（允许 2 次重试）
    spans.push(span('putaway'));
    for (let attempt = 1; attempt <= 3; attempt++) {
      r = await fetch(base + `/api/inbounds/${code}/putaway`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ locationCode: null }) });
      if (r.ok) { spans[spans.length - 1].end = now(); break; }
      if (attempt === 3 || !retryable(r.status)) throw new Error('putaway ' + r.status);
      await new Promise(res => setTimeout(res, 30 * attempt));
    }

    return { ok: true, spans };
  } catch (e: any) {
    const last = spans[spans.length - 1];
    if (last && !last.end) last.end = now();
    return { ok: false, error: e.message, spans };
  }
}

function aggregate(results: FlowResult[]) {
  const byStage: Record<string, number[]> = {};
  for (const r of results) {
    for (const s of r.spans) {
      if (!s.end) continue;
      (byStage[s.name] ||= []).push(s.end - s.start);
    }
  }
  function stats(arr: number[]) {
    if (!arr.length) return { count: 0, avg: 0, p95: 0, max: 0 };
    const sorted = [...arr].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95) - 1] || sorted[sorted.length - 1];
    const sum = arr.reduce((a, b) => a + b, 0);
    return { count: arr.length, avg: +(sum / arr.length).toFixed(2), p95, max: sorted[sorted.length - 1] };
  }
  const stageStats = Object.fromEntries(Object.entries(byStage).map(([k, v]) => [k, stats(v)]));
  return stageStats;
}

async function main() {
  const { base, users, rounds } = parseArgs();
  console.log(`[biz-load] base=${base} users=${users} rounds=${rounds}`);
  // 预登陆：尝试 admin / testadmin / op
  const candidateUsers = [
    { u: 'testadmin', p: 'pass123' },
    { u: 'admin', p: '123456' },
    { u: 'op', p: '123456' }
  ];
  const tokens: string[] = [];
  for (const cu of candidateUsers) {
    try { tokens.push(await login(base, cu.u, cu.p)); } catch { /* ignore */ }
  }
  if (!tokens.length) throw new Error('no login succeeded');
  while (tokens.length < users) tokens.push(tokens[tokens.length % tokens.length]);

  const all: FlowResult[] = [];
  const startAll = now();
  await Promise.all(Array.from({ length: users }).map(async (_, idx) => {
    const token = tokens[idx % tokens.length];
    for (let i = 0; i < rounds; i++) {
      const r = await flow(base, token);
      all.push(r);
    }
  }));
  const totalMs = now() - startAll;
  const ok = all.filter(a => a.ok).length;
  const fail = all.length - ok;
  const stageStats = aggregate(all);
  console.log(JSON.stringify({ totalFlows: all.length, ok, fail, durationMs: totalMs, stage: stageStats }, null, 2));
}

main().catch(e => { console.error('[biz-load] failed', e); process.exit(1); });
