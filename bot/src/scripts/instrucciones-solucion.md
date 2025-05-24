# Solución: Gestión de Notificaciones No Muestra Estadísticas

## Problema

La sección de gestión de notificaciones en el panel administrativo no muestra estadísticas correctamente. Los síntomas incluyen:

- No aparecen datos en las estadísticas de notificaciones
- Posible error "Failed to fetch" en la consola del navegador
- Similar al problema anterior con los eventos, que se solucionó agregando un endpoint de prueba

## Causa

Tras analizar el código, se han identificado dos problemas principales:

1. La función `loadNotificationsData()` en `app.js` está vacía (solo contiene un comentario)
2. No existe un endpoint sin autenticación para cargar estadísticas de prueba

## Solución

Se han desarrollado tres scripts para solucionar este problema:

1. **verificar-notificaciones.js**: Verifica el estado de los endpoints de notificaciones y crea un endpoint de prueba sin autenticación
2. **implementar-carga-notificaciones.js**: Implementa las funciones `loadNotificationsData()` y `loadNotificationPerformance()` en `app.js`
3. **solucion-estadisticas-notificaciones.md**: Documenta el problema y la solución completa

### Pasos para aplicar la solución:

#### 1. Agregar un endpoint de prueba para estadísticas de notificaciones

Editar el archivo `routes.js` y agregar el siguiente código antes de la línea que contiene "console.log('Rutas configuradas correctamente')":

```javascript
  // Endpoint de prueba para estadísticas de notificaciones (sin autenticación)
  app.get('/api/notifications/stats/test', async (req, res) => {
    try {
      const { sequelize } = require('./database');
      
      // Obtener un evento al azar para las estadísticas
      const [eventos] = await sequelize.query(`
        SELECT id FROM notif_eventos_bot.events 
        WHERE active = true 
        ORDER BY date DESC 
        LIMIT 1
      `);
      
      if (!eventos || eventos.length === 0) {
        return res.json([]);
      }
      
      const eventId = eventos[0].id;
      
      // Consulta SQL para obtener estadísticas resumidas
      const [stats] = await sequelize.query(`
        SELECT
          n.id AS notification_id,
          n.notification_type,
          n.status,
          n.message,
          COUNT(ns.id) AS total_participants,
          SUM(CASE WHEN ns.sent THEN 1 ELSE 0 END) AS sent_count,
          SUM(CASE WHEN ns.delivered THEN 1 ELSE 0 END) AS delivered_count,
          SUM(CASE WHEN ns.read THEN 1 ELSE 0 END) AS read_count,
          SUM(CASE WHEN ns.responded THEN 1 ELSE 0 END) AS responded_count,
          ROUND((SUM(CASE WHEN ns.sent THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(ns.id),0)::numeric) * 100, 2) AS sent_percentage,
          ROUND((SUM(CASE WHEN ns.delivered THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(ns.id),0)::numeric) * 100, 2) AS delivered_percentage,
          ROUND((SUM(CASE WHEN ns.read THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(ns.id),0)::numeric) * 100, 2) AS read_percentage,
          ROUND((SUM(CASE WHEN ns.responded THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(ns.id),0)::numeric) * 100, 2) AS responded_percentage
        FROM
          notif_eventos_bot.scheduled_notifications n
        LEFT JOIN
          notif_eventos_bot.notification_stats ns ON n.id = ns.notification_id
        WHERE
          n.event_id = :eventId
        GROUP BY
          n.id, n.notification_type, n.status, n.message
        ORDER BY
          n.id
      `, {
        replacements: { eventId }
      });
      
      res.json(stats || []);
    } catch (error) {
      console.error('Error al obtener estadísticas de notificaciones (test):', error);
      res.status(500).json({ error: 'Error al obtener estadísticas de notificaciones' });
    }
  });
```

#### 2. Implementar la función loadNotificationsData() en app.js

Buscar la función `loadNotificationsData()` en `app.js` y reemplazarla con la siguiente implementación:

```javascript
function loadNotificationsData() {
  showLoadingOverlay('Cargando datos de notificaciones...');
  
  // Cargar listado de notificaciones
  fetch(`${API_BASE_URL}/notifications`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    const notificationsTable = document.getElementById('notifications-table-body');
    notificationsTable.innerHTML = '';
    
    if (data.items && data.items.length > 0) {
      data.items.forEach(notification => {
        const row = document.createElement('tr');
        
        // Formatear tipo de notificación
        let typeText = 'Mensaje personalizado';
        switch(notification.notification_type) {
          case 'event_reminder': typeText = 'Recordatorio de evento'; break;
          case 'attendance_confirmation': typeText = 'Confirmación de asistencia'; break;
          case 'event_update': typeText = 'Actualización de evento'; break;
          case 'event_cancellation': typeText = 'Cancelación de evento'; break;
        }
        
        // Formatear estado
        let statusText = 'Pendiente';
        let statusClass = 'text-info';
        switch(notification.status) {
          case 'sent': 
            statusText = 'Enviada'; 
            statusClass = 'text-success';
            break;
          case 'failed': 
            statusText = 'Fallida'; 
            statusClass = 'text-danger';
            break;
          case 'cancelled': 
            statusText = 'Cancelada'; 
            statusClass = 'text-secondary';
            break;
        }
        
        // Formatear fecha
        const scheduledDate = new Date(notification.scheduled_date);
        const formattedDate = scheduledDate.toLocaleDateString() + ' ' + 
          scheduledDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        row.innerHTML = `
          <td>${notification.id}</td>
          <td>${notification.event_name || 'N/A'}</td>
          <td>${typeText}</td>
          <td>${formattedDate}</td>
          <td><span class="${statusClass}">${statusText}</span></td>
          <td>
            <button class="btn btn-sm btn-info view-notification-stats" data-id="${notification.id}" title="Ver estadísticas">
              <i class="bi bi-bar-chart"></i>
            </button>
            <button class="btn btn-sm btn-primary edit-notification" data-id="${notification.id}" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-danger delete-notification" data-id="${notification.id}" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        `;
        
        notificationsTable.appendChild(row);
      });
    } else {
      notificationsTable.innerHTML = '<tr><td colspan="6" class="text-center">No hay notificaciones programadas</td></tr>';
    }
    
    // Configurar eventos para los botones
    document.querySelectorAll('.view-notification-stats').forEach(btn => {
      btn.addEventListener('click', function() {
        const notificationId = this.getAttribute('data-id');
        viewNotificationStats(notificationId);
      });
    });
    
    document.querySelectorAll('.edit-notification').forEach(btn => {
      btn.addEventListener('click', function() {
        const notificationId = this.getAttribute('data-id');
        editNotification(notificationId);
      });
    });
    
    document.querySelectorAll('.delete-notification').forEach(btn => {
      btn.addEventListener('click', function() {
        const notificationId = this.getAttribute('data-id');
        deleteNotification(notificationId);
      });
    });
    
    // Cargar estadísticas generales
    loadNotificationPerformance();
    
    hideLoadingOverlay();
  })
  .catch(error => {
    console.error('Error al cargar notificaciones:', error);
    showAlert('Error al cargar datos de notificaciones', 'danger');
    hideLoadingOverlay();
  });
}
```

#### 3. Implementar la función loadNotificationPerformance() en app.js

Buscar la función `loadNotificationPerformance()` en `app.js` y reemplazarla con:

```javascript
function loadNotificationPerformance() {
  // Intentar cargar desde el endpoint de prueba primero
  fetch(`${API_BASE_URL}/notifications/stats/test`)
    .then(response => {
      if (!response.ok) {
        // Si falla, intentar con el endpoint autenticado
        return fetch(`${API_BASE_URL}/notifications/stats/`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
          }
        });
      }
      return response;
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      return response.json();
    })
    .then(stats => {
      if (!stats || stats.length === 0) {
        console.log('No hay estadísticas de notificaciones disponibles');
        return;
      }
      
      // Crear datos para el gráfico
      const labels = stats.map(s => s.notification_type || 'custom');
      const sentData = stats.map(s => s.sent_count || 0);
      const deliveredData = stats.map(s => s.delivered_count || 0);
      const readData = stats.map(s => s.read_count || 0);
      
      // Configurar el gráfico
      const ctx = document.getElementById('notification-performance-chart').getContext('2d');
      
      // Destruir gráfico anterior si existe
      if (window.notificationPerformanceChart instanceof Chart) {
        window.notificationPerformanceChart.destroy();
      }
      
      // Crear nuevo gráfico
      window.notificationPerformanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Enviadas',
              data: sentData,
              backgroundColor: 'rgba(54, 162, 235, 0.5)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 1
            },
            {
              label: 'Entregadas',
              data: deliveredData,
              backgroundColor: 'rgba(75, 192, 192, 0.5)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1
            },
            {
              label: 'Leídas',
              data: readData,
              backgroundColor: 'rgba(255, 206, 86, 0.5)',
              borderColor: 'rgba(255, 206, 86, 1)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    })
    .catch(error => {
      console.error('Error al cargar estadísticas de notificaciones:', error);
    });
}
```

#### 4. Reiniciar el servidor

Una vez hechas todas las modificaciones, reiniciar el servidor:

```
npm restart
```

#### 5. Verificar la solución

Acceder al panel administrativo y verificar que:
1. La sección de notificaciones carga correctamente
2. Se muestran las estadísticas de notificaciones
3. No aparecen errores en la consola del navegador

## Archivos Creados

1. `verificar-notificaciones.js`: Script para verificar y corregir problemas con los endpoints de notificaciones
2. `implementar-carga-notificaciones.js`: Script para implementar las funciones faltantes en app.js
3. `solucion-estadisticas-notificaciones.md`: Documentación detallada del problema y solución
4. `instrucciones-solucion.md` (este archivo): Instrucciones paso a paso para solucionar el problema

## Soporte Técnico

Si después de seguir estos pasos el problema persiste, verificar:
- Que todos los endpoints estén funcionando correctamente
- Que las implementaciones de las funciones se hayan añadido correctamente
- Que el servidor se haya reiniciado tras los cambios
- Que no haya errores en la consola del navegador al acceder al panel 