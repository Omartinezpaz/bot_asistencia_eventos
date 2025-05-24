#!/usr/bin/env node
const axios = require('axios');
const Table = require('cli-table3');
const fs = require('fs');
const path = require('path');

// URL del servidor
const API_URL = 'http://localhost:3006';

// Función para obtener un token de autenticación
async function obtenerToken() {
  try {
    const respuesta = await axios.post(`${API_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    return respuesta.data.token;
  } catch (error) {
    console.error('Error al obtener token:', error.response?.data || error.message);
    return null;
  }
}

// Función para verificar el endpoint de estadísticas de notificaciones
async function verificarEstadisticasNotificaciones(token) {
  console.log('⏳ Verificando endpoint de estadísticas de notificaciones...');
  
  try {
    // Primero obtener un evento para usar su ID
    const respuestaEventos = await axios.get(`${API_URL}/api/events/test`);
    
    if (!respuestaEventos.data || respuestaEventos.data.length === 0) {
      console.log('⚠️ No se encontraron eventos para probar las estadísticas de notificaciones');
      return {
        estado: 'ADVERTENCIA',
        codigo: 200,
        mensaje: 'No hay eventos disponibles para probar',
        error: null
      };
    }
    
    const eventId = respuestaEventos.data[0].id;
    console.log(`📊 Usando evento ID ${eventId} para prueba de estadísticas`);
    
    // Intentar obtener estadísticas para ese evento
    const respuesta = await axios.get(`${API_URL}/api/notifications/stats/${eventId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      timeout: 5000
    });
    
    if (respuesta.status === 200) {
      return {
        estado: 'OK',
        codigo: respuesta.status,
        mensaje: `Se obtuvieron ${respuesta.data.length || 0} registros de estadísticas`,
        error: null
      };
    } else {
      return {
        estado: 'ERROR',
        codigo: respuesta.status,
        mensaje: 'Respuesta inesperada',
        error: 'La respuesta no fue 200 OK'
      };
    }
  } catch (error) {
    return {
      estado: 'ERROR',
      codigo: error.response?.status || 'N/A',
      mensaje: 'Falló la solicitud',
      error: error.response?.data?.error || error.message
    };
  }
}

// Función para verificar el endpoint de obtener notificaciones
async function verificarListadoNotificaciones(token) {
  console.log('⏳ Verificando endpoint de listado de notificaciones...');
  
  try {
    const respuesta = await axios.get(`${API_URL}/api/notifications`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      timeout: 5000
    });
    
    if (respuesta.status === 200) {
      const cantidadNotificaciones = respuesta.data.items ? respuesta.data.items.length : 0;
      return {
        estado: 'OK',
        codigo: respuesta.status,
        mensaje: `Se obtuvieron ${cantidadNotificaciones} notificaciones`,
        error: null
      };
    } else {
      return {
        estado: 'ERROR',
        codigo: respuesta.status,
        mensaje: 'Respuesta inesperada',
        error: 'La respuesta no fue 200 OK'
      };
    }
  } catch (error) {
    return {
      estado: 'ERROR',
      codigo: error.response?.status || 'N/A',
      mensaje: 'Falló la solicitud',
      error: error.response?.data?.error || error.message
    };
  }
}

// Función para crear un endpoint de prueba para estadísticas de notificaciones
function crearEndpointPruebaNotificaciones() {
  console.log('⏳ Verificando si existe un endpoint de prueba para estadísticas de notificaciones...');
  
  const routesPath = path.join(__dirname, '../routes.js');
  
  try {
    if (!fs.existsSync(routesPath)) {
      console.log('❌ No se encontró el archivo routes.js');
      return false;
    }
    
    let contenido = fs.readFileSync(routesPath, 'utf8');
    
    // Verificar si ya existe el endpoint de prueba
    if (contenido.includes('app.get(\'/api/notifications/stats/test\'')) {
      console.log('✅ El endpoint de prueba para estadísticas de notificaciones ya existe');
      return true;
    }
    
    // Buscar el punto de inserción (justo antes del cierre de la función setupRoutes)
    const puntoCierre = contenido.lastIndexOf('console.log(\'Rutas configuradas correctamente\');');
    
    if (puntoCierre === -1) {
      console.log('❌ No se encontró el punto de inserción en routes.js');
      return false;
    }
    
    // Endpoint de estadísticas de notificaciones sin autenticación
    const endpointNotificaciones = `
  // Endpoint de prueba para estadísticas de notificaciones (sin autenticación)
  app.get('/api/notifications/stats/test', async (req, res) => {
    try {
      const { sequelize } = require('./database');
      
      // Obtener un evento al azar para las estadísticas
      const [eventos] = await sequelize.query(\`
        SELECT id FROM notif_eventos_bot.events 
        WHERE active = true 
        ORDER BY date DESC 
        LIMIT 1
      \`);
      
      if (!eventos || eventos.length === 0) {
        return res.json([]);
      }
      
      const eventId = eventos[0].id;
      
      // Consulta SQL para obtener estadísticas resumidas
      const [stats] = await sequelize.query(\`
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
      \`, {
        replacements: { eventId }
      });
      
      res.json(stats || []);
    } catch (error) {
      console.error('Error al obtener estadísticas de notificaciones (test):', error);
      res.status(500).json({ error: 'Error al obtener estadísticas de notificaciones' });
    }
  });

`;
    
    // Insertar el endpoint antes del cierre
    const nuevoContenido = contenido.slice(0, puntoCierre) + endpointNotificaciones + contenido.slice(puntoCierre);
    
    // Guardar el archivo modificado
    fs.writeFileSync(routesPath, nuevoContenido);
    
    console.log('✅ Endpoint de prueba para estadísticas de notificaciones creado');
    console.log('⚠️ Es necesario reiniciar el servidor para que los cambios tengan efecto.');
    return true;
  } catch (error) {
    console.error('Error al crear endpoint de prueba:', error.message);
    return false;
  }
}

// Función para crear el backup de routes.js
function crearBackupRoutes() {
  const routesPath = path.join(__dirname, '../routes.js');
  const backupPath = path.join(__dirname, '../routes.js.bak');
  
  try {
    if (fs.existsSync(routesPath)) {
      fs.copyFileSync(routesPath, backupPath);
      console.log('✅ Backup de routes.js creado en:', backupPath);
      return true;
    } else {
      console.log('❌ No se encontró el archivo routes.js en:', routesPath);
      return false;
    }
  } catch (error) {
    console.error('Error al crear backup:', error.message);
    return false;
  }
}

// Función para probar el endpoint de prueba de estadísticas de notificaciones
async function probarEndpointEstadisticasTest() {
  console.log('⏳ Probando endpoint de estadísticas de notificaciones sin autenticación...');
  
  try {
    const respuesta = await axios.get(`${API_URL}/api/notifications/stats/test`, { timeout: 5000 });
    
    if (respuesta.status === 200) {
      console.log(`✅ Endpoint de prueba funcionando correctamente`);
      console.log(`Se obtuvieron ${respuesta.data.length || 0} registros de estadísticas`);
      return {
        estado: 'OK',
        codigo: respuesta.status,
        mensaje: `Se obtuvieron ${respuesta.data.length || 0} registros de estadísticas`,
        error: null
      };
    } else {
      console.log(`❌ Respuesta inesperada del endpoint de prueba: ${respuesta.status}`);
      return {
        estado: 'ERROR',
        codigo: respuesta.status,
        mensaje: 'Respuesta inesperada',
        error: 'La respuesta no fue 200 OK'
      };
    }
  } catch (error) {
    console.log(`❌ Error al probar el endpoint de prueba: ${error.message}`);
    return {
      estado: 'ERROR',
      codigo: error.response?.status || 'N/A',
      mensaje: 'Falló la solicitud',
      error: error.response?.data?.error || error.message
    };
  }
}

// Función principal
async function main() {
  console.log('********************************************************************************');
  console.log('*                                                                              *');
  console.log('*       VERIFICACIÓN DE ESTADÍSTICAS DE NOTIFICACIONES                         *');
  console.log('*                                                                              *');
  console.log('* Este script verifica el funcionamiento del sistema de estadísticas           *');
  console.log('* de notificaciones y crea un endpoint de prueba si es necesario.              *');
  console.log('*                                                                              *');
  console.log('********************************************************************************');
  console.log('\n');
  
  try {
    // Verificar si el servidor está en ejecución
    try {
      await axios.get(`${API_URL}/api/test`, { timeout: 2000 });
      console.log('✅ Servidor en ejecución');
    } catch (error) {
      console.log('❌ El servidor no parece estar en ejecución. Verifique que el servidor esté iniciado.');
      process.exit(1);
    }
    
    // Obtener token de autenticación
    const token = await obtenerToken();
    if (!token) {
      console.log('❌ No se pudo obtener un token de autenticación. Verificando alternativas...');
    } else {
      console.log('✅ Token de autenticación obtenido correctamente');
    }
    
    let resultados = [];
    
    // Si tiene token, probar los endpoints que requieren autenticación
    if (token) {
      // Verificar endpoint de listado de notificaciones
      const resultadoListado = await verificarListadoNotificaciones(token);
      resultados.push({
        endpoint: '/api/notifications',
        descripcion: 'Listado de notificaciones',
        ...resultadoListado
      });
      
      // Verificar endpoint de estadísticas de notificaciones
      const resultadoEstadisticas = await verificarEstadisticasNotificaciones(token);
      resultados.push({
        endpoint: '/api/notifications/stats/:eventId',
        descripcion: 'Estadísticas de notificaciones por evento',
        ...resultadoEstadisticas
      });
    }
    
    // Verificar si existe un endpoint de prueba para estadísticas
    let pruebaTest = await probarEndpointEstadisticasTest();
    
    // Si el endpoint de prueba no existe o no funciona, intentar crearlo
    if (pruebaTest.estado === 'ERROR') {
      console.log('⚠️ El endpoint de prueba para estadísticas de notificaciones no existe o no funciona');
      console.log('🔧 Intentando crear el endpoint de prueba...');
      
      // Crear backup antes de hacer cambios
      const backupCreado = crearBackupRoutes();
      
      if (backupCreado) {
        // Crear endpoint de prueba
        const endpointCreado = crearEndpointPruebaNotificaciones();
        
        if (endpointCreado) {
          resultados.push({
            endpoint: '/api/notifications/stats/test',
            descripcion: 'Estadísticas de notificaciones (prueba)',
            estado: 'PENDIENTE',
            codigo: 'N/A',
            mensaje: 'Endpoint creado, reinicie el servidor para activarlo',
            error: null
          });
        } else {
          resultados.push({
            endpoint: '/api/notifications/stats/test',
            descripcion: 'Estadísticas de notificaciones (prueba)',
            estado: 'ERROR',
            codigo: 'N/A',
            mensaje: 'No se pudo crear el endpoint',
            error: 'Error al modificar routes.js'
          });
        }
      }
    } else {
      // El endpoint de prueba ya existe y funciona
      resultados.push({
        endpoint: '/api/notifications/stats/test',
        descripcion: 'Estadísticas de notificaciones (prueba)',
        ...pruebaTest
      });
    }
    
    // Crear tabla con resultados
    const tabla = new Table({
      head: ['Endpoint', 'Descripción', 'Estado', 'Código', 'Mensaje', 'Error'],
      style: {
        head: ['cyan'],
        border: []
      }
    });
    
    // Función para colorear texto en consola
    function colorear(texto, estado) {
      if (process.stdout.isTTY) {
        const colores = {
          'OK': '\x1b[32m',           // Verde
          'ERROR': '\x1b[31m',        // Rojo
          'ADVERTENCIA': '\x1b[33m',  // Amarillo
          'PENDIENTE': '\x1b[36m',    // Cyan
          'reset': '\x1b[0m'          // Reset
        };
        
        return `${colores[estado] || ''}${texto}${colores.reset}`;
      }
      return texto;
    }
    
    resultados.forEach(r => {
      tabla.push([
        r.endpoint,
        r.descripcion,
        colorear(r.estado, r.estado),
        r.codigo,
        r.mensaje,
        r.error || ''
      ]);
    });
    
    console.log(tabla.toString());
    
    // Mostrar resumen y recomendaciones
    const endpointsOK = resultados.filter(r => r.estado === 'OK').length;
    const endpointsError = resultados.filter(r => r.estado === 'ERROR').length;
    const endpointsPendientes = resultados.filter(r => r.estado === 'PENDIENTE').length;
    
    console.log(`\nResumen: ${endpointsOK}/${resultados.length} endpoints funcionando correctamente`);
    
    if (endpointsError > 0 || endpointsPendientes > 0) {
      console.log(`\n📋 PASOS SIGUIENTES:`);
      
      if (endpointsPendientes > 0) {
        console.log('1. Reinicie el servidor para activar los endpoints creados con: npm restart');
        console.log('2. Vuelva a ejecutar este script para verificar que los endpoints estén funcionando');
      } else if (endpointsError > 0) {
        console.log('1. Revise los errores en los endpoints y corrija los problemas');
        console.log('2. Si es necesario, ejecute el script restaurar-endpoints-test.js para restaurar endpoints faltantes');
        console.log('3. Verifique que los archivos routes.js y el servicio de notificaciones estén funcionando correctamente');
      }
    } else {
      console.log('\n✅ Todos los endpoints de notificaciones están funcionando correctamente.');
    }
  } catch (error) {
    console.error('Error general:', error.message);
  }
}

// Ejecutar script
main().catch(error => {
  console.error('Error en la ejecución del script:', error.message);
}); 