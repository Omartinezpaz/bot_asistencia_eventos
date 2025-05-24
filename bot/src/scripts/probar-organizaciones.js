#!/usr/bin/env node
const axios = require('axios');

// URL del servidor
const API_URL = 'http://localhost:3006';

// Función para obtener token de autenticación
async function obtenerToken() {
  try {
    const respuesta = await axios.post(`${API_URL}/api/auth/login`, {
      username: 'admin',
      password: process.env.ADMIN_PASSWORD || 'admin123' // Obtener de variable de entorno o usar valor por defecto
    });
    
    return respuesta.data.token;
  } catch (error) {
    console.error('Error al obtener token:', error.response?.data || error.message);
    console.log('Intentando con autenticación básica como alternativa...');
    return null;
  }
}

// Función para probar endpoints de organizaciones
async function probarOrganizaciones() {
  console.log('********************************************************************************');
  console.log('*                                                                              *');
  console.log('*                  PRUEBA DE ENDPOINTS DE ORGANIZACIONES                       *');
  console.log('*                                                                              *');
  console.log('* Este script prueba todos los endpoints relacionados con organizaciones.      *');
  console.log('* Para ejecutar correctamente, el servidor debe estar en funcionamiento.       *');
  console.log('*                                                                              *');
  console.log('* Las pruebas verifican:                                                       *');
  console.log('* - Listado, creación, actualización y eliminación de organizaciones          *');
  console.log('* - Cambio de estado (activar/desactivar)                                     *');
  console.log('* - Obtención de listas para dropdowns                                        *');
  console.log('*                                                                              *');
  console.log('********************************************************************************');
  console.log('\n');
  
  try {
    // Obtener token de autenticación
    console.log('Obteniendo token de autenticación...');
    let token;
    try {
      token = await obtenerToken();
      if (token) {
        console.log('✅ Token JWT obtenido correctamente\n');
      } else {
        console.log('⚠️ No se pudo obtener token JWT, usando autenticación básica\n');
      }
    } catch (error) {
      console.log('⚠️ Error al obtener token, algunas pruebas pueden fallar\n');
    }
    
    // Configurar headers según el método de autenticación disponible
    const headers = token 
      ? { Authorization: `Bearer ${token}` }
      : { Authorization: `Basic ${Buffer.from('admin:admin123').toString('base64')}` };
    
    // CASO 1: Obtener lista de organizaciones
    console.log('📋 CASO 1: Obtener lista de organizaciones');
    try {
      const respuesta = await axios.get(`${API_URL}/api/organizations`, { headers });
      console.log(`✅ Se encontraron ${respuesta.data.length} organizaciones.`);
      
      if (respuesta.data.length > 0) {
        console.log('\nAlgunas organizaciones:');
        for (let i = 0; i < Math.min(3, respuesta.data.length); i++) {
          const org = respuesta.data[i];
          console.log(`- ${org.name} (ID: ${org.id}, Participantes: ${org.participants_count || 0})`);
        }
        
        // Guardar la primera organización para pruebas posteriores
        primeraOrganizacion = respuesta.data[0];
      }
    } catch (error) {
      console.log('❌ Error al obtener organizaciones:', error.response?.data || error.message);
    }
    console.log('\n');
    
    // CASO 2: Crear una nueva organización
    console.log('📋 CASO 2: Crear una nueva organización');
    const nuevaOrganizacion = {
      name: `Organización de Prueba ${new Date().getTime()}`, // Nombre único con timestamp
      description: 'Esta es una organización creada para pruebas',
      contactEmail: 'contacto@organizacion-prueba.com',
      contactPhone: '0414-123-4567',
      isActive: true
    };
    
    let organizacionCreada = null;
    
    try {
      const respuesta = await axios.post(`${API_URL}/api/organizations`, nuevaOrganizacion, { headers });
      organizacionCreada = respuesta.data;
      console.log('✅ Organización creada exitosamente:');
      console.log(`ID: ${organizacionCreada.id}`);
      console.log(`Nombre: ${organizacionCreada.name}`);
      console.log(`Descripción: ${organizacionCreada.description}`);
      console.log(`Email de contacto: ${organizacionCreada.contactEmail}`);
    } catch (error) {
      console.log('❌ Error al crear organización:', error.response?.data || error.message);
    }
    console.log('\n');
    
    // CASO 3: Obtener detalle de una organización
    if (organizacionCreada) {
      console.log(`📋 CASO 3: Obtener detalle de la organización ID: ${organizacionCreada.id}`);
      
      try {
        const respuesta = await axios.get(`${API_URL}/api/organizations/${organizacionCreada.id}`, { headers });
        console.log('✅ Detalles de la organización:');
        console.log(`Nombre: ${respuesta.data.name}`);
        console.log(`Descripción: ${respuesta.data.description}`);
        console.log(`Email: ${respuesta.data.contact_email || 'No especificado'}`);
        console.log(`Teléfono: ${respuesta.data.contact_phone || 'No especificado'}`);
        console.log(`Activa: ${respuesta.data.is_active ? 'Sí' : 'No'}`);
        console.log(`Participantes: ${respuesta.data.participants_count || 0}`);
        console.log(`Eventos: ${respuesta.data.events_count || 0}`);
      } catch (error) {
        console.log('❌ Error al obtener detalles de la organización:', error.response?.data || error.message);
      }
      console.log('\n');
      
      // CASO 4: Actualizar una organización
      console.log(`📋 CASO 4: Actualizar la organización ID: ${organizacionCreada.id}`);
      
      const datosActualizados = {
        ...nuevaOrganizacion,
        name: `${nuevaOrganizacion.name} (Actualizada)`,
        description: 'Descripción actualizada para pruebas',
        contactEmail: 'nuevo-contacto@organizacion-prueba.com'
      };
      
      try {
        const respuesta = await axios.put(`${API_URL}/api/organizations/${organizacionCreada.id}`, datosActualizados, { headers });
        console.log('✅ Organización actualizada exitosamente:');
        console.log(`Nombre: ${respuesta.data.name}`);
        console.log(`Email: ${respuesta.data.contactEmail}`);
      } catch (error) {
        console.log('❌ Error al actualizar organización:', error.response?.data || error.message);
      }
      console.log('\n');
      
      // CASO 5: Cambiar estado de una organización
      console.log(`📋 CASO 5: Cambiar estado de la organización ID: ${organizacionCreada.id}`);
      
      try {
        const respuesta = await axios.patch(`${API_URL}/api/organizations/${organizacionCreada.id}/toggle-status`, 
          { active: false }, 
          { headers }
        );
        console.log('✅ Estado cambiado exitosamente:');
        console.log(`Activa: ${respuesta.data.active ? 'Sí' : 'No'}`);
        
        // Volver a activar
        const respuestaActivar = await axios.patch(`${API_URL}/api/organizations/${organizacionCreada.id}/toggle-status`, 
          { active: true }, 
          { headers }
        );
        console.log('✅ Organización reactivada:', respuestaActivar.data.active ? 'Sí' : 'No');
      } catch (error) {
        console.log('❌ Error al cambiar estado de organización:', error.response?.data || error.message);
      }
      console.log('\n');
      
      // CASO 6: Obtener lista de organizaciones para dropdown
      console.log('📋 CASO 6: Obtener lista de organizaciones para dropdown');
      
      try {
        const respuesta = await axios.get(`${API_URL}/api/organizations/list/dropdown`, { headers });
        console.log(`✅ Se encontraron ${respuesta.data.length} organizaciones activas para dropdown.`);
        
        if (respuesta.data.length > 0) {
          console.log('\nAlgunas organizaciones:');
          for (let i = 0; i < Math.min(3, respuesta.data.length); i++) {
            const org = respuesta.data[i];
            console.log(`- ${org.name} (ID: ${org.id})`);
          }
        }
      } catch (error) {
        console.log('❌ Error al obtener lista para dropdown:', error.response?.data || error.message);
      }
      console.log('\n');
      
      // CASO 7: Eliminar una organización (este debe ser el último paso)
      console.log(`📋 CASO 7: Eliminar la organización ID: ${organizacionCreada.id}`);
      
      try {
        const respuesta = await axios.delete(`${API_URL}/api/organizations/${organizacionCreada.id}`, { headers });
        console.log('✅ Organización eliminada exitosamente:', respuesta.data);
      } catch (error) {
        console.log('❌ Error al eliminar organización:', error.response?.data || error.message);
        
        if (error.response?.data?.error?.includes('tiene participantes asociados') || 
            error.response?.data?.error?.includes('tiene eventos asociados')) {
          console.log('ℹ️ No se pudo eliminar porque tiene referencias. Esto es esperado en un entorno real.');
        }
      }
      console.log('\n');
    }
    
    console.log('Pruebas completadas.');
  } catch (error) {
    console.error('Error general:', error.message);
  }
}

// Ejecutar pruebas
probarOrganizaciones().catch(error => {
  console.error('Error al ejecutar pruebas:', error.message);
}); 