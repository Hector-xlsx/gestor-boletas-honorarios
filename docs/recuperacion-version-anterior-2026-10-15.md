# Recuperación de datos del navegador anterior

Fecha: 2026-10-15. Recuperación publicada en GitHub Pages en el commit `6441f94`. El [despliegue 38678806354](https://github.com/Hector-xlsx/gestor-boletas-honorarios/actions/runs/38678806354) terminó correctamente. Aplicación: [Gestor de boletas de honorarios](https://hector-xlsx.github.io/gestor-boletas-honorarios/).

## Uso

En Configuración → Respaldo y recuperación → **Recuperar datos de la versión anterior**.

El botón lee `cobro-horas-invoices` y `cobro-horas-tax-rates` del almacenamiento del mismo origen. No requiere JSON. Presenta las boletas encontradas, los turnos que generará, horas y bruto, registros ya recuperados y problemas que requieren revisión. Solo incorpora al confirmar. Cancelar no escribe datos.

Debe utilizarse en el mismo dispositivo, navegador y dirección donde se usó la aplicación anterior. `localhost`, GitHub Pages, otros navegadores y los modos privados no comparten datos. Que se haya actualizado la aplicación no prueba que se haya borrado su almacenamiento; la recuperación depende de que las claves antiguas todavía existan. No se han inspeccionado ni recuperado los datos reales del teléfono de la usuaria durante esta implementación.

## Conversión acordada

- Todos los turnos recuperados empiezan a las **17:00** por indicación explícita del usuario.
- Se suman las horas y minutos guardados para obtener fecha y hora de término, incluyendo medianoche y cambios de mes/año.
- Una línea «por día» genera un turno a las 17:00 por cada fecha del rango. Se comprueba que el número de días coincida con el registro anterior.
- Una línea de rango con **tiempo total** conserva todo ese tiempo en un turno que comienza el primer día del rango. La vista previa lo advierte expresamente; no se reparte entre días sin datos. La boleta conserva el rango original.
- Las boletas recuperadas aparecen como consolidadas y sus turnos quedan asociados; no vuelven a contarse como pendientes. El nombre utiliza el número anterior cuando existe, o su fecha.
- Se preservan institución, tipo/nombre y valor hora, comentarios, glosa, bruto y tasa tributaria. La fecha de consolidación es la fecha local de creación original; si falta, se conserva la fecha de boleta y se advierte.
- Se reutilizan instituciones coincidentes por nombre y valores coincidentes por nombre/monto. Los faltantes se agregan sin modificar configuración existente.
- Para redondeos de líneas por día se reparte el monto mediante redondeo acumulado. El total coincide exactamente con la línea original, sin concentrar ajustes negativos en el último turno. Si un turno requiere un monto distinto del cálculo individual, `importedAmount` conserva el monto y sus parámetros de duración/valor originales. Se muestra una indicación en su detalle. Una corrección de duración, valor o condición sin cobro vuelve a calcularlo; moverlo de fecha sin cambiar su duración conserva el redondeo.
- Si un snapshot guardado de bruto/impuestos no coincide con las líneas, o los datos son inválidos, se omite esa boleta completa y se informa. Las boletas válidas sí pueden recuperarse. Nunca se altera el origen para corregir inconsistencias.

## Preservación y duplicados

Las claves originales se leen, pero nunca se modifican ni eliminan. La operación agrega turnos y boletas al estado actual, conservando su perfil y registros existentes. Toda la incorporación y el registro de IDs recuperados se guardan en una sola escritura de la clave actual. Si falla la escritura, la vista previa permanece y el estado previo se conserva.

`legacyImportedInvoiceIds` impide recuperar otra vez una boleta del mismo origen, incluso si después se corrigen sus turnos o se elimina su cierre. Los IDs deterministas evitan colisiones. Esto no intenta reconocer registros que se hayan transcrito manualmente con otros IDs: la vista previa permite revisar antes de incorporar.

Si los datos actuales o los datos antiguos cambian entre la vista previa y la confirmación, se bloquea la operación y se pide volver a revisarla. Se puede descargar un respaldo actual desde la misma ventana antes de confirmar.

## Respaldo y compatibilidad

La clave de almacenamiento actual se conserva (`cobro-horas-calendar-v2`) para no perder acceso a lo existente. Los nuevos archivos de respaldo usan **versión 3**, porque incorporan la semántica de montos recuperados y el registro de importaciones. Se siguen aceptando archivos de calendario versión 2. Los archivos versión 1 no se importan mediante el selector de respaldos; para esta entrega el origen es el almacenamiento anterior del navegador, como pidió el usuario.

Los respaldos y los tres modos de recuperación conservan los metadatos de redondeo y los IDs ya recuperados. No se cambió la URL pública ni se agregaron cuentas, sincronización o dependencias.

## Pruebas

- 35/35 pruebas de lógica: 25 existentes y 10 de recuperación.
- Conversión 17:00, minutos, turnos nocturnos, cambio de año, líneas por día y totales de rango, bruto/impuestos, configuración intacta, boletas inválidas, duplicados, respaldo y redondeos.
- Navegador aislado, 390 px: vista previa, cancelar sin escribir, confirmar, conservación de datos actuales y originales, persistencia tras recarga, prevención de importaciones repetidas y descarga de respaldo versión 3.
- Simulación de cuota agotada: no se alteró el calendario ni el origen y se pudo reintentar.
- Simulación de otra pestaña modificando datos: la confirmación se bloqueó sin sobrescribir cambios.
- Origen vacío: mensaje explicativo y recuperación deshabilitada.
- Regresión completa de calendario, consolidación, perfil, exportación Excel, recuperación JSON y apertura de respaldo versión 2.
- Compilación Vinext, HTML del servidor, compilación estática y lint de los archivos afectados correctos.
- `tsc --noEmit` conserva los dos errores preexistentes de `build/sites-vite-plugin.ts`; no reportó errores nuevos de este ajuste.

Verificación posterior a la publicación, el 2026-10-15: la prueba `tests/legacy-recovery-ui.mjs` pasó contra la URL pública con datos ficticios en un contexto aislado. Comprobó vista previa, cancelación, importación a las 17:00, cuota, concurrencia, conservación del origen y del calendario existente, persistencia, respaldo y prevención de duplicados. La página y el service worker respondieron HTTP 200; el HTML referenció `index-D9meCPDF.js` y el service worker contenía `gestor-boletas-calendar-v4`. No se alteró el almacenamiento del navegador del usuario.

Comandos de pruebas de lógica:

```powershell
node --experimental-strip-types --test tests/turnos.test.mjs tests/legacy-recovery.test.mjs
```

La prueba opcional `tests/legacy-recovery-ui.mjs` usa Playwright externo (variable `PLAYWRIGHT_MODULE`) y el servidor local, o `APP_URL`. Usa solo datos ficticios en almacenamiento aislado. No escribe datos reales del usuario.

## Archivos y siguiente paso

`app/legacy-recovery.ts`, `app/turnos.ts`, `app/page.tsx`, `app/globals.css`, `package.json`, pruebas, README, documentación y artefactos `github-pages-dist`.

La actualización ya está publicada mediante el flujo de GitHub Pages, que sube `github-pages-dist` sin compilar fuentes. Se conservaron `.nojekyll`, la URL y las claves anteriores. Para revertir el código publicado se puede revertir el commit de entrega y desplegar los artefactos anteriores; eso no deshace una importación ya confirmada en un navegador. Antes de recuperar datos reales, descargar el respaldo actual disponible en la vista previa.

El siguiente paso es abrir el botón en el teléfono y en la instalación/dirección original. Revisar la vista previa antes de confirmar. La existencia y recuperabilidad de sus datos reales solo se puede comprobar en ese navegador. No se requiere un archivo JSON antiguo para este flujo; si las claves originales ya no existen, el botón no puede reconstruirlas.
