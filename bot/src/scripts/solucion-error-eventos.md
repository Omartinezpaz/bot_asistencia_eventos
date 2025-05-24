# Solución al Error "Failed to fetch" al Cargar Eventos

## Problema Detectado

Se ha identificado un error en el panel administrativo que impide cargar la lista de eventos. El error específico es:

```
app.js:1903 Error al cargar eventos para el select: TypeError: Failed to fetch
    at loadEventsForSelect (app.js:1866:12)
    at loadReportsData (app.js:2993:5)
    at HTMLAnchorElement.<anonymous> (app.js:106:9)
```

Este error ocurre cuando:
1. Se intenta acceder a la sección de reportes del panel administrativo
2. La función `loadReportsData()` intenta cargar eventos para el selector usando `loadEventsForSelect()`
3. La llamada al endpoint falla con "Failed to fetch"

## Diagnóstico

El error "Failed to fetch" típicamente indica alguno de estos problemas:
- El servidor no está en ejecución
- El endpoint solicitado no existe o no está registrado correctamente
- Hay problemas de conectividad de red
- El CORS (Cross-Origin Resource Sharing) está bloqueando la solicitud

En este caso específico, el problema está relacionado con el endpoint `/api/events` o `/api/events/test` que debería estar disponible para consultar la lista de eventos.

## Solución Implementada

Se ha desarrollado un script automatizado `restaurar-endpoints-test.js` que:

1. Verifica si el endpoint `/api/events/test` está accesible
2. Crea un backup del archivo `routes.js` para seguridad
3. Restaura el endpoint de prueba de eventos en caso de que falte

Este endpoint especial es necesario porque:
- No requiere autenticación, lo que facilita las pruebas
- Es usado por varios scripts y por el panel administrativo
- Proporciona un acceso rápido a los eventos sin necesidad de manejar tokens

### Pasos para Solucionar el Problema

1. Ejecutar el script de diagnóstico y restauración:
   ```
   node restaurar-endpoints-test.js
   ```

2. Reiniciar el servidor:
   ```
   npm restart
   ```
   o según el método que utilices para reiniciar el servidor.

3. Verificar que el endpoint esté funcionando volviendo a ejecutar el script:
   ```
   node restaurar-endpoints-test.js
   ```

4. Probar la funcionalidad en el panel administrativo

## Prevención de Problemas Futuros

Para evitar problemas similares en el futuro:

1. Mantener una documentación actualizada de todos los endpoints, incluyendo los de prueba
2. Agregar pruebas automatizadas que verifiquen periódicamente que los endpoints críticos estén funcionando
3. Implementar un sistema de monitoreo que alerte cuando un endpoint deje de responder
4. Asegurar que las actualizaciones del código no eliminen inadvertidamente rutas importantes

## Endpoints Importantes para el Panel Administrativo

| Endpoint | Propósito | Autenticación |
|----------|-----------|---------------|
| `/api/events` | Obtener lista de eventos (principal) | Requerida |
| `/api/events/test` | Obtener lista de eventos (prueba) | No requerida |
| `/api/organizations/test` | Obtener lista de organizaciones (prueba) | No requerida |
| `/api/attendances/validate-participant-test` | Validar participante para asistencia (prueba) | No requerida |

## Código Restaurado

El código que se restaura en `routes.js` es:

```javascript
app.get('/api/events/test', async (req, res) => {
  try {
    const { sequelize } = require('./database');
    
    const query = `
      SELECT 
          e.id,
          e.name,
          e.description,
          e.date,
          e.location,
          e.active as is_active,
          o.name as organization_name,
          o.id as organization_id,
          (SELECT COUNT(*) FROM notif_eventos_bot.attendances a WHERE a.eventid = e.id) as attendance_count
      FROM notif_eventos_bot.events e
      LEFT JOIN notif_eventos_bot.organizations o ON e.organization_id = o.id
      ORDER BY e.date DESC
      LIMIT 10
    `;
    
    const [events] = await sequelize.query(query);
    
    res.json(events);
  } catch (error) {
    console.error('Error al obtener eventos (test):', error);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
});
``` 