# Estado del proyecto

Actualizado: 2026-10-15.

## Estado actual

Se implementó el flujo de calendario de turnos y consolidación por institución y período. La especificación implementada, decisiones tomadas, pruebas y limitaciones actuales están en [Ajuste a calendario](ajuste-calendario-2026-10-14.md). Leer ese documento para continuar en un chat nuevo.

El ingreso anterior de líneas dentro de una boleta, su número y sus estados ya no corresponden a la interfaz actual. Las claves antiguas permanecen intactas. Se agregó localmente recuperación de esas boletas desde el navegador, con inicio a las 17:00 y sin reemplazar datos actuales. Los nuevos respaldos usan versión 3 y se siguen aceptando los de calendario versión 2. Ver [Recuperación anterior](recuperacion-version-anterior-2026-10-15.md).

La versión de calendario del commit `8f5f611` se publicó el 2026-10-14 en GitHub Pages, con [despliegue confirmado](https://github.com/Hector-xlsx/gestor-boletas-honorarios/actions/runs/38670721122). La recuperación añadida el 2026-10-15 se incluye en la publicación autorizada ese día mediante el mismo flujo de GitHub Pages. El botón debe utilizarse en el teléfono/navegador y dirección originales.

El flujo `Publish GitHub Pages` publica `github-pages-dist` al recibir cambios en `main`; consultar [GitHub Actions](https://github.com/Hector-xlsx/gestor-boletas-honorarios/actions/workflows/pages.yml).

Validación del calendario publicado: 25 pruebas de lógica, HTML del servidor, compilaciones Vinext y estática, lint de fuentes/pruebas afectadas y revisión de formato. El registro detallado conserva las limitaciones de TypeScript y del lint completo de archivos generados. No se cambió el dominio ni se eliminó el almacenamiento anterior. La migración a Sites mencionada abajo pertenece al antecedente histórico.

Validación de la recuperación: 35 pruebas de lógica, regresión en navegador aislado, fallos de almacenamiento y concurrencia simulados, compilaciones y lint afectado. Detalles en el documento de recuperación.

---

El siguiente contenido se conserva como antecedente de la implementación previa, con sus pruebas y pendientes históricos. No describe el estado actual.

# Registro histórico anterior al calendario

Actualizado: 2026-10-13.

## Estado confirmado

La aplicación está implementada como PWA con datos locales por navegador y dispositivo. La última versión de código registrada en esta revisión es `ad870bc` (Agregar respaldo y recuperacion de datos).

La publicación existente utiliza GitHub Pages:

- Repositorio: https://github.com/Hector-xlsx/gestor-boletas-honorarios
- Aplicación: https://hector-xlsx.github.io/gestor-boletas-honorarios/

La migración a GPT Sites fue solicitada y se preparó un prompt de traspaso en la conversación. No se ha ejecutado ni validado una migración a Sites desde este proyecto. La presencia de `.openai/hosting.json` no acredita una publicación en Sites; actualmente no contiene un `project_id`.

## Funciones realizadas

- Nueva boleta con institución, modalidad tributaria, fecha, estado, número y glosa.
- Líneas con fecha única o rango, tiempo total o por día, valor hora y comentario.
- Validación de tiempo y valor hora por línea, normalización de minutos y redondeo de montos.
- Cálculo de bruto, retención o PPM, neto y pago esperado desde la institución.
- Registro histórico con snapshots de los datos y cálculos utilizados, edición de los campos habilitados, duplicación y eliminación con confirmación.
- Filtros por institución histórica, modalidad y fechas de boleta o detalle, combinados mediante condición Y.
- Exportación XLSX de todos los registros, por rango o selección, con hojas Resumen y Detalle; compartir una boleta en dispositivos compatibles.
- Configuración de instituciones, valores hora y tasas anuales, con los iconos proporcionados por el usuario.
- Respaldo JSON y recuperación con vista previa tabular y tres modalidades.
- Nombre completo de instalación: Gestor de boletas de honorarios. Nombre corto: Boletas. Icono: `public/app.png`.

## Decisiones funcionales

El monto calculado desde las líneas corresponde al total honorarios bruto y al monto a ingresar en SII. Cada línea redondea su monto antes de sumar el bruto. El impuesto se redondea a partir del bruto y la tasa anual.

En Receptor retiene, el pago esperado es bruto menos retención. En Emisor paga PPM, el pago esperado es el bruto y el PPM se presenta por separado. Los registros guardados conservan su snapshot tributario para evitar que cambios en la configuración alteren sus montos históricos.

Los estados son Pendiente de emitir, Pendiente de pago y Boleta pagada. La aplicación ayuda a calcular y realizar seguimiento; no emite boletas en SII. El aviso correspondiente se muestra al guardar.

El respaldo conserva `rates`, `institutions`, `taxRates` e `invoices`, con identificador de formato `gestor-boletas-honorarios-backup`, versión `1` y fecha de generación. No incluye el borrador sin guardar, los filtros ni el estado temporal de la interfaz. El archivo JSON no está cifrado.

### Recuperación y duplicados

| Modalidad | Comportamiento implementado |
| --- | --- |
| Importar todo | Conserva registros actuales e incorpora todos los importados con nuevos IDs de boleta y de línea. |
| Importar sin duplicados | Busca primero el mismo ID; si el importado tiene una fecha de modificación posterior, lo reemplaza. En caso contrario, lo omite. |
| Reemplazar con respaldo | Sustituye registros y configuración por los del respaldo, aplicando la normalización de tasas. |

Cuando no coincide el ID, la comparación secundaria se aplica también a registros con IDs diferentes: número normalizado y año de la fecha de boleta; si no hay número, se usa institución normalizada, fecha de boleta, modalidad, día de creación, bruto y datos de las líneas ordenados. La huella no incluye glosa, comentarios ni estado.

Al combinar configuración, los valores hora coinciden por nombre normalizado y monto; las instituciones por nombre normalizado; las tasas por año. Se conserva la configuración local que ya coincide y se agregan los elementos faltantes. Reemplazar con respaldo vuelve a completar años mediante `normalizeTaxRates`, por lo que las tasas finales pueden incluir años adicionales al archivo.

## Publicación y mantenimiento

GitHub Pages publica el contenido ya compilado de `github-pages-dist` mediante `.github/workflows/pages.yml`. El flujo remoto no compila las fuentes. Después de cambios funcionales se debe generar `pnpm run build:pages`, conservar el archivo `.nojekyll` y publicar tanto fuentes como artefactos actualizados.

El código funcional principal está en `app/page.tsx`, los estilos en `app/globals.css` y los recursos PWA en `public/`. La entrada estática usa `github-pages/main.tsx` y `vite.pages.config.ts`, con base `/gestor-boletas-honorarios/`.

La caché del service worker se actualizó a `gestor-boletas-v2` al incorporar el respaldo. Esta caché es independiente de los registros de localStorage.

## Pruebas y evidencia

Estos resultados corresponden a la implementación anterior del respaldo, registrados en la conversación; no se volvieron a ejecutar durante esta actualización documental:

| Comprobación | Resultado registrado |
| --- | --- |
| TypeScript, `tsc --noEmit` | Correcto. |
| Compilación de aplicación, `vinext build` | Correcta. |
| Compilación estática, `vite build --config vite.pages.config.ts` | Correcta. |
| `git diff --check` | Sin errores de formato. |
| Página pública y recurso JavaScript publicado | HTTP 200; el JavaScript contenía la función de respaldo. |
| Service worker público | Contenía `gestor-boletas-v2`. |

`pnpm run build` encontró un problema del entorno local de pnpm, que intentó reinstalar dependencias y acceder a la red. La compilación se completó ejecutando el binario local de Vinext directamente.

No hay evidencia de pruebas completas de ida y vuelta con archivos de respaldo, de los tres modos de recuperación, fallos de almacenamiento o dispositivos físicos. La compilación y la presencia de textos en el archivo publicado no prueban esos comportamientos.

`tests/rendered-html.test.mjs` todavía comprueba la pantalla inicial de la plantilla, ya reemplazada. No representa una suite válida de regresión funcional para la aplicación actual. Su actualización queda pendiente.

En esta revisión documental se inspeccionaron README, código de deduplicación y recuperación, configuración de compilación estática, flujo de publicación y pruebas existentes. No se modificó código funcional ni se volvió a comprobar el sitio remoto.

## Limitaciones y riesgos pendientes

- Los datos no se sincronizan entre dispositivos ni se trasladan automáticamente al cambiar de dominio; la migración de datos requiere generar e importar un respaldo.
- Dos registros legítimos con número y año iguales pueden coincidir aunque tengan distinto ID. La aplicación presupone uso personal, sin identificar al emisor.
- La huella de registros sin número puede omitir uno distinto si solo cambia glosa, comentario o estado. Estas reglas deben probarse antes de considerarlas suficientes para todos los casos.
- Las fechas de modificación se comparan como cadenas y dependen del reloj del dispositivo. El importador no valida exhaustivamente todos los campos, límites, IDs repetidos o consistencia de snapshots.
- La recuperación escribe cuatro claves de localStorage por separado y trata de restaurar los valores anteriores si falla. No es una transacción atómica; el propio rollback también puede fallar. Debe probarse ante cuota o acceso denegado.
- Los snapshots ausentes o incompletos se completan al importar mediante tasas del archivo; esto puede reconstruir cálculos en vez de preservar literalmente el contenido original.
- La descarga, compartir archivos, instalación y disponibilidad sin conexión dependen del navegador y requieren validación en los teléfonos objetivo. El respaldo se genera a petición; no existe respaldo automático.

## Siguiente paso: migración a GPT Sites

1. Generar un respaldo desde la aplicación actual y conservar una copia externa antes de probar la migración.
2. Entregar en GPT web el prompt de migración preparado, junto con ambos enlaces. Si no puede leer el repositorio completo, adjuntar su ZIP.
3. Usar la rama `main` como fuente de verdad funcional y la página publicada como referencia visual. Conservar recursos, fórmulas, redondeos, snapshots y contrato JSON versión 1; adaptar rutas y service worker al nuevo alojamiento.
4. Probar el respaldo original en la nueva aplicación, volver a exportarlo y comparar datos, IDs, fechas y cálculos. Validar las tres modalidades con datos de prueba antes de restaurar registros reales.
5. Comprobar ambas modalidades tributarias, períodos, filtros, Excel, instalación y uso sin conexión en escritorio y teléfono. Registrar las diferencias que Sites no permita resolver.
6. Decidir el cambio de dirección después de verificar la equivalencia. Mantener disponible el sitio anterior y el respaldo durante la transición.

La migración debe conservar el almacenamiento personal local. Cuentas, sincronización web o cambios de reglas funcionales requieren una decisión adicional; no forman parte del traspaso acordado.
