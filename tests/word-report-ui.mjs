import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { find, read } from 'cfb';
import { initialData } from '../app/turnos.ts';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const data = { ...initialData(), userName: 'Prueba', userRut: { number: '0000000', verifier: '0' } };
for (const template of ['turno', 'apoyo', 'otra']) {
  data.institutions.push({ id: template, name: template, institutionName: 'CESFAM MAIPO',
    invoiceTaxType: 'receptor_retiene', reportTemplate: template === 'otra' ? undefined : template });
  const ids = [];
  for (const [index, start, end, amount] of [[1, '08:00', '11:00', 22170], [2, '14:00', '17:00', 33255]]) {
    const id = `${template}-${index}`;
    ids.push(id);
    data.shifts.push({ id, start: `2026-10-29T${start}`, end: `2026-10-29T${end}`,
      rateId: 'general', rateName: 'Turno general', institutionId: template, amount, noCharge: false, comment: '' });
  }
  data.closings.push({ id: template, name: `Boleta ${template}`, institutionId: template,
    institutionName: 'CESFAM MAIPO', from: '2026-10-16', to: '2026-11-15', date: '2026-11-12',
    taxType: 'receptor_retiene', taxRate: 15.25, shiftIds: ids, exceptions: [] });
}

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage();
  await page.addInitScript(data => {
    const key = 'cobro-horas-version-2-trial';
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ id: 'report-test', data }));
  }, data);
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:3000/');
  await page.waitForFunction(() => document.querySelector('.calendar-header button:enabled'));
  await page.getByRole('button', { name: 'Configuración', exact: true }).click();
  await page.getByText('Datos', { exact: true }).click();
  await page.getByLabel('Nombre completo').fill('Persona & Prueba');
  await page.getByLabel('Estamento u oficio').fill('Profesional');
  await page.getByLabel('Sector donde ejecuta la prestación').fill('Sector de prueba');
  await page.getByRole('button', { name: 'Guardar datos del prestador' }).click();
  await page.getByRole('button', { name: 'Boletas', exact: true }).click();

  for (const [index, template] of ['turno', 'apoyo', 'otra'].entries()) {
    await page.getByRole('button', { name: 'Ver detalle' }).nth(index).click();
    const detail = page.getByRole('dialog', { name: `Boleta ${template}` });
    const generate = detail.getByRole('button', { name: 'Generar Word' });
    if (template === 'otra') {
      assert.equal(await generate.count(), 0);
    } else {
      if (template === 'apoyo') {
        await detail.getByLabel('N.º oficial de boleta').fill('00482');
        await detail.getByRole('button', { name: 'Guardar número' }).click();
      }
      const [download] = await Promise.all([page.waitForEvent('download'), generate.click()]);
      const file = await readFile(await download.path());
      const archive = read(file, { type: 'buffer' });
      const xml = Buffer.from(find(archive, '/word/document.xml').content).toString();
      assert.equal((xml.match(/29\/10\/2026/g) ?? []).length, 1);
      assert.match(xml, /166\.275/);
      assert.match(xml, /16\/10\/2026 al 15\/11\/2026/);
      assert.match(xml, /Persona &amp; Prueba/);
      assert.match(xml, /<w:t>6<\/w:t>/);
      assert.ok(!xml.includes('{{'));
      assert.equal(xml.includes('00482'), template === 'apoyo');
      assert.match(xml, template === 'turno' ? /PRAPS SUR/ : /PRAPS Salud Respiratoria/);
      if (process.env.WORD_REPORT_TEST_DIR) {
        await mkdir(process.env.WORD_REPORT_TEST_DIR, { recursive: true });
        await download.saveAs(join(process.env.WORD_REPORT_TEST_DIR, `${template}.docx`));
      }
    }
    if (await detail.isVisible()) await page.keyboard.press('Escape');
  }
  console.log('Chrome: plantillas, datos, agrupación diaria y folio opcional verificados.');
} finally {
  await browser.close();
}
