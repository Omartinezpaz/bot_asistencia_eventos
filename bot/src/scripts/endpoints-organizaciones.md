# Endpoints de Organizaciones

## Endpoints con Autenticación

| Método | Ruta | Descripción | Permisos |
|--------|------|-------------|----------|
| `GET` | `/api/organizations?page={page}&limit={limit}&search={term}` | Obtener lista paginada de organizaciones | Autenticado |
| `GET` | `/api/organizations/list/dropdown` | Obtener lista simplificada para dropdown/select | Autenticado |
| `GET` | `/api/organizations/{id}` | Obtener detalles de una organización específica | Autenticado |
| `POST` | `/api/organizations` | Crear una nueva organización | Admin |
| `PUT` | `/api/organizations/{id}` | Actualizar una organización existente | Admin |
| `DELETE` | `/api/organizations/{id}` | Eliminar una organización | Admin |
| `PATCH` | `/api/organizations/{id}/toggle-status` | Cambiar estado (activar/desactivar) | Admin |
| `POST` | `/api/organizations/import` | Importar organizaciones desde archivo CSV | Admin |

## Endpoints sin Autenticación (para pruebas)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/organizations/test` | Obtener lista de organizaciones activas (limitada) |

## Detalles de Implementación

### Búsqueda y Paginación

El endpoint principal `/api/organizations` ahora soporta:

- **Búsqueda**: Por nombre, descripción o email (`search` parámetro)
- **Paginación**: Con `page` y `limit` para controlar la cantidad de resultados
- **Formato de respuesta**: Incluye metadata de paginación cuando se usan parámetros de paginación

```json
{
  "items": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalItems": 25,
    "totalPages": 3
  }
}
```

### Estado de Organizaciones

Las organizaciones pueden estar activas o inactivas:

- Sólo las organizaciones activas aparecen en los dropdowns
- El endpoint `toggle-status` permite cambiar el estado usando:
  ```json
  { "active": true|false }
  ```

### Endpoint de Importación CSV

El endpoint `/api/organizations/import` permite importar múltiples organizaciones desde un archivo CSV. El formato esperado es:

```csv
nombre,descripcion,email,telefono,activo
Org A,Descripción A,contacto@orga.com,0414-123-4567,true
```

También acepta nombres de columnas alternativos como:
- nombre o name
- descripcion o description
- email o contact_email o correo
- telefono o phone o contact_phone
- activo o active

### Verificaciones de Eliminación

Al eliminar una organización, se verifican:
- Referencias en la tabla de participantes
- Referencias en la tabla de eventos

Si existen referencias, la eliminación es rechazada para mantener la integridad referencial.

## Scripts de Prueba

Se han desarrollado tres scripts para probar estos endpoints:

1. `probar-organizaciones.js`: Prueba completa de todos los endpoints (requiere autenticación)
2. `probar-organizaciones-test.js`: Prueba solo los endpoints sin autenticación
3. `probar-importacion-organizaciones.js`: Prueba específica para la importación de organizaciones desde CSV

## Ejemplo de Respuestas

### Detalle de Organización

```json
{
  "id": 1,
  "name": "Nombre de la Organización",
  "description": "Descripción de la organización",
  "is_active": true,
  "contact_email": "contacto@organizacion.com",
  "contact_phone": "0414-123-4567",
  "participants_count": 25,
  "events_count": 5
}
```

### Resultado de Importación

```json
{
  "success": true,
  "mensaje": "Proceso completado. Se procesaron 3 registros.",
  "estadisticas": {
    "procesados": 3,
    "creados": 2,
    "omitidos": 0,
    "yaExistentes": 1
  },
  "resultados": [
    {"nombre": "Org A", "organizacionId": 1, "mensaje": "Organización creada exitosamente", "linea": 1},
    {"nombre": "Org B", "organizacionId": 2, "mensaje": "Organización creada exitosamente", "linea": 2},
    {"nombre": "Org C", "organizacionId": 3, "mensaje": "Organización ya registrada", "linea": 3}
  ],
  "errores": []
}
``` 