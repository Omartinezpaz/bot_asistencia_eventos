#!/usr/bin/env node
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

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

// Función para probar importación de organizaciones
async function probarImportacionOrganizaciones() {
  console.log('********************************************************************************');
  console.log('*                                                                              *');
  console.log('*                  PRUEBA DE IMPORTACIÓN DE ORGANIZACIONES                     *');
  console.log('*                                                                              *');
  console.log('* Este script prueba la importación de organizaciones desde un archivo CSV.    *');
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
    
    // Crear archivo CSV temporal
    console.log('Creando archivo CSV de prueba...');
    const tempDir = path.join(__dirname, '../../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const csvFilePath = path.join(tempDir, 'organizaciones_test.csv');
    const csvContent = 'nombre,descripcion,email,telefono,activo\n' +
                     'Org de Prueba 1,Descripción de la organización 1,contacto1@org-prueba.com,0414-123-4567,true\n' +
                     'Org de Prueba 2,Descripción de la organización 2,contacto2@org-prueba.com,0424-765-4321,true\n' +
                     'Org de Prueba 3,Descripción de la organización 3,contacto3@org-prueba.com,0412-345-6789,false\n';
    
    fs.writeFileSync(csvFilePath, csvContent);
    console.log('✅ Archivo CSV temporal creado\n');
    
    // Crear formulario con el archivo
    const formData = new FormData();
    formData.append('file', fs.createReadStream(csvFilePath));
    
    console.log('Enviando solicitud de importación...');
    
    try {
      const respuesta = await axios.post(`${API_URL}/api/organizations/import`, formData, { 
        headers: {
          ...headers,
          ...formData.getHeaders()
        }
      });
      
      console.log('✅ Respuesta de importación:');
      console.log(`Mensaje: ${respuesta.data.mensaje}`);
      
      console.log('\nEstadísticas:');
      console.log(`- Procesados: ${respuesta.data.estadisticas.procesados}`);
      console.log(`- Creados: ${respuesta.data.estadisticas.creados}`);
      console.log(`- Omitidos: ${respuesta.data.estadisticas.omitidos}`);
      console.log(`- Ya existentes: ${respuesta.data.estadisticas.yaExistentes}`);
      
      console.log('\nResultados:');
      if (respuesta.data.resultados && respuesta.data.resultados.length > 0) {
        respuesta.data.resultados.forEach(resultado => {
          console.log(`- ${resultado.nombre}: ${resultado.mensaje} (ID: ${resultado.organizacionId})`);
        });
      } else {
        console.log('No hay resultados para mostrar');
      }
      
      console.log('\nErrores:');
      if (respuesta.data.errores && respuesta.data.errores.length > 0) {
        respuesta.data.errores.forEach(error => {
          console.log(`- ${error.nombre}: ${error.error}, Línea: ${error.linea}`);
        });
      } else {
        console.log('No se produjeron errores');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('❌ Error 404: El endpoint /api/organizations/import no existe.');
        console.log('Por favor, asegúrate de que hayas agregado el endpoint al archivo organizations.js');
        console.log('y de que el servidor haya sido reiniciado después de agregar el endpoint.');
      } else {
        console.log('❌ Error al importar organizaciones:', error.response?.data || error.message);
      }
    }
    
    // Eliminar archivo temporal
    try {
      fs.unlinkSync(csvFilePath);
      console.log('\n✅ Archivo CSV temporal eliminado');
    } catch (cleanupError) {
      console.log('\n❌ Error al limpiar archivo temporal:', cleanupError.message);
    }
    
    console.log('\n✅ Prueba completada.');
  } catch (error) {
    console.error('Error general:', error.message);
  }
}

// Ejecutar prueba
probarImportacionOrganizaciones().catch(error => {
  console.error('Error al ejecutar prueba:', error.message);
}); 