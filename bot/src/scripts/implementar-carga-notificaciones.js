#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Ruta del archivo app.js
const appPath = path.join(__dirname, '../dashboard/admin/app.js');

// Función para implementar loadNotificationsData
function implementarCargaNotificaciones() {
  console.log('********************************************************************************');
  console.log('*                                                                              *');
  console.log('*       IMPLEMENTACIÓN DE CARGA DE DATOS DE NOTIFICACIONES                     *');
  console.log('*                                                                              *');
  console.log('* Este script implementa la función loadNotificationsData en app.js que        *');
  console.log('* actualmente está vacía                                                       *');
  console.log('*                                                                              *');
  console.log('********************************************************************************');
  console.log('\n');
  
  try {
    // Verificar si existe el archivo
    if (!fs.existsSync(appPath)) {
      console.log(`❌ No se encontró el archivo app.js en ${appPath}`);
      return false;
    }
    
    // Leer el contenido del archivo
    let contenido = fs.readFileSync(appPath, 'utf8');
    
    // Buscar la función loadNotificationsData
    const patronFuncion = /function loadNotificationsData\(\) \{\s*\/\/ \.\.\. existing implementation \.\.\.\s*\}/;
    
    // Verificar si la función está en el formato esperado
    if (!patronFuncion.test(contenido)) {
      console.log('⚠️ La función loadNotificationsData() no está en el formato esperado.');
      console.log('Buscando manualmente...');
      
      // Buscar de manera menos restrictiva
      const patronAlternativo = /function loadNotificationsData\(\) \{[^}]*\}/;
      if (!patronAlternativo.test(contenido)) {
        console.log('❌ No se pudo encontrar la función loadNotificationsData() en el archivo.');
        return false;
      }
      
      console.log('✅ Función encontrada con un formato diferente al esperado.');
    }
    
    // Crear backup del archivo
    const backupPath = `${appPath}.bak`;
    fs.copyFileSync(appPath, backupPath);
    console.log(`✅ Backup creado en ${backupPath}`);
    
    // Código de implementación de la función loadNotificationsData
    const nuevaImplementacion = `function loadNotificationsData() {
  showLoadingOverlay('Cargando datos de notificaciones...');
  
  // Cargar listado de notificaciones
  fetch(\`\${API_BASE_URL}/notifications\`, {
    headers: {
      'Authorization': \`Bearer \${localStorage.getItem('adminToken')}\`
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(\`Error: \${response.status}\`);
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
        
        row.innerHTML = \`
          <td>\${notification.id}</td>
          <td>\${notification.event_name || 'N/A'}</td>
          <td>\${typeText}</td>
          <td>\${formattedDate}</td>
          <td><span class="\${statusClass}">\${statusText}</span></td>
          <td>
            <button class="btn btn-sm btn-info view-notification-stats" data-id="\${notification.id}" title="Ver estadísticas">
              <i class="bi bi-bar-chart"></i>
            </button>
            <button class="btn btn-sm btn-primary edit-notification" data-id="\${notification.id}" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-danger delete-notification" data-id="\${notification.id}" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        \`;
        
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
}`;
    
    // Reemplazar la función vacía con la implementación completa
    const contenidoActualizado = contenido.replace(patronFuncion, nuevaImplementacion);
    
    // Si no se pudo reemplazar con el patrón exacto, intentar con un patrón más general
    if (contenidoActualizado === contenido) {
      const patronGeneral = /function loadNotificationsData\(\) \{[^}]*\}/;
      const contenidoActualizado2 = contenido.replace(patronGeneral, nuevaImplementacion);
      
      if (contenidoActualizado2 === contenido) {
        console.log('❌ No se pudo reemplazar la función. Prueba actualizar manualmente.');
        return false;
      }
      
      // Guardar el archivo con la implementación
      fs.writeFileSync(appPath, contenidoActualizado2);
    } else {
      // Guardar el archivo con la implementación
      fs.writeFileSync(appPath, contenidoActualizado);
    }
    
    console.log('✅ Función loadNotificationsData() implementada correctamente.');
    
    // Verificar que la función loadNotificationPerformance exista y esté implementada
    const patronPerformance = /function loadNotificationPerformance\(\) \{\s*\/\/ \.\.\. existing implementation \.\.\.\s*\}/;
    
    if (patronPerformance.test(contenido)) {
      console.log('⚠️ La función loadNotificationPerformance() está vacía. También debería implementarse.');
      
      // Implementación de loadNotificationPerformance
      const implementacionPerformance = `function loadNotificationPerformance() {
  // Intentar cargar desde el endpoint de prueba primero
  fetch(\`\${API_BASE_URL}/notifications/stats/test\`)
    .then(response => {
      if (!response.ok) {
        // Si falla, intentar con el endpoint autenticado
        return fetch(\`\${API_BASE_URL}/notifications/stats/\`, {
          headers: {
            'Authorization': \`Bearer \${localStorage.getItem('adminToken')}\`
          }
        });
      }
      return response;
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(\`Error: \${response.status}\`);
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
}`;
      
      // Reemplazar también la función de performance
      let contenidoFinal = fs.readFileSync(appPath, 'utf8');
      contenidoFinal = contenidoFinal.replace(patronPerformance, implementacionPerformance);
      
      // Si no se pudo reemplazar con el patrón exacto, intentar con un patrón más general
      if (contenidoFinal === fs.readFileSync(appPath, 'utf8')) {
        const patronGeneralPerformance = /function loadNotificationPerformance\(\) \{[^}]*\}/;
        contenidoFinal = contenidoFinal.replace(patronGeneralPerformance, implementacionPerformance);
      }
      
      // Guardar el archivo con ambas implementaciones
      fs.writeFileSync(appPath, contenidoFinal);
      console.log('✅ Función loadNotificationPerformance() implementada correctamente.');
    }
    
    console.log('\n📋 PASOS SIGUIENTES:');
    console.log('1. Reinicie el servidor con: npm restart');
    console.log('2. Ejecute el script verificar-notificaciones.js para asegurar que los endpoints estén funcionando');
    console.log('3. Acceda al panel administrativo y verifique que la sección de notificaciones muestra datos y estadísticas');
    
    return true;
  } catch (error) {
    console.error('Error al implementar la función:', error.message);
    return false;
  }
}

// Ejecutar función principal
implementarCargaNotificaciones(); 