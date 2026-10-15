# Ajuste a calendario de turnos y consolidación

Fecha: 2026-10-14. Entrega de calendario preparada para publicación autorizada en GitHub Pages. Las menciones a «no publicado» de las secciones siguientes registran el estado durante cada iteración previa a esa autorización. Consultar `estado-del-proyecto.md` y GitHub Actions para el proceso de publicación.

## Objetivo y resultado

El ingreso parte de turnos independientes, registrados diariamente desde un calendario, y termina en la consolidación de una institución y un período. Se elimina el seguimiento de emisión, número real y estados de pago. No se requiere volver a registrar una boleta emitida externamente.

Implementado:

- Calendario mensual y semanal, navegación, botón Hoy y panel de cada día.
- Múltiples turnos por día. Todos tienen fecha y hora de inicio y término, duración automática en horas/minutos, tipo/valor hora, institución y comentario opcional.
- Una sola institución queda seleccionada automáticamente; varias requieren selección.
- Turnos nocturnos y de varios días: único registro, presencia visual en los días ocupados. En mes se extiende una franja; al cambiar de fila continúa con flechas. En semana se muestran segmentos horarios y flechas de continuidad. Los solapamientos usan carriles separados.
- Horas sin boleta por institución, bruto acumulado y horas sin cobro separadas.
- Tipo protegido «Turno sin cobro», valor cero, visible en calendario y resumen, excluido de consolidaciones.
- Cierre: institución, nombre, fechas independientes de los turnos, lista inicialmente seleccionada de turnos del período, exclusión individual y totales en vivo.
- Turnos anteriores de la misma institución sin boleta al inicio del selector, desmarcados. Se incorporan expresamente como excepciones, conservando sus fechas.
- Tipo de boleta elegido al consolidar, fecha local de consolidación automática y tasa del año de consolidación guardada.
- Historial con detalle, renombrado, filtros de institución/fecha de consolidación, exportación Excel del listado o selección y compartir archivo cuando el navegador lo permite.
- Edición y eliminación de turnos consolidados con confirmación y recálculo. La edición muestra horarios, duración, tipo, institución, comentario, montos del turno, bruto/impuesto/pago esperado de boleta antes y después.
- Configuración de ciclo, instituciones, tipos y valores, tasas anuales y respaldo JSON versión 2 con importación completa, sin duplicados o reemplazo confirmado.
- Actualización de caché PWA y artefactos estáticos de GitHub Pages, conservando `.nojekyll`.

## Decisiones tomadas durante la implementación

| Duda o caso | Decisión aplicada | Motivo / revisión |
| --- | --- | --- |
| ¿Eliminar registros anteriores? | No se migran ni se muestran sus boletas. Las claves antiguas permanecen intactas. Se recuperan solo instituciones, valores y tasas como configuración inicial. | Permite empezar de cero en el nuevo flujo sin destrucción innecesaria. |
| ¿Cambiar el respaldo versión 1? | Nuevo esquema de calendario versión 2, con el mismo identificador de formato. Se rechaza versión 1 con explicación. | Los registros antiguos no contienen los horarios necesarios; no se inventan fechas/horas. |
| ¿Cómo resolver duplicados en recuperación? | Por ID. Los registros locales prevalecen; importar todo crea IDs nuevos y remapea las relaciones. | Evita sobrescribir correcciones locales o asociar un turno a dos cierres. No intenta reconocer duplicados semánticos con IDs diferentes. |
| ¿Ciclo estándar? | Inicio 16, término 15; editable en Configuración y en cada cierre. Un día final menor al inicial significa mes siguiente. Los días inexistentes se ajustan al último día del mes. | Funciona también en febrero y cambio de año. Se propone el ciclo correspondiente a la fecha de referencia del calendario. |
| ¿Qué período recibe un turno nocturno? | Todo el turno pertenece a la fecha de inicio. | Acuerdo explícito; no se fracciona su duración ni el cobro. |
| ¿Qué ocurre al cambiar fecha/institución tras consolidar? | Si queda fuera del período sin ser excepción, cambia de institución o pasa a sin cobro, se desvincula tras confirmar y se recalcula el cierre. | El turno puede volver a consolidarse; sin cobro queda únicamente en el registro. |
| ¿Excepción antigua al editar su fecha? | Permanece asociada tras confirmación mientras siga siendo cobrable y de la misma institución. Si pasa dentro del período, deja de marcarse como excepción. | La incorporación anterior fue una decisión expresa del usuario. |
| ¿Boleta que queda sin turnos? | Se conserva con cero horas/monto y puede eliminarse expresamente. | Evita borrar otro registro de forma implícita al corregir o eliminar un turno. |
| ¿Eliminar una boleta? | Libera sus turnos para otro cierre; no elimina los turnos. | El registro de trabajo es independiente de la consolidación. |
| ¿Cambiar valores o tasas históricas? | Cada turno guarda su valor y nombre de tipo; cada cierre guarda su tasa. Editar configuración no recalcula el pasado. Reseleccionar el tipo en un turno aplica el valor configurado actual. | Mantiene trazabilidad y permite correcciones expresas. |
| ¿Cálculo de minutos y horario de verano? | Diferencia entre horarios civiles escritos, sin ajuste automático de zona horaria/DST. | Coherente con sumar horas declaradas. Revisar si se necesitan horas reales transcurridas en noches con cambio de hora. |
| ¿Turnos superpuestos? | Se permiten y se muestran en carriles; no se bloquean ni se descuentan automáticamente. | No se acordó una regla de exclusión; pueden necesitar corrección por el usuario. |
| ¿Vista semanal en teléfono? | Grilla completa de 24 horas con desplazamiento horizontal. | Conserva legibilidad de horarios. Revisar comodidad con la usuaria; no validado en teléfono físico. |
| ¿Nombre sugerido? | «Boleta» + mes/año de término; editable. | Ejemplo: 16 septiembre–15 octubre propone Boleta octubre. |
| ¿Modificar período o modalidad de un cierre guardado? | Se puede renombrar y corregir sus turnos. Para cambiar período/modalidad, eliminar el cierre y volver a consolidar. | Mantiene pequeño el flujo; los turnos se conservan al eliminar el cierre. |

## Almacenamiento y fórmulas

Una sola clave `cobro-horas-calendar-v2` guarda configuración, turnos y cierres. Cada modificación valida y escribe el conjunto antes de actualizar la vista. Si falla la escritura, se conserva el estado anterior y se muestra un aviso. No hay sincronización entre dispositivos ni cambios de origen.

Monto por turno = redondeo de minutos × valor hora / 60. Bruto = suma de montos redondeados de turnos. Impuesto = redondeo de bruto × tasa / 100. Receptor retiene: pago esperado = bruto − impuesto. Emisor paga PPM: pago esperado = bruto; neto después de impuesto = bruto − PPM.

Las asociaciones son IDs de turnos; se rechazan dobles asociaciones, referencias inexistentes y turnos sin cobro asociados a un cierre. No se consideran los borradores, selecciones y filtros parte del respaldo.

## Validación ejecutada

- 14/14 pruebas de lógica en `tests/turnos.test.mjs`: minutos nocturnos, redondeo, ambas modalidades, límites de período, febrero/cambio de año, correcciones, desvinculación, excepciones, borrado, validación de respaldo, importaciones y carriles superpuestos.
- Compilación Vinext: correcta.
- Compilación estática GitHub Pages: correcta.
- Prueba de HTML del servidor: correcta; calendario y navegación presentes, estados anteriores ausentes.
- ESLint de archivos nuevos/modificados de aplicación y pruebas: correcto.
- Navegador Edge aislado, ancho móvil 390 px: registro de turno 22:00–02:30, cierre, edición a 03:00, confirmación con recálculo 45.000→50.000, persistencia tras recarga.
- Descarga real de XLSX: hojas Resumen y Detalle; bruto verificado de 50.000. Descarga JSON versión 2 y recuperación con reemplazo, verificando persistencia.
- Segundo navegador aislado: varias instituciones sin selección automática, turnos antiguos desmarcados, sin cobro excluido, selección/deselección con subtotal, PPM e incorporación explícita de excepción.
- Sin errores JavaScript en estos recorridos. Datos de prueba únicamente en contextos aislados; no se alteró el almacenamiento del navegador del usuario.
- `git diff --check`: sin errores de formato.
- Capturas: `calendario-movil.png` y `calendario-semana-movil.png`.

Comandos reproducibles:

```powershell
node --experimental-strip-types --test tests/turnos.test.mjs
.\node_modules\.bin\vinext.cmd build
node --test tests/rendered-html.test.mjs
.\node_modules\.bin\vite.cmd build --config vite.pages.config.ts
New-Item -ItemType File -Path github-pages-dist\.nojekyll -Force
.\node_modules\.bin\eslint.cmd app/page.tsx app/turnos.ts tests/calendar-ui.mjs tests/turnos.test.mjs tests/rendered-html.test.mjs
```

La prueba opcional de navegador está en `tests/calendar-ui.mjs`. Requiere Playwright disponible externamente (`PLAYWRIGHT_MODULE` permite indicar su módulo instalado), Edge o `BROWSER_CHANNEL` y el servidor local iniciado; `APP_URL` permite cambiar la dirección. No se incorporaron dependencias nuevas.

## Limitaciones y revisión del día siguiente

- `tsc --noEmit` no pasa a nivel de proyecto por dos errores en `build/sites-vite-plugin.ts`: propiedad `name` del tipo Plugin y parámetro `config` implícitamente any. Ese archivo no se modificó; las compilaciones sí pasan y no se reportaron errores TypeScript en los archivos de este ajuste.
- Lint completo detecta un error en `cloudflare-env.d.ts` por interfaz vacía. Se conserva el archivo generado; el lint de los archivos afectados pasa.
- Pendiente probar instalación/offline PWA, compartir en teléfono físico, almacenamiento sin espacio/denegado y comportamiento visual en varios tamaños. No se afirma que esos escenarios hayan sido verificados.
- Revisar con la usuaria la grilla semanal, especialmente su desplazamiento en móvil y continuidad de turnos nocturnos. La vista mensual se verificó visualmente en captura.
- Revisar si se requieren advertencias para turnos solapados, cálculo con cambios de hora o edición de período/modalidad de un cierre guardado.
- No se publicó ni se hizo push. El servidor local se detendrá con el apagado del equipo; volver a iniciarlo para revisar.

## Archivos afectados

`app/page.tsx`, `app/turnos.ts`, `app/globals.css`, `public/sw.js`, `package.json`, pruebas, `README.md`, documentos y capturas bajo `docs/`, artefactos bajo `github-pages-dist/`. La documentación previa ya tenía modificaciones antes de esta tarea y se preservó como registro histórico.

Para volver a iniciar la vista local después del apagado:

```powershell
.\node_modules\.bin\vinext.cmd dev --host 127.0.0.1 --port 3000
```

Abrir http://localhost:3000/.

## Ajustes posteriores de interfaz y horarios — 2026-10-14

Implementados a solicitud de la revisión visual:

- Ventanas centradas horizontal y verticalmente mediante posición fija y margen automático, incluido el panel del día.
- Primera fila del formulario: Institución a la izquierda y Nombre turno a la derecha, también en móvil.
- En Configuración, Nombre turno reemplaza el concepto Tipo de turno. Cada nombre admite hora inicio por defecto y hora fin por defecto, además del valor hora.
- Seleccionar un nombre turno aplica sus horarios al día de inicio del registro. Los horarios se pueden editar para ese registro; las modificaciones de configuración no alteran turnos previamente guardados.
- Cuando la hora final predeterminada es menor a la inicial, el término se asigna al día siguiente. Se muestra la explicación en Configuración y una ventana informativa al guardar: «Atención: la hora de término es anterior a la hora de inicio. Se asumirá que el turno termina al día siguiente, después de las 00:00.»
- Turno sin cobro conserva nombre y valor cero protegidos, pero permite configurar sus horarios.
- Tasas anuales dentro de una sección desplegable con flecha, cerrada al entrar a Configuración. Se interpretó así la solicitud de mantener el detalle oculto, pese a la última referencia a «aperturado».

Decisiones de compatibilidad: `defaultStart` y `defaultEnd` son opcionales en los nombres guardados; los respaldos de calendario versión 2 anteriores siguen siendo válidos. Sin horarios configurados, se mantiene el horario anterior 08:00–09:00. Los ejemplos 17:00–20:00 y 17:00–22:00 no se asignaron silenciosamente a nombres o valores existentes; se configuran según corresponda. Las horas predeterminadas iguales se rechazan para evitar un turno de cero horas o asumir 24 horas sin indicación expresa. Reseleccionar un nombre aplica nuevamente su plantilla, incluso al editar un registro.

Validación de este ajuste: 17/17 pruebas de lógica; prueba de HTML del servidor; compilaciones Vinext y GitHub Pages; lint de archivos afectados. Navegador aislado a 390 px: centrado verificado geométricamente, selectores en la misma fila, carga 17:00–20:00, ajuste individual a 20:30, configuración 22:00–03:00 con ventana informativa, término al día siguiente, duración 5 horas, registros anteriores intactos y tasas inicialmente cerradas que se despliegan al pulsarlas. Se repitió el recorrido de consolidación, corrección, Excel, respaldo y recuperación sin errores JS. `tsc` continúa mostrando únicamente los dos errores del plugin de compilación ya documentados. Sin publicación ni push.

## Institución predeterminada y aviso de término — 2026-10-14

- Se agregó un pin en cada institución. La preferencia se guarda como un único `defaultInstitutionId`; marcar otra sustituye la selección. No altera instituciones de turnos o boletas guardados.
- La institución elegida se preselecciona al registrar nuevos turnos y al iniciar una consolidación. Sigue siendo posible elegir otra manualmente. Una única institución se considera predeterminada automáticamente; varias sin preferencia conservan la selección manual hasta marcar un pin.
- La preferencia se incluye en el respaldo versión 2; archivos anteriores sin el campo siguen siendo compatibles. Al combinar respaldos se conserva la preferencia local; si no existe, se remapea la entrante. Si se elimina una institución predeterminada sin registros, se limpia la referencia; con una sola restante se selecciona automáticamente.
- Se quitó el botón «Termina al día siguiente». Si las fechas indican el día siguiente se muestra «Atención: este turno termina al día siguiente». Si abarca más días, el aviso indica la fecha real de término. Cambiar las fechas a un turno del mismo día oculta el aviso. Las plantillas nocturnas siguen asignando automáticamente el día siguiente; los horarios manuales conservan las fechas elegidas expresamente.

Validación: 19/19 pruebas de lógica; navegador aislado confirmó pin único, traslado de marca, persistencia tras recarga, preselección en nuevos turnos y consolidaciones, ausencia del botón y aviso nocturno. Recorrido de regresión completo sin errores JS, compilaciones y HTML del servidor correctos. Lint de los archivos afectados y `git diff --check` correctos. Continúan los dos errores TypeScript preexistentes del plugin de compilación. Cambios locales; sin publicación ni push.

## Nombre y saludo personal — 2026-10-14

- Al abrir la aplicación sin nombre guardado aparece «Ingresa tu nombre». Se puede cerrar para continuar y se volverá a solicitar en una apertura posterior mientras no se guarde.
- El encabezado muestra «Bienvenido de nuevo, [nombre]». Al final de Configuración aparece el nombre actual y el botón «Cambiar nombre».
- Se recortan espacios al inicio/final, se rechazan nombres vacíos y se limita a 80 caracteres. Es un dato local de personalización; no crea cuentas ni sincronización.
- El campo opcional `userName` forma parte del respaldo versión 2. Los respaldos anteriores sin nombre siguen siendo válidos. En importaciones combinadas prevalece el nombre local; reemplazar utiliza el nombre del archivo.
- No se modificaron datos del navegador del usuario durante las pruebas. Navegador aislado verificó solicitud inicial, saludo, nombre precargado al editar, rechazo de espacios vacíos, modificación y respaldo. 20 pruebas de lógica, prueba de HTML del servidor, compilaciones y lint afectado correctos. Persisten los errores TypeScript preexistentes del plugin, sin errores nuevos reportados. Cambios locales, sin publicación ni push.

Normalización posterior del nombre: al guardar, recuperar o cargar datos existentes, se muestra la primera letra en mayúscula y todo el resto en minúscula (por ejemplo, `aNA` → `Ana`, `MARÍA JOSÉ` → `María josé`). Se conservan los acentos y se eliminan espacios exteriores. Validación: 21 pruebas de lógica, recorrido de navegador con entrada de mayúsculas mezcladas y comprobación de saludo y respaldo, compilación estática y lint afectado correctos.

Saludo temporal: reemplaza el saludo fijo del encabezado por un mensaje flotante en la parte superior, sobre la aplicación. Se muestra al abrir con nombre guardado o al guardar el nombre y desaparece tras un intervalo aleatorio entre 1.500 y 3.000 ms. No bloquea clics y su temporizador se limpia al desmontar. Compilación estática, lint afectado y recorrido de navegador verificados; la prueba comprueba aparición y desaparición automática del mensaje.

Presentación posterior de la bienvenida: reemplaza el mensaje flotante superior por una capa blanca translúcida de pantalla completa con desenfoque del fondo, saludo centrado, nombre grande e indicador animado decorativo. Conserva la duración aleatoria de 1,5–3 segundos y respeta movimiento reducido. Esta capa intercepta clics mientras está visible. Verificado en navegador aislado: cobertura de viewport 390×844, centrado vertical y desaparición automática; captura `bienvenida-movil.png`. Compilación estática y lint afectado correctos.

## RUT de perfil previo a saludos personalizados — 2026-10-14

Se agregó la ventana «Ingresa tu RUT» después de guardar un nombre cuando falta el RUT. Contiene dos campos: número de 7 u 8 dígitos y un verificador numérico o K (se normaliza a mayúscula). Si ya existe nombre sin RUT, se pide el RUT al abrir. La bienvenida se muestra después de guardar o cerrar esa ventana; cerrar permite continuar con el saludo estándar. Configuración permite ingresar o cambiar el RUT.

El objeto opcional `userRut` se guarda localmente y en el respaldo versión 2, con compatibilidad para respaldos anteriores sin ese dato. Al combinar respaldos se conserva el RUT local; solo se completa desde el archivo cuando no hay identidad local o el nombre normalizado coincide. Reemplazar restaura el perfil del archivo. No se transmiten datos a un servidor.

La validación implementada corresponde al formato solicitado, no calcula el módulo 11 del dígito verificador. Todavía no existe un RUT objetivo configurado ni saludos exclusivos: todos reciben el saludo estándar. Pendiente recibir por parte del usuario el identificador de Ignacia y el listado de mensajes; no se inventó ninguno.

Pruebas: 23/23 de lógica; navegador aislado con datos ficticios comprobó secuencia nombre–RUT–saludo, rechazo de número corto, K mayúscula, edición de RUT, descarga/recuperación del perfil y regresión del flujo de turnos. Sin errores JS. Compilaciones Vinext y estática, HTML del servidor, lint afectado y revisión de formato correctos. Persisten los errores TypeScript ya documentados del plugin. No se publicó ni se hizo push.

Ajuste posterior de Configuración: los datos personales se agrupan bajo «Datos», mostrando «Nombre:» y «RUT:» en líneas consecutivas. Se reemplazan los botones individuales por un único «Cambiar datos», que abre el nombre y después el RUT, ambos precargados. La bienvenida aparece al terminar la segunda ventana. No cambia el esquema de almacenamiento. Comprobado en navegador aislado, compilación estática, lint afectado y revisión de formato.

Horas sin boleta: cada institución muestra ahora un grupo plegado inicialmente, con flecha junto al nombre y resumen permanente «X turnos · X h Y min · $monto». El detalle se despliega independientemente por institución; se mantienen los turnos, cálculos y acciones existentes. Verificación en navegador aislado a 390 px: cerrado al entrar, resumen 1 turno/2 h 30 min/$25.000, apertura/cierre y grupo sin pendientes. Compilación estática, lint afectado y formato correctos.

## Saludos personalizados del perfil indicado — 2026-10-14

Se incorporaron los 15 mensajes proporcionados por el usuario, conservando texto, acentos, emojis y puntuación. Se selecciona uno mediante `floor(Math.random() * 15)`: cada mensaje tiene 1/15 de probabilidad por bienvenida y se permiten repeticiones consecutivas. No se cambia la duración de la bienvenida (1,5–3 segundos).

La selección personalizada requiere coincidencia del número y dígito verificador del RUT configurado; el nombre no determina la coincidencia. Se compara una huella SHA-256 para no incluir el identificador literal en las fuentes. Para otros perfiles o sin coincidencia se conserva el saludo estándar; ante indisponibilidad de la comparación también se usa el estándar. El resultado se elige una vez por bienvenida, sin volver a sortear durante los renderizados. No se modifican los datos locales del usuario.

El texto personalizado reemplaza el saludo/nombre estándar dentro de la misma capa blanca; su tipografía se ajusta para los mensajes largos. Recursos de implementación en `app/saludos.ts`.

Validación: 25 pruebas de lógica, comprobación determinista de los 15 intervalos equiprobables, recorrido de navegador aislado por cada mensaje, coincidencia completa de RUT y verificador distinto con saludo estándar, ajuste móvil de textos largos y regresión del recorrido estándar. Captura `bienvenida-personalizada.png`. Compilaciones Vinext y GitHub Pages, HTML del servidor, lint afectado y formato correctos. Persisten los dos errores TypeScript del plugin ya documentados. No publicado ni enviado al remoto.

Duración vigente de todos los saludos: intervalo aleatorio entre 2.000 y 3.000 ms, por ajuste posterior del usuario. Compilación estática y revisión de formato correctas.


## Entrega para GitHub Pages — 2026-10-14

Publicación autorizada expresamente por el usuario. Se incluyen las fuentes del calendario y perfil, los 15 saludos equiprobables, duración vigente de 2–3 segundos, pruebas, documentación y artefactos estáticos regenerados con `.nojekyll`. Se mantiene el origen público existente y las claves antiguas de datos. El RUT objetivo no se incluye en texto literal en las fuentes; no se publican respaldos reales ni datos del navegador del usuario.

La rama de publicación es `main`. GitHub Actions publica los archivos compilados; no compila fuentes. La reversión consiste en revertir el commit de entrega y dejar que el mismo flujo publique los artefactos anteriores, sin borrar localStorage.
