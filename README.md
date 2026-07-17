# Gestor de boletas de honorarios

Aplicación PWA para calcular horas extras de personal de salud, preparar los montos asociados a boletas de honorarios, llevar un registro local y exportar detalles en Excel.

La herramienta no emite boletas ante el Servicio de Impuestos Internos (SII). Su finalidad es facilitar el cálculo, ordenar la información y apoyar el seguimiento de cada boleta. La emisión oficial debe realizarse directamente en el sitio del SII.

## Funciones principales

- Registro de horas extras por fecha o rango de fechas.
- Cálculo por total o por día cuando el período incluye más de una fecha.
- Valores hora configurables, con turnos por defecto.
- Instituciones configurables, con tipo de boleta por defecto.
- Cálculo de retención o PPM según el tipo de boleta.
- Registro de boletas con estados: pendiente de emitir, pendiente de pago y boleta pagada.
- Historial con filtros por institución, tipo de boleta y fechas.
- Exportación a Excel de todos los registros, por rango o por selección.
- Función de compartir detalle de una boleta desde dispositivos compatibles.

## Datos iniciales

Valores hora:

- Turno general: 10.000
- Turno festivo: 20.000

Institución:

- CESFAM MAIPO - Receptor retiene

## Instalación en teléfono

Al estar publicada, la app se puede instalar desde el navegador como acceso directo o aplicación web.

En Android:

1. Abrir la URL de la app en Chrome.
2. Abrir el menu del navegador.
3. Elegir Instalar app o Agregar a pantalla principal.

En iPhone:

1. Abrir la URL de la app en Safari.
2. Tocar Compartir.
3. Elegir Agregar a pantalla de inicio.

Los datos se guardan localmente en el dispositivo. Si se borra el almacenamiento del navegador o se desinstala la app, los registros locales pueden perderse.

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

Las tasas de retención/PPM se pueden revisar y editar desde la configuración de la app. Las boletas ya guardadas mantienen una copia de los datos y tasas usadas al momento del registro.
