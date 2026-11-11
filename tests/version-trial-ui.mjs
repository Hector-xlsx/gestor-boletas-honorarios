import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialData } from '../app/version-1/turnos.ts';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const backupPath = process.env.VERSION_TRIAL_BACKUP;
const data = { ...initialData(), userName: 'Prueba', userRut: { number: '0000000', verifier: '0' } };
data.shifts.push({ id: 'pendiente', start: '2026-10-29T08:00', end: '2026-10-29T11:00',
  institutionId: 'maipo', rateId: 'general', rateName: 'Turno general', amount: 22170, noCharge: false, comment: '' });
const stable = 'cobro-horas-calendar-v2';
const trial = 'cobro-horas-version-2-trial';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  await page.addInitScript(({ stable, data }) => {
    if (!localStorage.getItem(stable)) localStorage.setItem(stable, JSON.stringify(data));
  }, { stable, data });
  await page.goto(process.env.APP_URL || 'http://localhost:3000/');
  const settings = async () => {
    await page.waitForFunction(() => document.querySelector('.calendar-header button:enabled'));
    await page.getByRole('button', { name: 'Configuración', exact: true }).click();
    await page.getByRole('heading', { name: 'Configuración', exact: true }).waitFor();
  };
  const snapshot = () => page.evaluate(({ stable, trial }) => ({
    stable: localStorage.getItem(stable),
    trial: JSON.parse(localStorage.getItem(trial)),
  }), { stable, trial });
  const advance = 'Pasar a la versión 2';
  const returnToStable = 'Volver a la versión 1';
  async function openChange(name) {
    await page.getByRole('button', { name, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `¿${name}?` });
    assert.match(await dialog.innerText(), /descartar/);
    return dialog;
  }
  async function confirmChange(name) {
    await (await openChange(name)).getByRole('button', { name, exact: true }).click();
  }

  await settings();
  if (backupPath) {
    await page.locator('input[type=file]').setInputFiles({
      name: 'respaldo.json', mimeType: 'application/json', buffer: readFileSync(backupPath),
    });
    const restore = page.getByRole('dialog', { name: 'Recuperar respaldo' });
    await restore.waitFor().catch(async error => {
      const alerts = await page.getByRole('alert').allTextContents();
      throw new Error(alerts.join(" ") || error.message);
    });
    await restore.getByRole('combobox').selectOption('replace');
    await restore.getByRole('button', { name: 'Confirmar recuperación' }).click();
    assert.equal(await restore.isVisible(), false,
      (await page.getByRole('alert').allTextContents()).join(" "));
    const imported = JSON.parse((await snapshot()).stable);
    const expected = JSON.parse(readFileSync(backupPath, 'utf8')).data;
    assert.deepEqual(imported.shifts, expected.shifts);
    assert.deepEqual(imported.closings, expected.closings);
  }
  const before = await snapshot();
  const original = JSON.parse(before.stable);
  function checkCatalog(current) {
    assert.deepEqual(current.shifts, original.shifts.map(({ reviewed, ...shift }) =>
      original.closings.some(c => c.shiftIds.includes(shift.id)) && reviewed ? { ...shift, reviewed } : shift));
    assert.deepEqual(current.closings, original.closings);
    for (const name of ['Turno', 'Apoyo']) {
      const category = current.institutions.find(i => i.name === name && !i.archived);
      assert.ok(category);
      assert.equal(category.institutionName, 'CESFAM MAIPO');
      assert.equal(category.legacyCategory, undefined);
      assert.deepEqual(current.rates.filter(r => r.categoryId === category.id).map(r => [r.name, r.amount]),
        [['Estándar', 22170], ['Estándar ×1,5', 33255], ['Domingo', 25670]]);
    }
  }
  assert.equal(before.trial, null);
  await (await openChange(advance)).getByRole('button', { name: 'Cancelar' }).click();
  assert.deepEqual(await snapshot(), before);
  await confirmChange(advance);

  const update = page.getByRole('dialog', { name: 'Actualizamos la aplicación' });
  const activated = (await snapshot()).trial.data;
  checkCatalog(activated);
  if (!backupPath) {
    await update.getByRole('button', { name: 'Revisar turnos' }).click();
    await page.locator('details').filter({ hasText: 'Turnos pendientes de revisión' })
      .getByRole('button', { name: 'Editar', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Editar turno' });
    const category = activated.institutions.find(i => i.name === 'Apoyo');
    const categories = editor.getByLabel('Tipo de boleta');
    assert.deepEqual((await categories.locator('option').allTextContents()).map(label => label.trim()), [
      'Selecciona tipo de boleta', 'CESFAM MAIPO', 'Turno (recomendado)', 'Apoyo (recomendado)',
    ]);
    await categories.selectOption(category.id);
    const choices = editor.getByLabel('Nombre turno');
    assert.equal(await choices.locator('option').count(), 4);
    assert.equal(await choices.inputValue(), '');
    await choices.selectOption(activated.rates.find(r => r.categoryId === category.id && r.name === 'Estándar').id);
    await editor.getByRole('button', { name: 'Guardar turno' }).click();
    await editor.waitFor({ state: 'hidden' });
    const [classified] = (await snapshot()).trial.data.shifts;
    assert.equal(classified.institutionId, category.id);
    assert.equal(classified.amount, data.shifts[0].amount);
    assert.equal(classified.reviewed, true);
  } else if (await update.isVisible()) {
    await update.getByRole('button', { name: 'Entendido' }).click();
  }
  await settings();
  if (!backupPath) {
    const cards = page.locator('.invoice-type-card > summary > strong');
    assert.deepEqual(await cards.allTextContents(), [
      'Turno (recomendado)', 'Apoyo (recomendado)', '⚠️ Tipo de boleta incompleto (antigua institución: CESFAM MAIPO)',
    ]);
    assert.match(await page.locator('.invoice-type-card > summary').last().innerText(), /Se sugiere combinar con Turno o Apoyo/);
  }
  await page.getByRole('button', { name: 'Crear nuevo tipo de boleta', exact: true }).click();
  const newCategory = page.getByRole('dialog', { name: 'Crear nuevo tipo de boleta' });
  await newCategory.getByLabel('Nombre del tipo de boleta').fill('Prueba descartable');
  await newCategory.getByRole('button', { name: 'Crear tipo de boleta', exact: true }).click();
  assert.ok((await snapshot()).trial.data.institutions.some(i => i.name === 'Prueba descartable'));

  await page.reload();
  if (await update.isVisible()) await update.getByRole('button', { name: 'Entendido' }).click();
  await settings();
  assert.equal(await page.locator('summary').filter({ hasText: 'Prueba descartable' }).count(), 1);
  const back = await openChange(returnToStable);
  assert.equal(await back.getByRole('button', { name: 'Descargar respaldo' }).count(), 0);
  await back.getByRole('button', { name: 'Cancelar' }).click();
  assert.ok((await snapshot()).trial);
  await confirmChange(returnToStable);
  assert.deepEqual(await snapshot(), before);
  await settings();
  await confirmChange(advance);
  checkCatalog((await snapshot()).trial.data);
  console.log('Chrome: entrada voluntaria, cancelación, persistencia, regreso y nuevo intento verificados.');
} finally {
  await browser.close();
}
