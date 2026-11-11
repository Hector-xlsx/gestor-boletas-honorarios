// Browser integration for legacy recovery; uses synthetic data in isolated storage.
import assert from 'node:assert/strict';
import {initialData} from '../app/turnos.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const legacyEntry={id:'e1',startDate:'2026-09-15',endDate:'2026-09-15',timeMode:'single',daysCount:1,hours:8,minutes:0,hoursPerDay:0,minutesPerDay:0,valueName:'Turno general',valueAmount:10000,comment:'Comentario anterior'};
const legacyInvoice={id:'old-a',createdAt:'2026-10-14T15:00:00Z',institutionName:'CESFAM MAIPO',invoiceTaxType:'receptor_retiene',entries:[legacyEntry],invoiceNumber:'123',invoiceDate:'2026-10-20',gloss:'Glosa',taxRateUsed:15.25,totalHonorarios:80000,retencion:12200,ppm:0,pagoDesdeReceptor:67800,netoDespuesImpuesto:67800};
const legacy=[legacyInvoice,{...legacyInvoice,id:'old-b',invoiceNumber:'124',entries:[{...legacyEntry,timeMode:'perDay',startDate:'2026-09-01',endDate:'2026-09-02',daysCount:2,hoursPerDay:1,minutesPerDay:15}],totalHonorarios:25000,retencion:3813,pagoDesdeReceptor:21187,netoDespuesImpuesto:21187},{...legacyInvoice,id:'bad',totalHonorarios:1}];
const seed=initialData();seed.userName='Prueba';seed.userRut={number:'0000000',verifier:'K'};
seed.rates.push({id:'sin-cobro',name:'Turno sin cobro',amount:0,noCharge:true});
seed.shifts=[{id:'current',start:'2026-10-15T17:00',end:'2026-10-15T20:00',institutionId:'maipo',rateId:'general',rateName:'Turno general',amount:10000,noCharge:false,comment:'Conservar',reviewed:true}];
const {mkdtemp,readFile}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 await context.addInitScript(({seed,legacy})=>{
  if(!localStorage.getItem('test-legacy-initialized')){localStorage.setItem('cobro-horas-calendar-v2',JSON.stringify(seed));localStorage.setItem('cobro-horas-invoices',JSON.stringify(legacy));localStorage.setItem('cobro-horas-tax-rates',JSON.stringify([{year:2026,rate:15.25}]));localStorage.setItem('test-legacy-initialized','1');}
  const save=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='cobro-horas-calendar-v2'&&window.testQuotaFailure)throw new DOMException('Quota','QuotaExceededError');return save.call(this,key,value);};
 },{seed,legacy});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.APP_URL||'http://localhost:3000/');await page.waitForFunction(()=>!document.querySelector('.calendar-header button').disabled);
 await page.getByRole('button',{name:'Configuración',exact:true}).click();
 const button=page.getByRole('button',{name:'Recuperar datos de la versión anterior',exact:true});await button.click();
 let dialog=page.getByRole('dialog',{name:'Recuperar datos de la versión anterior',exact:true});assert.equal(await dialog.locator('tbody tr').count(),2);assert.match(await dialog.innerText(),/17:00/);assert.match(await dialog.getByRole('alert').innerText(),/Boleta anterior 3/);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cobro-horas-calendar-v2')).shifts.length),1);
 await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cobro-horas-calendar-v2')).shifts.length),1);
 // Detect another tab changing current data between preview and confirmation.
 await button.click();await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('cobro-horas-calendar-v2'));d.userName='Actualizado';localStorage.setItem('cobro-horas-calendar-v2',JSON.stringify(d));});await dialog.getByRole('button',{name:'Recuperar 2 boletas',exact:true}).click();assert.match(await dialog.innerText(),/Los datos cambiaron/);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cobro-horas-calendar-v2')).shifts.length),1);await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
 await button.click();
 // A failed save must retain both the original keys and the current calendar.
 await page.evaluate(()=>{window.testQuotaFailure=true;});await dialog.getByRole('button',{name:'Recuperar 2 boletas',exact:true}).click();assert.match(await dialog.innerText(),/Quota/);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cobro-horas-calendar-v2')).shifts.length),1);await page.evaluate(()=>{window.testQuotaFailure=false;});await dialog.getByRole('button',{name:'Recuperar 2 boletas',exact:true}).click();
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('cobro-horas-calendar-v2')));assert.equal(stored.shifts.length,4);assert.equal(stored.closings.length,2);assert.equal(stored.shifts.find(s=>s.id==='current').comment,'Conservar');assert.equal(stored.userName,'Actualizado');assert.equal(stored.shifts.find(s=>s.id.startsWith('legacy-v1:old-a')).start,'2026-09-15T17:00');assert.equal(stored.shifts.find(s=>s.id.startsWith('legacy-v1:old-a')).end,'2026-09-16T01:00');assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('cobro-horas-invoices'))),legacy);
 await page.getByRole('button',{name:'Configuración',exact:true}).click();await button.click();assert.match(await dialog.innerText(),/2 ya se habían recuperado/);assert.equal(await dialog.getByRole('button',{name:'Recuperar 0 boletas',exact:true}).isDisabled(),true);await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
 const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar respaldo',exact:true}).click();const download=await downloadEvent,dir=await mkdtemp(join(tmpdir(),'legacy-recovery-'));await download.saveAs(join(dir,'backup.json'));const backup=JSON.parse(await readFile(join(dir,'backup.json'),'utf8'));assert.equal(backup.version,3);assert.deepEqual(backup.data.legacyImportedInvoiceIds,['old-a','old-b']);
 await page.reload();await page.waitForFunction(()=>!document.querySelector('.calendar-header button').disabled);await page.getByRole('button',{name:'Boletas',exact:true}).click();assert.equal(await page.locator('.closing-card').count(),2);
 // Empty origin: explain where recovery has to run; nothing is written.
 const empty=await browser.newContext();await empty.addInitScript(seed=>localStorage.setItem('cobro-horas-calendar-v2',JSON.stringify(seed)),seed);const p=await empty.newPage();await p.goto(process.env.APP_URL||'http://localhost:3000/');await p.waitForFunction(()=>!document.querySelector('.calendar-header button').disabled);await p.getByRole('button',{name:'Configuración',exact:true}).click();await p.getByRole('button',{name:'Recuperar datos de la versión anterior',exact:true}).click();const emptyDialog=p.getByRole('dialog',{name:'Recuperar datos de la versión anterior',exact:true});assert.match(await emptyDialog.innerText(),/mismo dispositivo/);assert.equal(await emptyDialog.getByRole('button',{name:'Recuperar 0 boletas',exact:true}).isDisabled(),true);
 assert.deepEqual(errors,[]);console.log('LEGACY UI OK: vista previa, cancelación, importación 17:00, cuotas, concurrencia, datos originales, persistencia, respaldo y duplicados.');
}finally{await browser.close();}
