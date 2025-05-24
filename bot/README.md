# Sistema de Geocodificación para Centros de Votación

Este módulo permite obtener automáticamente las coordenadas geográficas (latitud y longitud) de los centros de votación a partir de sus direcciones, lo que facilita su ubicación en mapas y el cálculo de rutas.

## Características

- **Geocodificación automática**: Convierte direcciones de centros de votación en coordenadas geográficas.
- **Múltiples proveedores**: Utiliza OpenStreetMap, Google Maps y Mapbox con sistema de fallback automático.
- **Validación de coordenadas**: Verifica que las coordenadas obtenidas estén dentro de los límites de Venezuela.
- **Procesamiento por lotes**: Permite actualizar múltiples centros sin coordenadas en una sola operación.
- **Corrección manual**: Permite corregir coordenadas erróneas manualmente o forzar una nueva geocodificación.
- **Integración con Telegram**: Comandos `/geocodificar` y `/corregir_coordenadas` para administradores.
- **API REST**: Endpoints protegidos para iniciar la geocodificación vía HTTP.
- **Scripts de línea de comandos**: Herramientas para ejecutar la geocodificación desde la terminal.

## Requisitos

- Node.js 14+
- Dependencias: `node-geocoder`
- PostgreSQL con soporte para índices espaciales (opcional)

## Instalación

```bash
npm install node-geocoder --save
```

## Configuración

Para habilitar todos los proveedores de geocodificación y el comando de administrador, agrega las siguientes variables de entorno al archivo `.env`:

```
# ID de Telegram del administrador
ADMIN_TELEGRAM_ID=tu_id_de_telegram

# API Keys para proveedores de geocodificación
GOOGLE_MAPS_API_KEY=tu_api_key_de_google
MAPBOX_API_KEY=tu_api_key_de_mapbox
```

Puedes obtener tu ID de Telegram enviando el comando `/start` al bot [@userinfobot](https://t.me/userinfobot).

## Uso

### Comandos de Bot (solo administradores)

1. **Geocodificar centros sin coordenadas**:
   ```
   /geocodificar [límite]
   ```
   Donde `[límite]` es opcional y representa la cantidad máxima de centros a procesar (por defecto: 5).

2. **Corregir coordenadas de un centro específico**:
   ```
   /corregir_coordenadas <código_centro> [latitud] [longitud]
   ```
   - Si solo se proporciona el código, intenta geocodificar nuevamente usando todos los proveedores.
   - Si se proporcionan latitud y longitud, actualiza las coordenadas manualmente.

### API REST

La API REST proporciona dos endpoints (requieren autenticación básica):

1. **Procesar múltiples centros**:
   ```
   GET /api/geocodificar?limite=10&forzar=true
   ```
   El parámetro `forzar=true` permite actualizar incluso centros que ya tienen coordenadas.

2. **Procesar un centro específico**:
   ```
   GET /api/geocodificar/[codigo_centro]
   ```

### Scripts de línea de comandos

1. **Actualizar el esquema de la base de datos**:
   ```bash
   psql -U usuario -d base_de_datos -f bot/src/scripts/update-centros-schema.sql
   ```

2. **Procesar múltiples centros**:
   ```bash
   node bot/src/scripts/geocodificar-centros.js [límite]
   ```

3. **Probar la geocodificación de un centro específico**:
   ```bash
   node bot/src/scripts/test-geocodificacion.js [código_centro]
   ```

## Proveedores de Geocodificación

El sistema intenta usar los siguientes proveedores en orden de prioridad:

1. **Google Maps** (requiere API key) - Mayor precisión pero tiene límites de uso y costo.
2. **Mapbox** (requiere API key) - Buena precisión con planes gratuitos generosos.
3. **OpenStreetMap** (sin API key) - Completamente gratuito pero con menor precisión en algunas áreas.

Si un proveedor falla, el sistema automáticamente intenta con el siguiente en la lista.

## Solución de problemas

Si la geocodificación no encuentra coordenadas para un centro:

1. Verifica que la dirección sea correcta y específica.
2. Añade más detalles a la dirección en la base de datos.
3. Usa el comando `/corregir_coordenadas` para intentar con todos los proveedores.
4. Como último recurso, proporciona las coordenadas manualmente.

## Limitaciones

- OpenStreetMap puede tener límites de uso para geocodificación.
- La precisión depende de la calidad de las direcciones en la base de datos.
- Algunas direcciones muy generales o con errores pueden no ser localizables. 