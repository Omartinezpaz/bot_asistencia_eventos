#!/usr/bin/env node
const axios = require('axios');

// URL del servidor
const API_URL = 'http://localhost:3006';

// Función para probar endpoints de organizaciones sin autenticación
async function probarOrganizacionesTest() {
  console.log('********************************************************************************');
  console.log('*                                                                              *');
  console.log('*             PRUEBA DE ENDPOINTS DE ORGANIZACIONES SIN AUTENTICACIÓN         *');
  console.log('*                                                                              *');
  console.log('* Este script prueba los endpoints de organizaciones sin autenticación.        *');
  console.log('* Solo utiliza el endpoint especial /api/organizations/test                   *');
  console.log('*                                                                              *');
  console.log('********************************************************************************');
  console.log('\n');
  
  try {
    // CASO 1: Obtener lista de organizaciones sin autenticación
    console.log('📋 CASO 1: Obtener lista de organizaciones sin autenticación');
    try {
      const respuesta = await axios.get(`${API_URL}/api/organizations/test`);
      console.log(`✅ Se encontraron ${respuesta.data.length} organizaciones activas.`);
      
      if (respuesta.data.length > 0) {
        console.log('\nOrganizaciones:');
        respuesta.data.forEach(org => {
          console.log(`- ${org.name} (ID: ${org.id})`);
          console.log(`  Descripción: ${org.description || 'No disponible'}`);
          console.log(`  Contacto: ${org.contact_email || 'No disponible'}`);
          console.log(`  Participantes: ${org.participants_count || 0}`);
          console.log('---');
        });
      } else {
        console.log('No se encontraron organizaciones activas.');
      }
    } catch (error) {
      if (error.response?.status === 404 || error.message.includes('404')) {
        console.log('❌ Error 404: El endpoint /api/organizations/test no existe.');
        console.log('Por favor, asegúrate de que hayas agregado el endpoint al archivo organizations.js');
        console.log('y de que el servidor haya sido reiniciado después de agregar el endpoint.');
      } else {
        console.log('❌ Error al obtener organizaciones:', error.response?.data || error.message);
      }
    }
    
    console.log('\n✅ Pruebas completadas.');
  } catch (error) {
    console.error('Error general:', error.message);
  }
}

// Ejecutar pruebas
probarOrganizacionesTest().catch(error => {
  console.error('Error al ejecutar pruebas:', error.message);
}); 