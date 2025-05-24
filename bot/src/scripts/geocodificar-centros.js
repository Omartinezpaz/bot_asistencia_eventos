#!/usr/bin/env node
/**
 * Script para geocodificar centros de votación sin coordenadas
 * Uso: node geocodificar-centros.js [límite]
 */

// Cargar variables de entorno
require('dotenv').config();

// Importar módulos necesarios
const { setupDatabase } = require('../database');
const { procesarCentrosSinCoordenadas } = require('../geocoder');

// Procesar argumentos de línea de comandos
const args = process.argv.slice(2);
const limite = args[0] ? parseInt(args[0]) : 10;

// Función principal
async function main() {
  try {
    console.log('Iniciando proceso de geocodificación automática...');
    
    // Configurar la base de datos
    await setupDatabase();
    
    console.log(`Procesando hasta ${limite} centros sin coordenadas...`);
    
    // Procesar centros sin coordenadas
    const estadisticas = await procesarCentrosSinCoordenadas(limite);
    
    console.log('Proceso completado:');
    console.log(`- Total de centros procesados: ${estadisticas.total}`);
    console.log(`- Centros actualizados correctamente: ${estadisticas.actualizados}`);
    console.log(`- Centros sin actualizar: ${estadisticas.total - estadisticas.actualizados}`);
    
    // Salir con código exitoso
    process.exit(0);
  } catch (error) {
    console.error('Error en el proceso de geocodificación:', error);
    
    // Salir con código de error
    process.exit(1);
  }
}

// Ejecutar la función principal
main(); 