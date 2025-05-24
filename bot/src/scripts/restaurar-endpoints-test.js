#!/usr/bin/env node
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// URL del servidor
const API_URL = 'http://localhost:3006';

// Función para probar endpoint de eventos sin autenticación
async function probarEndpointEventos() {
  console.log('********************************************************************************');
  console.log('*                                                                              *');
  console.log('*         PRUEBA DE ENDPOINTS SIN AUTENTICACIÓN - DIAGNÓSTICO                  *');
  console.log('*                                                                              *');
  console.log('* Este script verifica si los endpoints sin autenticación están funcionando    *');
  console.log('* correctamente y propone soluciones en caso de problemas.                     *');
  console.log('*                                                                              *');
  console.log('********************************************************************************');
  console.log('\n');
  
  try {
    // Probar endpoint de eventos sin autenticación
    console.log('📋 Probando endpoint de eventos sin autenticación (/api/events/test)');
    
    try {
      const respuesta = await axios.get(`${API_URL}/api/events/test`);
      console.log('✅ Endpoint de eventos funcionando correctamente');
      console.log(`Se encontraron ${respuesta.data.length} eventos.`);
      return true;
    } catch (error) {
      console.log('❌ Error al acceder al endpoint de eventos:', error.response?.data || error.message);
      
      if (error.response?.status === 404 || error.message.includes('404')) {
        console.log('\n⚠️ El endpoint /api/events/test no está disponible.');
        console.log('Esto puede deberse a que:');
        console.log('1. El servidor no está en ejecución');
        console.log('2. El endpoint no está registrado correctamente');
        console.log('3. Hay un problema con la configuración de rutas');
        
        return false;
      }
      
      return false;
    }
  } catch (error) {
    console.error('Error general:', error.message);
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

// Función para restaurar los endpoints de test
function restaurarEndpointsTest() {
  const routesPath = path.join(__dirname, '../routes.js');
  
  try {
    if (!fs.existsSync(routesPath)) {
      console.log('❌ No se encontró el archivo routes.js');
      return false;
    }
    
    let contenido = fs.readFileSync(routesPath, 'utf8');
    
    // Verificar si ya existen los endpoints de test
    if (contenido.includes('app.get(\'/api/events/test\'')) {
      console.log('✅ Los endpoints de test ya existen en routes.js');
      return true;
    }
    
    // Buscar el punto de inserción (justo antes del cierre de la función setupRoutes)
    const puntoCierre = contenido.lastIndexOf('console.log(\'Rutas configuradas correctamente\');');
    
    if (puntoCierre === -1) {
      console.log('❌ No se encontró el punto de inserción en routes.js');
      return false;
    }
    
    // Endpoint de eventos sin autenticación
    const endpointEventos = `
  // Endpoints de prueba sin autenticación (restaurados)
  app.get('/api/events/test', async (req, res) => {
    try {
      const { sequelize } = require('./database');
      
      const query = \`
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
      \`;
      
      const [events] = await sequelize.query(query);
      
      res.json(events);
    } catch (error) {
      console.error('Error al obtener eventos (test):', error);
      res.status(500).json({ error: 'Error al obtener eventos' });
    }
  });

`;
    
    // Insertar el endpoint antes del cierre
    const nuevoContenido = contenido.slice(0, puntoCierre) + endpointEventos + contenido.slice(puntoCierre);
    
    // Guardar el archivo modificado
    fs.writeFileSync(routesPath, nuevoContenido);
    
    console.log('✅ Endpoints de test restaurados en routes.js');
    console.log('⚠️ Es necesario reiniciar el servidor para que los cambios tengan efecto.');
    return true;
  } catch (error) {
    console.error('Error al restaurar endpoints:', error.message);
    return false;
  }
}

// Función principal
async function main() {
  // Probar si el endpoint funciona
  const endpointFunciona = await probarEndpointEventos();
  
  if (!endpointFunciona) {
    console.log('\n🔧 Intentando resolver el problema...');
    
    // Crear backup antes de hacer cambios
    const backupCreado = crearBackupRoutes();
    
    if (backupCreado) {
      // Restaurar los endpoints de test
      const restaurado = restaurarEndpointsTest();
      
      if (restaurado) {
        console.log('\n✅ Solución aplicada correctamente.');
        console.log('\n📋 PASOS SIGUIENTES:');
        console.log('1. Reinicia el servidor con: npm restart (o el comando que utilices)');
        console.log('2. Vuelve a ejecutar este script para verificar que el endpoint esté funcionando');
        console.log('3. Prueba de nuevo la funcionalidad que estaba fallando');
      } else {
        console.log('\n❌ No se pudo aplicar la solución automáticamente.');
        console.log('Por favor, agrega manualmente el endpoint /api/events/test en routes.js');
      }
    }
  } else {
    console.log('\n✅ Los endpoints están funcionando correctamente. No se requiere ninguna acción.');
  }
}

// Ejecutar script
main().catch(error => {
  console.error('Error en la ejecución del script:', error.message);
}); 