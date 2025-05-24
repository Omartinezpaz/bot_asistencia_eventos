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

// Función para probar endpoints de participantes
async function probarParticipantes() {
  console.log('Probando endpoints de participantes...\n');
  
  try {
    // CASO 1: Validar participante (sin autenticación)
    console.log('📋 CASO 1: Validar participante');
    const datos = {
      nac: 'V',
      cedula: '12345678',
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'juanperez@gmail.com',
      phone: '0414-123-4567'
    };
    
    try {
      const respuesta = await axios.post(`${API_URL}/api/participants/validate-test`, datos);
      console.log('✅ Validación exitosa:', respuesta.data);
    } catch (error) {
      console.log('❌ Error en validación:', error.response?.data || error.message);
    }
    console.log('\n');
    
    // CASO 2: Validar participante con datos inválidos
    console.log('📋 CASO 2: Validar participante con datos inválidos');
    const datosInvalidos = {
      nac: 'X', // Nacionalidad inválida
      cedula: 'ABC123', // Cédula inválida
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'correo-invalido', // Email inválido
      phone: '123456' // Teléfono inválido
    };
    
    try {
      const respuesta = await axios.post(`${API_URL}/api/participants/validate-test`, datosInvalidos);
      console.log('✅ Validación exitosa (inesperado):', respuesta.data);
    } catch (error) {
      console.log('❌ Error en validación (esperado):', error.response?.data);
    }
    console.log('\n');
    
    // CASO 2.1: Verificar si un participante existe por cédula (sin autenticación)
    console.log('📋 CASO 2.1: Verificar si un participante existe por cédula');
    
    // Probar con algunas cédulas (algunas que probablemente existan y otras no)
    const cedulas = ['12345678', '87654321', '11111111', '99999999'];
    
    for (const cedula of cedulas) {
      console.log(`\nVerificando cédula: V${cedula}`);
      
      try {
        const respuesta = await axios.post(`${API_URL}/api/participants/check-participant-test`, {
          cedula,
          nac: 'V'
        });
        
        if (respuesta.data.exists) {
          console.log('✅ Participante encontrado:');
          console.log(`- Nombre: ${respuesta.data.participant.fullName}`);
          console.log(`- Documento: ${respuesta.data.participant.documento}`);
          console.log(`- Email: ${respuesta.data.participant.email || 'No especificado'}`);
          console.log(`- Faltan datos: ${respuesta.data.faltanDatos ? 'Sí' : 'No'}`);
        } else if (respuesta.data.registroElectoral) {
          console.log('ℹ️ No existe como participante pero se encontró en el registro electoral:');
          console.log(`- Nombre: ${respuesta.data.registroElectoral.nombre} ${respuesta.data.registroElectoral.apellido}`);
          console.log(`- Se puede crear: ${respuesta.data.requiereCrearParticipante ? 'Sí' : 'No'}`);
        } else {
          console.log('❌ No se encontró ningún participante con esa cédula');
        }
      } catch (error) {
        console.log('❌ Error al verificar participante:', error.response?.data || error.message);
      }
    }
    console.log('\n');
    
    // A partir de aquí, las operaciones requieren autenticación
    console.log('Obteniendo token de autenticación para operaciones protegidas...');
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
    
    // CASO 3: Obtener lista de participantes
    console.log('📋 CASO 3: Obtener lista de participantes');
    try {
      const respuesta = await axios.get(`${API_URL}/api/participants`, {
        headers,
        params: {
          page: 1,
          limit: 10
        }
      });
      
      console.log(`✅ Se encontraron ${respuesta.data.items.length} participantes.`);
      console.log(`Total de páginas: ${respuesta.data.pagination.totalPages}`);
      console.log(`Total de items: ${respuesta.data.pagination.totalItems}`);
      
      if (respuesta.data.items.length > 0) {
        console.log('\nPrimer participante:');
        const primerParticipante = respuesta.data.items[0];
        console.log(`ID: ${primerParticipante.id}`);
        console.log(`Nombre: ${primerParticipante.firstname} ${primerParticipante.lastname}`);
        console.log(`Documento: ${primerParticipante.nac}${primerParticipante.cedula}`);
        console.log(`Email: ${primerParticipante.email || 'No especificado'}`);
        console.log(`Teléfono: ${primerParticipante.phone || 'No especificado'}`);
        
        // Guardar ID para pruebas posteriores
        participanteId = primerParticipante.id;
      }
    } catch (error) {
      console.log('❌ Error al obtener participantes:', error.response?.data || error.message);
    }
    console.log('\n');
    
    // CASO 4: Crear un nuevo participante
    console.log('📋 CASO 4: Crear un nuevo participante');
    const nuevoParticipante = {
      nac: 'V',
      cedula: Math.floor(10000000 + Math.random() * 90000000).toString(), // Generar cédula aleatoria
      firstName: 'María',
      lastName: 'Rodríguez',
      email: 'maria.rodriguez@gmail.com',
      phone: '0424-567-8901',
      userRole: 'user'
    };
    
    let participanteCreado = null;
    
    try {
      const respuesta = await axios.post(`${API_URL}/api/participants`, nuevoParticipante, { headers });
      participanteCreado = respuesta.data;
      console.log('✅ Participante creado exitosamente:');
      console.log(`ID: ${participanteCreado.id}`);
      console.log(`Nombre: ${participanteCreado.firstName} ${participanteCreado.lastName}`);
      console.log(`Documento: ${participanteCreado.nac}${participanteCreado.cedula}`);
    } catch (error) {
      console.log('❌ Error al crear participante:', error.response?.data || error.message);
    }
    console.log('\n');
    
    // CASO 5: Obtener detalle de un participante
    if (participanteCreado) {
      console.log(`📋 CASO 5: Obtener detalle del participante ID: ${participanteCreado.id}`);
      
      try {
        const respuesta = await axios.get(`${API_URL}/api/participants/${participanteCreado.id}`, { headers });
        console.log('✅ Detalles del participante:');
        console.log(`Nombre: ${respuesta.data.firstname} ${respuesta.data.lastname}`);
        console.log(`Documento: ${respuesta.data.nac}${respuesta.data.cedula}`);
        console.log(`Email: ${respuesta.data.email || 'No especificado'}`);
        console.log(`Teléfono: ${respuesta.data.phone || 'No especificado'}`);
        console.log(`Organización: ${respuesta.data.organization_name || 'No especificada'}`);
      } catch (error) {
        console.log('❌ Error al obtener detalles del participante:', error.response?.data || error.message);
      }
      console.log('\n');
      
      // CASO 6: Actualizar un participante
      console.log(`📋 CASO 6: Actualizar el participante ID: ${participanteCreado.id}`);
      
      const datosActualizados = {
        ...nuevoParticipante,
        firstName: 'María Alejandra',
        lastName: 'Rodríguez González',
        email: 'maria.rodriguez.actualizado@gmail.com'
      };
      
      try {
        const respuesta = await axios.put(`${API_URL}/api/participants/${participanteCreado.id}`, datosActualizados, { headers });
        console.log('✅ Participante actualizado exitosamente:');
        console.log(`Nombre: ${respuesta.data.firstName} ${respuesta.data.lastName}`);
        console.log(`Email: ${respuesta.data.email}`);
      } catch (error) {
        console.log('❌ Error al actualizar participante:', error.response?.data || error.message);
      }
      console.log('\n');
      
      // CASO 7: Eliminar un participante
      console.log(`📋 CASO 7: Eliminar el participante ID: ${participanteCreado.id}`);
      
      try {
        const respuesta = await axios.delete(`${API_URL}/api/participants/${participanteCreado.id}`, { headers });
        console.log('✅ Participante eliminado exitosamente:', respuesta.data);
      } catch (error) {
        console.log('❌ Error al eliminar participante:', error.response?.data || error.message);
      }
      console.log('\n');
    }
    
    // CASO 8: Obtener participantes para dropdown
    console.log('📋 CASO 8: Obtener participantes para dropdown');
    
    try {
      const respuesta = await axios.get(`${API_URL}/api/participants/dropdown`, { headers });
      console.log(`✅ Se encontraron ${respuesta.data.length} participantes para el dropdown.`);
      
      if (respuesta.data.length > 0) {
        console.log('\nAlgunos participantes:');
        for (let i = 0; i < Math.min(3, respuesta.data.length); i++) {
          const participante = respuesta.data[i];
          console.log(`- ${participante.name} (${participante.document})`);
        }
      }
    } catch (error) {
      console.log('❌ Error al obtener participantes para dropdown:', error.response?.data || error.message);
    }
    
    // CASO 9: Probar importación de participantes desde CSV
    console.log('📋 CASO 9: Importar participantes desde CSV');
    
    try {
      // Crear archivo CSV temporal
      const tempDir = path.join(__dirname, '../../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const csvFilePath = path.join(tempDir, 'participantes_test.csv');
      const csvContent = 'documento,nombre,apellido,email,telefono\n' +
                       'V98765432,Pedro,Gómez,pedro.gomez@gmail.com,0416-987-6543\n' +
                       'V12378901,Ana,Martínez,ana.martinez@gmail.com,0424-123-7890\n' +
                       'V45678912,Luis,Pérez,luis.perez@gmail.com,0414-456-7891\n';
      
      fs.writeFileSync(csvFilePath, csvContent);
      console.log('✅ Archivo CSV temporal creado');
      
      // Crear formulario con el archivo
      const formData = new FormData();
      formData.append('file', fs.createReadStream(csvFilePath));
      
      console.log('Enviando solicitud de importación...');
      
      const respuesta = await axios.post(`${API_URL}/api/participants/import`, formData, { 
        headers: {
          ...headers,
          ...formData.getHeaders()
        }
      });
      
      console.log('✅ Respuesta de importación:');
      console.log(`Mensaje: ${respuesta.data.mensaje}`);
      console.log('Estadísticas:');
      console.log(`- Procesados: ${respuesta.data.estadisticas.procesados}`);
      console.log(`- Creados: ${respuesta.data.estadisticas.creados}`);
      console.log(`- Omitidos: ${respuesta.data.estadisticas.omitidos}`);
      console.log(`- Ya existentes: ${respuesta.data.estadisticas.yaExistentes}`);
      
      if (respuesta.data.errores && respuesta.data.errores.length > 0) {
        console.log('\nAlgunos errores:');
        respuesta.data.errores.slice(0, 3).forEach(error => {
          console.log(`- Documento: ${error.documento}, Error: ${error.error}, Línea: ${error.linea}`);
        });
      }
      
      // Eliminar archivo temporal
      fs.unlinkSync(csvFilePath);
      console.log('✅ Archivo CSV temporal eliminado');
    } catch (error) {
      console.log('❌ Error al importar participantes:', error.response?.data || error.message);
      
      // Asegurarnos de limpiar el archivo temporal
      try {
        const csvFilePath = path.join(__dirname, '../../../temp', 'participantes_test.csv');
        if (fs.existsSync(csvFilePath)) {
          fs.unlinkSync(csvFilePath);
        }
      } catch (cleanupError) {
        console.log('Error al limpiar archivo temporal:', cleanupError.message);
      }
    }
    
    console.log('\nPruebas completadas.');
  } catch (error) {
    console.error('Error general:', error.message);
  }
}

// Ejecutar pruebas
probarParticipantes().catch(error => {
  console.error('Error al ejecutar pruebas:', error.message);
});

// Justo antes de ejecutar la función principal al final del archivo
// Mostrar mensaje al inicio
console.log('********************************************************************************');
console.log('*                                                                              *');
console.log('*                  PRUEBA DE ENDPOINTS DE PARTICIPANTES                        *');
console.log('*                                                                              *');
console.log('* Este script prueba todos los endpoints relacionados con participantes.       *');
console.log('* Algunos endpoints requieren autenticación, por lo que se intentará obtener   *');
console.log('* un token. Si falla, algunas pruebas no se completarán.                       *');
console.log('*                                                                              *');
console.log('* Las pruebas verifican:                                                       *');
console.log('* - Validación de datos de participantes                                      *');
console.log('* - Creación, lectura, actualización y eliminación de participantes           *');
console.log('* - Verificación de existencia de participantes por cédula                    *');
console.log('* - Importación masiva de participantes por CSV                               *');
console.log('*                                                                              *');
console.log('********************************************************************************');
console.log('\n'); 