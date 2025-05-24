#!/usr/bin/env node
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// URL del servidor y credenciales de autenticación
const API_URL = 'http://localhost:3006';
const AUTH = {
  username: 'admin',
  password: 'admin123'
};

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
    throw new Error('No se pudo obtener el token de autenticación');
  }
}

// Función para probar endpoints de asistencias
async function probarAsistencias() {
  console.log('Probando endpoints de asistencias...\n');
  
  let token;
  try {
    token = await obtenerToken();
    console.log('✅ Token de autenticación obtenido correctamente\n');
  } catch (error) {
    console.log('❌ Error al autenticar, usando autenticación básica\n');
    // Continuamos con autenticación básica si no se puede obtener token
  }
  
  const headers = token 
    ? { Authorization: `Bearer ${token}` }
    : { Authorization: `Basic ${Buffer.from(`${AUTH.username}:${AUTH.password}`).toString('base64')}` };
  
  // Variables para almacenar IDs que usaremos en pruebas posteriores
  let eventoId = null;
  let cedulaParticipante = null;
  
  // CASO 1: Obtener lista de asistencias
  try {
    console.log('📋 CASO 1: Obtener lista de asistencias');
    const respuesta = await axios.get(`${API_URL}/api/attendances`, { 
      headers,
      params: {
        page: 1,
        limit: 10
      }
    });
    console.log(`✅ Se encontraron ${respuesta.data.items.length} asistencias.`);
    console.log(`Total de páginas: ${respuesta.data.pagination.totalPages}`);
    console.log(`Total de items: ${respuesta.data.pagination.totalItems}`);
    
    if (respuesta.data.items.length > 0) {
      console.log('\nPrimera asistencia:');
      const primeraAsistencia = respuesta.data.items[0];
      console.log(`ID: ${primeraAsistencia.id}`);
      console.log(`Participante: ${primeraAsistencia.participant.name} (${primeraAsistencia.participant.document})`);
      console.log(`Evento: ${primeraAsistencia.event.name} (${primeraAsistencia.event.date})`);
      console.log(`Estado: ${primeraAsistencia.status}`);
      console.log(`Registro: ${primeraAsistencia.registrationDate}`);
      
      // Guardar información para pruebas posteriores
      eventoId = primeraAsistencia.event.id;
      cedulaParticipante = primeraAsistencia.participant.document;
      // Eliminar la nacionalidad de la cédula
      if (cedulaParticipante && (cedulaParticipante.startsWith('V') || cedulaParticipante.startsWith('E'))) {
        cedulaParticipante = cedulaParticipante.substring(1);
      }
    }
  } catch (error) {
    console.log('❌ Error al obtener asistencias:', error.response?.data || error.message);
  }
  console.log('\n');
  
  // CASO 2: Obtener resumen de asistencias por evento
  try {
    console.log('📋 CASO 2: Obtener resumen de asistencias por evento');
    const respuesta = await axios.get(`${API_URL}/api/attendances/summary`, { headers });
    console.log(`✅ Se encontraron resumenes para ${respuesta.data.length} eventos.`);
    
    if (respuesta.data.length > 0) {
      console.log('\nResumen del primer evento:');
      const primerResumen = respuesta.data[0];
      console.log(`Evento: ${primerResumen.event_name} (${primerResumen.event_date})`);
      console.log(`Total de asistencias: ${primerResumen.total_attendances}`);
      console.log(`Asistencias confirmadas: ${primerResumen.confirmed_attendances}`);
      console.log(`Asistencias pendientes: ${primerResumen.pending_attendances}`);
      console.log(`Tasa de asistencia: ${primerResumen.attendance_rate}%`);
      
      // Si aún no tenemos un eventoId, guardamos este
      if (!eventoId && primerResumen.event_id) {
        eventoId = primerResumen.event_id;
      }
    }
  } catch (error) {
    console.log('❌ Error al obtener resumen de asistencias:', error.response?.data || error.message);
  }
  console.log('\n');
  
  // Si no tenemos un eventoId, buscamos uno disponible
  if (!eventoId) {
    try {
      const respuestaEventos = await axios.get(`${API_URL}/api/events`, { headers });
      if (respuestaEventos.data.length > 0) {
        eventoId = respuestaEventos.data[0].id;
        console.log(`ℹ️ Se usará el evento ID: ${eventoId} para las siguientes pruebas`);
      } else {
        console.log('❌ No hay eventos disponibles para continuar con las pruebas');
        console.log('Finalizando pruebas.');
        return;
      }
    } catch (error) {
      console.log('❌ Error al obtener eventos:', error.response?.data || error.message);
      console.log('Finalizando pruebas.');
      return;
    }
  }
  
  // CASO 3: Probar la validación de participante para asistencia
  if (cedulaParticipante && eventoId) {
    try {
      console.log('📋 CASO 3: Validar participante para asistencia');
      console.log(`Validando cédula: ${cedulaParticipante} para el evento ID: ${eventoId}`);
      
      const respuesta = await axios.post(`${API_URL}/api/attendances/validate-participant`, {
        cedula: cedulaParticipante,
        eventId: eventoId,
        nac: 'V'
      }, { headers });
      
      console.log('✅ Respuesta de validación:');
      
      if (respuesta.data.participante) {
        console.log(`Participante encontrado: ${respuesta.data.participante.nombreCompleto}`);
        console.log(`Documento: ${respuesta.data.participante.documento}`);
        console.log(`Organización: ${respuesta.data.participante.organizacion || 'No especificada'}`);
        console.log(`Faltan datos: ${respuesta.data.participante.faltanDatos ? 'Sí' : 'No'}`);
      } else {
        console.log('Participante no encontrado en la base de datos');
      }
      
      if (respuesta.data.registroElectoral) {
        console.log(`Encontrado en registro electoral: ${respuesta.data.registroElectoral.nombreCompleto}`);
        if (respuesta.data.registroElectoral.centroVotacion) {
          console.log(`Centro de votación: ${respuesta.data.registroElectoral.centroVotacion.nombre}`);
        }
      }
      
      console.log(`Evento: ${respuesta.data.evento.nombre} (${respuesta.data.evento.fecha})`);
      
      if (respuesta.data.asistencia) {
        console.log(`Ya existe asistencia con ID: ${respuesta.data.asistencia.id}`);
        console.log(`Estado: ${respuesta.data.asistencia.estado}`);
        console.log(`Fecha de registro: ${respuesta.data.asistencia.fechaRegistro}`);
      } else {
        console.log('No existe asistencia previa para este participante en este evento');
      }
      
      console.log(`Puede registrar: ${respuesta.data.puedeRegistrar ? 'Sí' : 'No'}`);
      console.log(`Requiere crear participante: ${respuesta.data.requiereCrearParticipante ? 'Sí' : 'No'}`);
      console.log(`No encontrado: ${respuesta.data.noEncontrado ? 'Sí' : 'No'}`);
    } catch (error) {
      console.log('❌ Error al validar participante:', error.response?.data || error.message);
    }
    console.log('\n');
  }
  
  // CASO 4: Crear CSV temporal para probar importación
  if (eventoId) {
    try {
      console.log('📋 CASO 4: Probar importación de asistencias desde CSV');
      
      // Crear archivo CSV temporal
      const tempDir = path.join(__dirname, '../../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const csvFilePath = path.join(tempDir, 'asistencias_test.csv');
      const csvContent = 'documento,nombre,apellido,estatus,notas\n' +
                          'V12345678,Juan,Pérez,confirmed,Asistencia de prueba 1\n' +
                          'V87654321,María,González,confirmed,Asistencia de prueba 2\n' +
                          'V11111111,Pedro,Rodríguez,pending,Asistencia pendiente\n';
      
      fs.writeFileSync(csvFilePath, csvContent);
      console.log('✅ Archivo CSV temporal creado');
      
      // Crear formulario con el archivo
      const formData = new FormData();
      formData.append('file', fs.createReadStream(csvFilePath));
      formData.append('eventId', eventoId);
      
      console.log('Enviando solicitud de importación...');
      
      const respuesta = await axios.post(`${API_URL}/api/attendances/import`, formData, { 
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
      console.log('❌ Error al importar asistencias:', error.response?.data || error.message);
      
      // Asegurarnos de limpiar el archivo temporal
      try {
        const csvFilePath = path.join(__dirname, '../../../temp', 'asistencias_test.csv');
        if (fs.existsSync(csvFilePath)) {
          fs.unlinkSync(csvFilePath);
        }
      } catch (cleanupError) {
        console.log('Error al limpiar archivo temporal:', cleanupError.message);
      }
    }
    console.log('\n');
  }
  
  // CASO 5: Obtener una asistencia específica (si tenemos una disponible)
  let asistenciaId = null;
  try {
    // Buscar primero una asistencia disponible
    const respuesta = await axios.get(`${API_URL}/api/attendances`, { 
      headers,
      params: {
        page: 1,
        limit: 1,
        eventId: eventoId
      }
    });
    
    if (respuesta.data.items.length > 0) {
      asistenciaId = respuesta.data.items[0].id;
      console.log(`📋 CASO 5: Obtener detalle de la asistencia ID: ${asistenciaId}`);
      
      const detalleRespuesta = await axios.get(`${API_URL}/api/attendances/${asistenciaId}`, { headers });
      console.log('✅ Detalles de la asistencia:');
      console.log(`Participante: ${detalleRespuesta.data.participant.firstName} ${detalleRespuesta.data.participant.lastName}`);
      console.log(`Documento: ${detalleRespuesta.data.participant.document}`);
      console.log(`Evento: ${detalleRespuesta.data.event.name}`);
      console.log(`Fecha de evento: ${detalleRespuesta.data.event.date}`);
      console.log(`Estado: ${detalleRespuesta.data.status}`);
      console.log(`Método: ${detalleRespuesta.data.method}`);
      console.log(`Notas: ${detalleRespuesta.data.notes || 'Sin notas'}`);
    } else {
      console.log('📋 CASO 5: No hay asistencias disponibles para obtener detalles');
    }
  } catch (error) {
    console.log('❌ Error al obtener detalle de asistencia:', error.response?.data || error.message);
  }
  console.log('\n');
    
  console.log('Pruebas completadas.');
}

// Ejecutar pruebas
probarAsistencias().catch(error => {
  console.error('Error general al ejecutar las pruebas:', error.message);
}); 