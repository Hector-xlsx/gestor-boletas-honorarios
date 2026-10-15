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
- Registro de turnos sin cobro y horas pendientes de consolidar por institución.
- Boletas internas con nombre, período editable, modalidad tributaria y fecha de consolidación.
- Selección de turnos con subtotal en vivo y aviso de turnos anteriores sin boleta.
- Correcciones de turnos consolidados con confirmación y recálculo.
- Historial con filtros, detalle, exportación Excel y compartir archivos cuando el navegador lo permite.
- Configuración de instituciones, tipos/valores hora, tasas anuales y ciclo habitual (16–15 inicialmente).
- Respaldo de calendario JSON versión 2: importar todo, sin duplicados o reemplazar tras confirmar.

El ajuste y sus decisiones están documentados en [Ajuste a calendario](docs/ajuste-calendario-2026-10-14.md). Los registros de prueba anteriores no se migran; sus datos locales originales se conservan. Los respaldos versión 1 no se importan en el nuevo flujo.

## Datos iniciales

Valores hora:

- Turno general: 10.000
- Turno festivo: 20.000
- Turno sin cobro: 0
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
