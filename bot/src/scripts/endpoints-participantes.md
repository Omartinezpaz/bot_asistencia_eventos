# Endpoints de Participantes

## Endpoints con Autenticación

| Método | Ruta | Descripción | Permisos |
|--------|------|-------------|----------|
| `GET` | `/api/participants?page={page}&limit={limit}` | Obtener lista paginada de participantes | Autenticado |
| `GET` | `/api/participants/dropdown` | Obtener lista simplificada para dropdown/select | Autenticado |
| `GET` | `/api/participants/{id}` | Obtener detalles de un participante específico | Autenticado |
| `POST` | `/api/participants` | Crear un nuevo participante | Admin |
| `PUT` | `/api/participants/{id}` | Actualizar un participante existente | Admin |
| `DELETE` | `/api/participants/{id}` | Eliminar un participante | Admin |
| `POST` | `/api/participants/import` | Importar participantes desde archivo CSV | Admin |

## Endpoints sin Autenticación (para pruebas)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/participants/validate-test` | Validar datos de un participante (sin crear) |
| `POST` | `/api/participants/check-participant-test` | Verificar si existe un participante por cédula |

## Detalles de Implementación

### Validaciones Implementadas

- **Cédula**: Debe ser un número entre 6 y 8 dígitos, con nacionalidad V o E
- **Correo Electrónico**: Formato válido (usuario@dominio)
- **Teléfono**: Formato venezolano (04XX-XXX-XXXX o sin formato)
- **Campos Obligatorios**: Cédula, nombre, apellido, correo y teléfono

### Endpoint de Importación CSV

El endpoint `/api/participants/import` permite importar múltiples participantes desde un archivo CSV. El formato esperado es:

```csv
documento,nombre,apellido,email,telefono
V12345678,Juan,Pérez,juanperez@gmail.com,0414-123-4567
```

También acepta nombres de columnas alternativos como:
- documento o nac+cedula
- nombre o firstname
- apellido o lastname
- email o correo
- telefono o phone

### Endpoint de Verificación

El endpoint `/api/participants/check-participant-test` verifica si existe un participante con la cédula proporcionada y:

1. Si existe, devuelve sus datos básicos
2. Si no existe pero está en el registro electoral, devuelve datos del registro
3. Si no existe en ninguna parte, indica que no se encontró

### Scripts de Prueba

Se desarrollaron dos scripts para probar estos endpoints:

1. `probar-participantes.js`: Prueba completa de todos los endpoints (requiere autenticación)
2. `probar-participantes-test.js`: Prueba solo los endpoints sin autenticación

## Ejemplo de Respuestas

### Validación de Participante Exitosa

```json
{
  "valid": true,
  "data": {
    "nac": "V",
    "cedula": "12345678",
    "firstName": "Juan",
    "lastName": "Pérez",
    "email": "juanperez@gmail.com",
    "phone": "0414-123-4567"
  }
}
```

### Validación de Participante con Errores

```json
{
  "valid": false,
  "errors": [
    "La nacionalidad debe ser V o E",
    "La cédula debe contener solo números",
    "El formato del correo electrónico no es válido",
    "El formato del número de teléfono no es válido"
  ]
}
```

### Verificación de Participante Exitosa

```json
{
  "exists": true,
  "participant": {
    "id": 123,
    "cedula": "12345678",
    "nac": "V",
    "documento": "V12345678",
    "firstName": "Juan",
    "lastName": "Pérez",
    "fullName": "Juan Pérez",
    "email": "juanperez@gmail.com",
    "phone": "0414-123-4567",
    "organizationName": "Organización A"
  },
  "faltanDatos": false
}
``` 