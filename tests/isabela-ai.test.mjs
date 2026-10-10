import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHandler, MAX_AUDIO_BYTES } from '../supabase/functions/isabela-ai/handler.mjs';

const vars = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'public-test-key', CLOUDFLARE_ACCOUNT_ID: 'test-account', CLOUDFLARE_API_TOKEN: 'server-only-token' };
const audio = { mode: 'transcribe', audioBase64: 'AAEC/w==', mimeType: 'audio/webm;codecs=opus' };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });
function setup({ overrides = {}, authStatus = 200, upstream = () => reply({ success: true, result: { text: ' Fala de teste. ', response: 'Resumo de teste.' } }) } = {}) {
  const calls = [];
  const handler = createHandler({ env: k => ({ ...vars, ...overrides })[k], fetch: async (url, opts) => {
    calls.push({ url, ...opts });
    return url.includes('/auth/v1/user') ? reply({ id: 'test-user' }, authStatus) : upstream(url, opts);
  } });
  return { calls, handler };
}
function req(body = audio, headers = {}, method = 'POST') {
  return new Request('https://example.supabase.co/functions/v1/isabela-ai', { method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-session', ...headers },
    ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });
}
async function expectStatus(handler, request, status) {
  const res = await handler(request);
  assert.equal(res.status, status);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  return res;
}

test('Android and browser preflight needs no auth or secrets', async () => {
  const { handler, calls } = setup({ overrides: { CLOUDFLARE_API_TOKEN: undefined } });
  for (const origin of ['https://localhost', 'http://localhost', 'https://example.com', 'null']) {
    const res = await expectStatus(handler, req(undefined, { Origin: origin, Authorization: '' }, 'OPTIONS'), 204);
    for (const h of ['authorization', 'apikey', 'content-type', 'x-client-info', 'traceparent'])
      assert.ok(res.headers.get('access-control-allow-headers').includes(h));
    assert.ok(res.headers.get('access-control-allow-methods').includes('POST'));
  }
  assert.equal(calls.length, 0);
});
test('non-POST requests are rejected with CORS', async () => {
  await expectStatus(setup().handler, req(undefined, {}, 'GET'), 405);
});
test('missing or invalid user session never reaches Cloudflare', async () => {
  let s = setup(); await expectStatus(s.handler, req(audio, { Authorization: '' }), 401); assert.equal(s.calls.length, 0);
  s = setup({ authStatus: 401 }); await expectStatus(s.handler, req(), 401); assert.equal(s.calls.length, 1);
});
test('base64 becomes exact binary bytes; only the server token reaches Cloudflare', async () => {
  const { handler, calls } = setup(); const res = await expectStatus(handler, req(), 200);
  assert.deepEqual(await res.json(), { text: 'Fala de teste.' });
  assert.equal(calls[0].headers.Authorization, 'Bearer test-session');
  assert.match(calls[1].url, /\/ai\/run\/@cf\/openai\/whisper$/);
  assert.equal(calls[1].headers.Authorization, 'Bearer server-only-token');
  assert.equal(calls[1].headers['Content-Type'], 'application/octet-stream');
  assert.deepEqual([...calls[1].body], [0, 1, 2, 255]);
});
for (const mimeType of ['audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm;codecs=opus']) {
  test(`accepts ${mimeType}`, async () => { await expectStatus(setup().handler, req({ ...audio, mimeType }), 200); });
}
for (const [name, body, status] of [
  ['empty audio', { ...audio, audioBase64: '' }, 400],
  ['invalid base64', { ...audio, audioBase64: '!!!!' }, 400],
  ['data URL instead of raw base64', { ...audio, audioBase64: 'data:audio/webm;base64,AAAA' }, 400],
  ['invalid MIME', { ...audio, mimeType: 'text/html' }, 415],
  ['unknown mode', { mode: 'delete' }, 400], ['invalid JSON', '{', 400], ['null JSON', 'null', 400],
  ['audio over 5 MB', { ...audio, audioBase64: Buffer.alloc(MAX_AUDIO_BYTES + 1).toString('base64') }, 413],
]) test(name, async () => {
  const { handler, calls } = setup(); await expectStatus(handler, req(body), status); assert.equal(calls.length, 1);
});
test('streaming JSON size bound rejects oversized requests without Content-Length', async () => {
  await expectStatus(setup().handler, req(' '.repeat(7 * 1024 * 1024)), 413);
});
test('missing Cloudflare secrets is explicit and never calls AI', async () => {
  const { handler, calls } = setup({ overrides: { CLOUDFLARE_API_TOKEN: '' } });
  const res = await expectStatus(handler, req(), 503); assert.match((await res.json()).error, /CLOUDFLARE_API_TOKEN/); assert.equal(calls.length, 1);
});
for (const mode of ['summary', 'report', 'query']) test(`preserves ${mode} contract`, async () => {
  const { handler, calls } = setup(); const res = await expectStatus(handler, req({ mode, question: 'Organize', context: 'Dados fictícios' }), 200);
  assert.equal((await res.json()).text, 'Resumo de teste.');
  assert.match(calls[1].url, /llama-3.1-8b-instruct-fast$/);
  assert.match(JSON.parse(calls[1].body).messages[1].content, /Dados fictícios/);
});
for (const [name, upstream, status] of [
  ['Cloudflare auth error', () => reply({ success: false, errors: ['private-details'] }, 401), 502],
  ['Cloudflare quota', () => reply({ success: false }, 429), 429],
  ['Cloudflare invalid JSON', () => new Response('<html>error</html>', { status: 502 }), 502],
  ['empty transcription', () => reply({ success: true, result: { text: '' } }), 422],
  ['Cloudflare timeout', () => { throw new DOMException('timeout', 'TimeoutError'); }, 504],
  ['network failure', () => { throw new TypeError('Failed to fetch'); }, 502],
]) test(name, async () => {
  const res = await expectStatus(setup({ upstream }).handler, req(), status);
  assert.ok((await res.json()).error);
});

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function client(invoke, session = 'user-session') {
  const sandbox = { sb: {
    auth: { getSession: async () => ({ data: { session: session ? { access_token: session } : null } }) },
    functions: { invoke },
  }, blobBase64Raw: async blob => Buffer.from(await blob.arrayBuffer()).toString('base64') };
  vm.createContext(sandbox);
  vm.runInContext(html.slice(html.indexOf('async function describeAIError('), html.indexOf('async function patientAIAction(')), sandbox);
  return sandbox;
}
test('all inline HTML scripts parse', () => {
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1]);
});
test('browser audio helper integrates with actual Edge handler using fake external services', async () => {
  const { handler } = setup();
  const c = client(async (name, options) => {
    assert.equal(name, 'isabela-ai'); assert.equal(options.headers.Authorization, 'Bearer user-session');
    const res = await handler(req(options.body)); return { data: await res.json() };
  });
  assert.equal(await c.requestAudioTranscript(new Blob([new Uint8Array([0, 1, 2, 255])], { type: 'audio/webm;codecs=opus' })), 'Fala de teste.');
});
test('no session, empty audio and oversize audio are rejected before upload', async () => {
  let calls = 0; const c = client(async () => { calls++; }, null);
  await assert.rejects(c.requestAudioTranscript(new Blob([])), /vazio/);
  await assert.rejects(c.requestAudioTranscript({ size: MAX_AUDIO_BYTES + 1 }), /5 MB/);
  await assert.rejects(c.requestAudioTranscript(new Blob(['test'])), /Entre novamente/);
  assert.equal(calls, 0);
});
test('duplicate submissions blocked and failed upload can be retried', async () => {
  let release; const c = client(() => new Promise(resolve => { release = resolve; }));
  const blob = new Blob(['test']); const first = c.requestAudioTranscript(blob);
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(c.requestAudioTranscript(blob), /Já existe/);
  release({ data: { error: 'temporário' } }); await assert.rejects(first, /temporário/);
  c.sb.functions.invoke = async () => ({ data: { text: 'Retry OK' } });
  assert.equal(await c.requestAudioTranscript(blob), 'Retry OK');
});
test('M4A file with empty MIME keeps its format', async () => {
  const c = client(async (_, { body }) => { assert.equal(body.mimeType, 'audio/mp4'); return { data: { text: 'ok' } }; });
  await c.requestAudioTranscript(new File(['test'], 'gravacao.M4A'));
});
test('404 and network failures explain missing function/CORS', async () => {
  const c = client();
  assert.match(await c.describeAIError({ context: reply({ message: 'Requested function was not found' }, 404) }), /HTTP 404.*Publique/);
  assert.match(await c.describeAIError({ message: 'Failed to send a request to the Edge Function' }), /OPTIONS\/CORS/);
});
for (const kind of ['evolution', 'report']) test(`${kind} upload retains recording after error and writes text on success`, async () => {
  const c = client(); const blob = new Blob(['test']); let text = '', status = '';
  Object.assign(c, { console: { error() {} }, applyAudioTranscript: (_, __, t) => { text = t; },
    setEvolutionAudioStatus: t => { status = t; }, setReportAudioStatus: t => { status = t; },
    updateEvolutionAudioButtons() {}, updateReportAudioButtons() {}, eText: { focus() {} },
  });
  vm.runInContext('let evolutionRecordedBlob, reportRecordedBlob;', c);
  c.testBlob = blob; vm.runInContext(`${kind}RecordedBlob=testBlob`, c);
  if (kind === 'evolution') vm.runInContext(html.slice(html.indexOf('async function sendEvolutionRecordingToAI('), html.indexOf('async function askEvolutionAI(')), c);
  else {
    vm.runInContext(html.slice(html.indexOf('async function sendReportRecordingToAI('), html.indexOf('async function handleReportAudioFile(')), c);
    vm.runInContext(html.slice(html.indexOf('async function transcribeReportAudio('), html.indexOf('function renderAttachPreview(')), c);
  }
  const send = kind === 'evolution' ? c.sendEvolutionRecordingToAI : c.sendReportRecordingToAI;
  c.requestAudioTranscript = async () => { throw new Error('falha simulada'); };
  await send(); assert.match(status, /falha simulada/); assert.equal(vm.runInContext(`${kind}RecordedBlob`, c), blob); assert.equal(text, '');
  c.requestAudioTranscript = async () => 'transcrição fictícia'; await send();
  assert.equal(text, 'transcrição fictícia'); assert.equal(vm.runInContext(`${kind}RecordedBlob`, c), null);
});
