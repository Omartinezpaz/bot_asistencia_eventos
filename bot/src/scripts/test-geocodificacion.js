#!/usr/bin/env node
/**
 * Script para probar la geocodificación de un centro específico
 * Uso: node test-geocodificacion.js <código_centro>
 */

// Cargar variables de entorno
require('dotenv').config();

// Importar módulos necesarios
const { setupDatabase, CentroVotacion, Geografia } = require('../database');
const { geocodificarDireccion } = require('../geocoder');

// Obtener el código del centro desde los argumentos
const args = process.argv.slice(2);
const codigoCentro = args[0];

if (!codigoCentro) {
  console.error('Error: Debe proporcionar el código del centro a geocodificar.');
  console.error('Uso: node test-geocodificacion.js <código_centro>');
  process.exit(1);
}

// Función principal
async function main() {
  try {
    console.log(`Iniciando prueba de geocodificación para el centro ${codigoCentro}...`);
    
    // Configurar la base de datos
    await setupDatabase();
    
    // Buscar el centro de votación
    const centro = await CentroVotacion.findOne({
      where: { cod_centro: codigoCentro }
    });
    
    if (!centro) {
      console.error(`Error: No se encontró el centro con código ${codigoCentro}`);
      process.exit(1);
    }
    
    console.log(`Centro encontrado: ${centro.nom_centro}`);
    console.log(`Dirección: ${centro.direccion}`);
    
    // Buscar información geográfica
    const geografia = await Geografia.findOne({
      where: {
        cod_estado: centro.cod_estado,
        cod_municipio: centro.cod_municipio,
        cod_parroquia: centro.cod_parroquia
      }
    });
    
    if (!geografia) {
      console.error(`Error: No se encontró información geográfica para el centro ${codigoCentro}`);
      process.exit(1);
    }
    
    console.log(`Estado: ${geografia.nom_estado}`);
    console.log(`Municipio: ${geografia.nom_municipio}`);
    console.log(`Parroquia: ${geografia.nom_parroquia}`);
    
    // Geocodificar la dirección
    console.log('\nGeocodificando dirección...');
    const coordenadas = await geocodificarDireccion(
      centro.direccion,
      geografia.nom_municipio,
      geografia.nom_estado
    );
    
    if (coordenadas) {
      console.log('\n✅ Geocodificación exitosa:');
      console.log(`Latitud: ${coordenadas.lat}`);
      console.log(`Longitud: ${coordenadas.lon}`);
      console.log(`URL de Google Maps: https://www.google.com/maps?q=${coordenadas.lat},${coordenadas.lon}`);
      
      // Actualizar el centro con las coordenadas
      console.log('\nActualizando centro en la base de datos...');
      await centro.update({
        latitud: coordenadas.lat,
        longitud: coordenadas.lon
      });
      
      console.log('✅ Centro actualizado correctamente');
    } else {
      console.log('\n❌ No se pudieron obtener coordenadas para este centro');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error en la prueba de geocodificación:', error);
    process.exit(1);
  }
}

// Ejecutar la función principal
main(); 