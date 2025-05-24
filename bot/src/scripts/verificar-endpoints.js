#!/usr/bin/env node
const axios = require('axios');
const Table = require('cli-table3');

// URL del servidor
const API_URL = 'http://localhost:3006';

// Lista de endpoints a verificar
const endpointsAVerificar = [
  { ruta: '/api/events/test', metodo: 'GET', descripcion: 'Obtener eventos (sin autenticación)' },
  { ruta: '/api/organizations/test', metodo: 'GET', descripcion: 'Obtener organizaciones (sin autenticación)' },
  { ruta: '/api/attendances/validate-participant-test', metodo: 'POST', descripcion: 'Validar participante (sin autenticación)', payload: { cedula: '12345678', eventId: 1, nac: 'V' } },
  { ruta: '/api/participants/validate-test', metodo: 'POST', descripcion: 'Validar datos de participante (sin autenticación)', payload: { cedula: '12345678', nac: 'V', firstName: 'Test', lastName: 'User', email: 'test@example.com', phone: '0414-123-4567' } },
  { ruta: '/api/participants/check-participant-test', metodo: 'POST', descripcion: 'Verificar participante por cédula (sin autenticación)', payload: { cedula: '12345678', nac: 'V' } }
];

// Función para verificar un endpoint
async function verificarEndpoint(endpoint) {
  try {
    let respuesta;
    const url = `${API_URL}${endpoint.ruta}`;
    
    if (endpoint.metodo === 'GET') {
      respuesta = await axios.get(url, { timeout: 5000 });
    } else if (endpoint.metodo === 'POST') {
      respuesta = await axios.post(url, endpoint.payload || {}, { timeout: 5000 });
    }
    
    return {
      ruta: endpoint.ruta,
      estado: 'OK',
      codigo: respuesta.status,
      tiempo: respuesta.headers['x-response-time'] || 'N/A',
      respuesta: respuesta.data ? '✓' : 'Vacía',
      error: null
    };
  } catch (error) {
    return {
      ruta: endpoint.ruta,
      estado: 'ERROR',
      codigo: error.response?.status || 'N/A',
      tiempo: 'N/A',
      respuesta: 'N/A',
      error: error.response?.data?.error || error.message
    };
  }
}

// Función para colorear texto en consola
function colorear(texto, estado) {
  const colores = {
    OK: '\x1b[32m', // Verde
    ERROR: '\x1b[31m', // Rojo
    reset: '\x1b[0m'  // Reset
  };
  
  return `${colores[estado] || ''}${texto}${colores.reset}`;
}

// Función principal
async function main() {
  console.log('********************************************************************************');
  console.log('*                                                                              *');
  console.log('*                VERIFICACIÓN DE ENDPOINTS DEL SISTEMA                         *');
  console.log('*                                                                              *');
  console.log('* Este script verifica el estado de todos los endpoints sin autenticación      *');
  console.log('* que son relevantes para el funcionamiento del panel administrativo.          *');
  console.log('*                                                                              *');
  console.log('********************************************************************************');
  console.log('\n');
  
  try {
    // Verificar si el servidor está en ejecución
    try {
      await axios.get(`${API_URL}/api`, { timeout: 2000 });
      console.log('✅ Servidor en ejecución');
    } catch (error) {
      console.log('❌ El servidor no parece estar en ejecución. Verifique que el servidor esté iniciado.');
      process.exit(1);
    }
    
    console.log('Verificando endpoints...\n');
    
    // Verificar cada endpoint y recopilar resultados
    const resultados = [];
    for (const endpoint of endpointsAVerificar) {
      console.log(`Verificando ${endpoint.metodo} ${endpoint.ruta}...`);
      const resultado = await verificarEndpoint(endpoint);
      resultados.push({
        endpoint,
        resultado
      });
    }
    
    // Crear tabla con resultados
    const tabla = new Table({
      head: ['Método', 'Ruta', 'Descripción', 'Estado', 'Código', 'Error'],
      style: {
        head: ['cyan'],
        border: []
      }
    });
    
    resultados.forEach(({ endpoint, resultado }) => {
      tabla.push([
        endpoint.metodo,
        endpoint.ruta,
        endpoint.descripcion,
        resultado.estado === 'OK' ? colorear('OK', 'OK') : colorear('ERROR', 'ERROR'),
        resultado.codigo,
        resultado.error ? (resultado.error.length > 50 ? resultado.error.substring(0, 47) + '...' : resultado.error) : ''
      ]);
    });
    
    console.log(tabla.toString());
    
    // Mostrar resumen
    const totalEndpoints = resultados.length;
    const endpointsOK = resultados.filter(r => r.resultado.estado === 'OK').length;
    const endpointsError = totalEndpoints - endpointsOK;
    
    console.log(`\nResumen: ${endpointsOK}/${totalEndpoints} endpoints funcionando correctamente`);
    
    if (endpointsError > 0) {
      console.log(`\n⚠️ ${endpointsError} endpoints tienen problemas. Recomendaciones:`);
      console.log('1. Ejecute el script restaurar-endpoints-test.js para intentar restaurar los endpoints');
      console.log('2. Reinicie el servidor después de restaurar los endpoints');
      console.log('3. Verifique que los archivos routes.js y los archivos de API correspondientes tengan los endpoints definidos');
    } else {
      console.log('\n✅ Todos los endpoints están funcionando correctamente.');
    }
  } catch (error) {
    console.error('Error general:', error.message);
  }
}

// Ejecutar script
main().catch(error => {
  console.error('Error en la ejecución del script:', error.message);
}); 