import assert from 'node:assert/strict';
import test from 'node:test';
test('server renders calendar and navigation',async()=>{
 const {default:worker}=await import('../dist/server/index.js');
 const response=await worker.fetch(new Request('http://localhost/',{headers:{accept:'text/html'}}),{ASSETS:{fetch:async()=>new Response('Not found',{status:404})}},{waitUntil(){},passThroughOnException(){}});
 assert.equal(response.status,200);const html=await response.text();assert.match(html,/Turnos y boletas/);assert.match(html,/Calendario/);assert.match(html,/Consolidar período/);assert.doesNotMatch(html,/Pendiente de emitir|Pendiente de pago|Boleta pagada/);
});
