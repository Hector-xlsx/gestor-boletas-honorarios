# Estado del proyecto

Actualizado el 12 de noviembre de 2026.

## Estado actual

La aplicación local abre en la versión 1 (base `6441f94`). Al final de
Configuración se puede confirmar el paso a la versión 2, que usa una copia
de los datos del navegador. Al confirmar el regreso se descarta esa copia
y se recupera el estado de la versión 1 previo al cambio. La selección
persiste al recargar. Una nueva prueba parte de los datos vigentes en la
versión 1. La versión 2 está disponible en la rama de revisión
`codex/version-2-local`. La publicación para teléfonos sigue pendiente.

La versión 2 local consolida turnos por **tipo de boleta** y período. Cada
tipo de boleta tiene nombre, institución y modalidad tributaria predeterminada.
La tasa se toma de la configuración anual y queda guardada en la boleta.
Cada tipo de turno pertenece a un tipo de boleta. En el calendario se elige
primero el tipo de boleta y después uno de los tipos de turno de esa categoría.

Las categorías heredadas aparecen al final de **Configuración → Tipos de
boleta** con el aviso «⚠️ Tipo de boleta incompleto (antigua institución:
…)» y la sugerencia de combinarlas con Turno o Apoyo.
**Combinar** reclasifica los turnos abiertos del tipo o categoría de origen y
conserva sus horarios, valores hora y montos. Las referencias de las boletas
cerradas se conservan aunque el origen deje de ofrecerse para turnos nuevos.

**Turnos sin boleta** agrupa por tipo de turno. La vista simple muestra el
inicio y la duración, y la avanzada añade el término y el monto. Los turnos a
$0 requieren confirmación, se pueden consolidar y suman a la línea de horas
sin cobro. Los respaldos nuevos usan versión 5 y se pueden importar las
versiones 2, 3 y 4.

El calendario abre en **Período actual**. Parte el lunes de la primera
semana del ciclo pendiente más antiguo y muestra hasta seis semanas. Un
turno sin asignar cuya fecha ya está cubierta por una boleta de su mismo
tipo sigue disponible para revisión. Para elegir el ciclo inicial se
consideran los turnos pendientes cuya fecha aún no está cubierta.
**Consolidar período** precarga el rango que muestra la vista.

Configuración separa **Período habitual**, **Tipos de boleta**, **Tasas
anuales**, **Respaldo y recuperación** y **Datos**. Al alternar con Calendario
se conservan los desplegables, la posición y el período que se estaba
viendo durante la sesión. Los tipos de boleta y de turno muestran un
resumen y se crean o editan en ventanas. El pin junto al nombre marca el
tipo de boleta predeterminado.

Los contadores distinguen turnos sin boleta del período en curso, turnos
en boletas cerradas y pendientes de otros períodos. En cada tipo de boleta
se pueden abrir los tres listados y editar registros desde ahí. Si un tipo
solo tiene historial, se archiva al retirarlo de Configuración. Los turnos
sin boleta de cualquier período bloquean el retiro.

**Importar sin duplicados** conserva los turnos y boletas locales y agrega
los IDs que faltan. **Importar todo como copias nuevas** genera nuevos IDs.
**Reemplazar todos los datos con el respaldo** deja los datos del archivo
en la versión activa, incluida su configuración.

En Windows, `Iniciar servidor.cmd` usa `http://127.0.0.1:3000/` y abre
Chrome con el perfil dedicado `work/chrome-local`. La base cargada se
conserva en el almacenamiento del navegador de ese perfil. `work/` está
excluido de Git. Se verificó que la copia de los 45 turnos, 5 boletas y 6
categorías se conserva al cerrar y reabrir Chrome.

El lanzador usa `work/runtime/node.exe` para funcionar desde el
Explorador, incluso si Windows no tiene Node en el PATH. Si falta ese
archivo, usa Node.js 22.13 o posterior desde el PATH.

Pasaron 40 pruebas de lógica, la compilación Vinext y la prueba del HTML.
En Chrome con perfiles aislados se probaron la transición voluntaria,
el regreso a la versión 1, la importación de respaldo, el calendario,
la edición de tipos y los contadores. Queda pendiente validar el flujo
en teléfonos físicos antes de publicar la versión 2.

## Transición en la versión local

- **Categorías preparadas.** Al activar la versión 2 se habilitan Turno y
  Apoyo con institución CESFAM MAIPO. Cada categoría trae tres tarifas
  editables: Estándar ($22.170/h), Estándar ×1,5 ($33.255/h) y Domingo
  ($25.670/h). La elección del tipo es manual. Ambas categorías llevan
  «(recomendado)» en Configuración y en el selector al editar un turno
  pendiente de revisión.
- **Revisión de turnos abiertos.** Aparecen con ⚠️ en el calendario y
  en una lista separada al consolidar. Se habilitan para consolidar al
  guardarlos con un tipo de turno configurado. El guardado conserva los
  horarios y montos registrados salvo que el usuario los edite. Las boletas
  cerradas y sus turnos se conservan durante la transición.
- **Aviso al abrir la app.** Aparece mientras queden turnos abiertos por
  revisar. **Revisar turnos** abre la lista para clasificarlos.

En una copia aislada del respaldo original, la aplicación mostró seis turnos
abiertos por revisar y conservó intactos los 45 turnos y las cinco boletas
guardadas al abrirla. También se comprobó la creación del primer tipo de
boleta y la asignación de un tipo de turno cuando no hay grupos configurados.

La programación recurrente queda para una etapa posterior.

## Informes Word de prestaciones

En **Configuración → Datos → Datos del prestador** se guardan el nombre
completo, el estamento u oficio y el sector. El RUN se toma del RUT del
perfil. Tras consolidar, **Boletas → Ver detalle → Generar Word** descarga
un informe editable. El número oficial se puede guardar en el mismo
detalle y queda en blanco en el informe hasta que se ingrese.

Turno usa la plantilla PRAPS SUR y Apoyo usa PRAPS Salud Respiratoria –
Fortalecimiento APS. La asociación se guarda en la categoría al activar
la versión 2 y se conserva al renombrarla. Las sesiones existentes
adquieren la asociación al cargar si el nombre, la institución y los
tipos de turno permiten reconocer de forma inequívoca la categoría
original. Las plantillas del repositorio están libres de datos de
prestadores, firmas y registros del mes de ejemplo.

El período del informe usa las fechas Desde y Hasta guardadas al
consolidar. Cada fila agrupa todos los turnos incluidos en esa boleta
con la misma fecha de inicio. Las horas son la suma de sus duraciones y
el monto es la suma de sus importes, con los recargos y redondeos de la
aplicación. Un turno nocturno se informa bajo su fecha de inicio. Las
horas totales se calculan desde los minutos reales del período.

La prueba `tests/word-report-ui.mjs` verifica ambos informes, el número
opcional y la agrupación de tramos separados el mismo día. Las descargas
se probaron en Chrome desde la compilación estática y se revisaron en
Microsoft Word con datos ficticios.

## Última versión publicada

Se implementó el flujo de calendario de turnos y consolidación por institución y período. La especificación implementada, decisiones tomadas, pruebas y limitaciones actuales están en [Ajuste a calendario](ajuste-calendario-2026-10-14.md). Leer ese documento para continuar en un chat nuevo.

El ingreso anterior de líneas dentro de una boleta, su número y sus estados ya no corresponden a la interfaz actual. Las claves antiguas permanecen intactas. Está publicada la recuperación de esas boletas desde el navegador, con inicio a las 17:00 y sin reemplazar datos actuales. Los nuevos respaldos usan versión 3 y se siguen aceptando los de calendario versión 2. Ver [Recuperación anterior](recuperacion-version-anterior-2026-10-15.md).

La versión de calendario del commit `8f5f611` se publicó el 2026-10-14 en GitHub Pages, con [despliegue confirmado](https://github.com/Hector-xlsx/gestor-boletas-honorarios/actions/runs/38670721122). La recuperación se publicó el 2026-10-15 en el commit `6441f94`, con [despliegue completado correctamente](https://github.com/Hector-xlsx/gestor-boletas-honorarios/actions/runs/38678806354). El botón debe utilizarse en el teléfono/navegador y dirección originales.

También están publicados los ajustes de ventanas centradas, institución predeterminada mediante pin, nombres de turno con horarios predeterminados, aviso de término al día siguiente, tasas anuales plegables, resumen de horas sin boleta plegable por institución y perfil bajo «Datos» con edición consecutiva de nombre y RUT. El nombre se normaliza con inicial mayúscula y resto minúsculo. La bienvenida ocupa la pantalla con fondo blanco translúcido durante 2–3 segundos aleatorios; el perfil indicado recibe uno de 15 saludos equiprobables y los demás el saludo estándar. El RUT se valida por formato, sin cálculo de módulo 11. Los detalles y pruebas de estas iteraciones están en el documento del calendario.

El flujo `Publish GitHub Pages` publica `github-pages-dist` al recibir cambios en `main`; consultar [GitHub Actions](https://github.com/Hector-xlsx/gestor-boletas-honorarios/actions/workflows/pages.yml).

Validación del calendario publicado: 25 pruebas de lógica, HTML del servidor, compilaciones Vinext y estática, lint de fuentes/pruebas afectadas y revisión de formato. El registro detallado conserva las limitaciones de TypeScript y del lint completo de archivos generados. No se cambió el dominio ni se eliminó el almacenamiento anterior. La migración a Sites mencionada abajo pertenece al antecedente histórico.

Validación de la recuperación: 35 pruebas de lógica, regresión en navegador aislado, fallos de almacenamiento y concurrencia simulados, compilaciones y lint afectado. Después del despliegue se repitió la prueba de recuperación contra la URL pública con datos ficticios; pasó. HTML y service worker respondieron HTTP 200, con el JavaScript `index-D9meCPDF.js` y caché `gestor-boletas-calendar-v4` de esta entrega. Detalles en el documento de recuperación.

Pendiente: comprobar en el navegador original si existen datos antiguos, revisar la vista previa con la usuaria y validar instalación/offline, compartir y comodidad semanal en teléfono físico. No se han recuperado datos reales de su dispositivo. Persisten dos errores TypeScript del plugin de compilación y el error de lint completo del archivo generado, descritos en el documento del calendario. La recuperación dispone de pruebas de cuota y concurrencia; eso no acredita todos los fallos posibles de almacenamiento ni una validación física.

Para continuar: leer este estado y los dos documentos funcionales enlazados. `github-pages-dist` contiene los artefactos publicados. El flujo remoto publica ese directorio, por lo que una futura publicación requiere regenerarlo y conservar `.nojekyll`.

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
