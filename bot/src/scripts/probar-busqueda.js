const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3006';
const SEARCH_TERM = '15099414'; // Término numérico que causaba el error

// Función para probar la búsqueda con autenticación básica
async function runTest() {
  console.log('=== PRUEBA DE BÚSQUEDA DE PARTICIPANTES ===');
  
  try {
    // Creando autenticación básica
    const username = 'admin';
    const password = 'admin123';
    const auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
    
    console.log(`Probando búsqueda con término: "${SEARCH_TERM}"`);
    
    const response = await axios.get(`${BASE_URL}/api/participants?page=1&limit=10&search=${SEARCH_TERM}`, {
      headers: {
        'Authorization': auth
      }
    });
    
    console.log(`✅ Éxito - Status: ${response.status}`);
    console.log(`Total de resultados: ${response.data.total}`);
    
    if (response.data.participants && response.data.participants.length > 0) {
      console.log('\nParticipantes encontrados:');
      response.data.participants.forEach((participant, index) => {
        console.log(`\n--- Participante ${index + 1} ---`);
        console.log(`ID: ${participant.id}`);
        console.log(`Cédula: ${participant.nac}${participant.cedula}`);
        console.log(`Nombre: ${participant.firstName} ${participant.lastName}`);
        console.log(`Telegram: ${participant.telegramId || 'No disponible'}`);
      });
    } else {
      console.log('\nNo se encontraron participantes con ese criterio de búsqueda.');
    }
    
    console.log('\n=== RESUMEN ===');
    console.log('Resultado: ✅ Exitoso');
    
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Detalles:', error.response.data);
    } else if (error.request) {
      console.error('No se recibió respuesta del servidor. ¿Está la aplicación en ejecución?');
    } else {
      console.error('Error al preparar la solicitud:', error.message);
    }
    
    console.log('\n=== RESUMEN ===');
    console.log('Resultado: ❌ Fallido');
  }
}

// Ejecutar prueba
runTest()
  .then(() => console.log('Prueba completada'))
  .catch(err => console.error('Error en la prueba:', err)); 