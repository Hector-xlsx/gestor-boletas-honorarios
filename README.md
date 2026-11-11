# Gestor de boletas de honorarios

Aplicación PWA para calcular horas extras de personal de salud, preparar los montos asociados a boletas de honorarios, llevar un registro local y exportar detalles en Excel.

La herramienta registra turnos y prepara consolidaciones de horas y montos. La emisión oficial y su seguimiento quedan fuera del flujo de la aplicación.

Sitio publicado: https://hector-xlsx.github.io/gestor-boletas-honorarios/

Repositorio: https://github.com/Hector-xlsx/gestor-boletas-honorarios

El estado de implementación, las decisiones, las pruebas y los pendientes se documentan en [Estado del proyecto](docs/estado-del-proyecto.md).

## Funciones principales

- Calendario mensual y semanal para registrar varios turnos por día.
- Fecha y hora de inicio y término, cálculo automático de duración, nombre/valor del turno e institución.
- Horarios predeterminados por nombre de turno, ajustables en cada registro; término al día siguiente para horarios nocturnos.
- Turnos nocturnos visibles en ambos días, con una sola duración y cobro.
- Resumen de horas sin boleta por tipo de turno, con vistas simple y avanzada.
- Turnos a valor hora cero con confirmación. Se pueden consolidar y sus horas se muestran por separado.
- Boletas internas con nombre, período editable, modalidad tributaria y fecha de consolidación.
- Selección de turnos con subtotal en vivo y aviso de turnos anteriores sin boleta.
- Correcciones de turnos consolidados con confirmación y recálculo.
- Historial con filtros, detalle, exportación Excel y compartir archivos cuando el navegador lo permite.
- Tipos de boleta con institución y modalidad tributaria. Cada tipo de turno se configura dentro de un tipo de boleta.
- Los tipos de turno anteriores requieren asignación. Los turnos abiertos anteriores se revisan y guardan individualmente antes de consolidarlos.
- Categoría predeterminada mediante pin, tasas anuales plegables y ciclo habitual (16–15 inicialmente).
- Combinación de tipos de turno y categorías para reclasificar turnos abiertos, conservando horarios y montos.
- Perfil local con nombre normalizado y RUT; bienvenida de pantalla completa durante 2–3 segundos y saludos personalizados para el perfil configurado.
- Recuperación de boletas de la versión anterior desde el mismo navegador, con turnos a las 17:00 y vista previa.
- Respaldo de calendario JSON versión 5. Permite importar todo, importar sin duplicados o reemplazar tras confirmar. Acepta respaldos de calendario versiones 2, 3 y 4.

El ajuste y sus decisiones están documentados en [Ajuste a calendario](docs/ajuste-calendario-2026-10-14.md). Los datos locales originales se conservan y ahora pueden recuperarse desde el navegador mediante el botón de recuperación anterior. Los archivos JSON versión 1 no se importan mediante el selector de respaldos. [Detalle de recuperación](docs/recuperacion-version-anterior-2026-10-15.md).

La recuperación se publicó el 2026-10-15 en `6441f94`, con [despliegue confirmado](https://github.com/Hector-xlsx/gestor-boletas-honorarios/actions/runs/38678806354) y prueba en la URL pública con datos ficticios. Para datos reales debe abrirse en el mismo dispositivo, navegador y dirección de la versión anterior; permite revisar y descargar un respaldo actual antes de confirmar.

## Datos iniciales

Valores hora:

- Turno general: 10.000
- Turno festivo: 20.000
- Período habitual: del 16 al 15 del mes siguiente.

Institución:

- CESFAM MAIPO - Receptor retiene

## Instalación en teléfono

Al estar publicada, la app se puede instalar desde el navegador como acceso directo o aplicación web.

En Android:

1. Abrir la URL de la app en Chrome.
2. Abrir el menú del navegador.
3. Elegir Instalar app o Agregar a pantalla principal.

En iPhone:

1. Abrir la URL de la app en Safari.
2. Tocar Compartir.
3. Elegir Agregar a pantalla de inicio.

Los datos se guardan localmente en el dispositivo. Desde Configuración se puede generar un archivo de respaldo y recuperarlo posteriormente. Si se borra el almacenamiento del navegador o se desinstala la app sin haber guardado un respaldo, los registros locales pueden perderse.

## Desarrollo local

La aplicación abre en la versión 1 hasta que se confirma **Pasar a la
versión 2** al final de Configuración. La versión 2 trabaja con una copia
de los datos. Al confirmar **Volver a la versión 1**, se recupera el estado
anterior y se descartan los cambios hechos en la versión 2.

En Windows, abre `Iniciar servidor.cmd` con doble clic. Inicia el servidor en
`http://127.0.0.1:3000/` o reutiliza la instancia si ya está disponible. Abre
una ventana de Chrome con el perfil local `work/chrome-local`, donde están los
datos cargados. Los turnos se guardan en el navegador y el lanzador vuelve a
usar el mismo perfil en cada inicio.

En este equipo el lanzador usa `work/runtime/node.exe`, porque el PATH
del Explorador de Windows no incluye Node.js. Si falta ese archivo, el
lanzador busca Node.js 22.13 o posterior en el PATH. La carpeta `work/`
está excluida de Git y contiene tanto el runtime local como el perfil con
los datos.

Requisitos:

- Node.js 22.13 o superior.
- pnpm.

Comandos:

```bash
pnpm install
pnpm run dev
pnpm run build
```

## Nombre e instalación PWA

El nombre completo de la app es `Gestor de boletas de honorarios`.

El nombre corto para el acceso directo del teléfono es `Boletas`.

La configuración PWA está en `public/manifest.webmanifest`.

## Aviso

Las tasas de retención/PPM se pueden revisar y editar desde la configuración de la app. Cada turno conserva su valor hora y cada boleta su tasa tributaria. Las correcciones de turnos consolidados se confirman antes de recalcular sus montos.
