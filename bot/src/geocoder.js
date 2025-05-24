const NodeGeocoder = require('node-geocoder');
const { CentroVotacion, Geografia } = require('./database');
const { Op } = require('sequelize');

// Configurar múltiples geocoders
const proveedores = {
  // OpenStreetMap (sin API key)
  openstreetmap: NodeGeocoder({
    provider: 'openstreetmap',
    formatter: null
  }),
  
  // Google Maps (requiere API key)
  google: process.env.GOOGLE_MAPS_API_KEY ? NodeGeocoder({
    provider: 'google',
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
    formatter: null
  }) : null,
  
  // Mapbox (requiere API key)
  mapbox: process.env.MAPBOX_API_KEY ? NodeGeocoder({
    provider: 'mapbox',
    apiKey: process.env.MAPBOX_API_KEY,
    formatter: null
  }) : null
};

// Orden de proveedores a intentar (del más preferido al menos)
const ordenProveedores = ['google', 'mapbox', 'openstreetmap'];

/**
 * Obtiene las coordenadas de una dirección usando múltiples proveedores
 * @param {string} direccion - La dirección a geocodificar
 * @param {string} municipio - El municipio donde está la dirección
 * @param {string} estado - El estado donde está la dirección
 * @param {object} opciones - Opciones adicionales
 * @returns {Promise<{lat: number, lon: number, proveedor: string} | null>} - Las coordenadas o null si no se encontraron
 */
const geocodificarDireccion = async (direccion, municipio, estado, opciones = {}) => {
  // Opciones por defecto
  const config = {
    intentosMaximos: 3,
    delayEntreIntentos: 1000,
    proveedoresPreferidos: opciones.proveedoresPreferidos || ordenProveedores,
    ...opciones
  };
  
  // Construir una dirección completa con todos los datos disponibles
  const direccionCompleta = `${direccion}, ${municipio}, ${estado}, Venezuela`;
  console.log(`Geocodificando: ${direccionCompleta}`);
  
  // Intentar con cada proveedor en orden
  for (const nombreProveedor of config.proveedoresPreferidos) {
    const proveedor = proveedores[nombreProveedor];
    
    // Saltar si el proveedor no está configurado (ej. no tiene API key)
    if (!proveedor) continue;
    
    console.log(`Intentando con proveedor: ${nombreProveedor}`);
    
    // Realizar múltiples intentos con este proveedor
    for (let intento = 1; intento <= config.intentosMaximos; intento++) {
      try {
        // Esperar antes de reintentar (excepto el primer intento)
        if (intento > 1) {
          console.log(`Reintento ${intento} con ${nombreProveedor}...`);
          await new Promise(resolve => setTimeout(resolve, config.delayEntreIntentos * (intento - 1)));
        }
        
        // Realizar la geocodificación
        const resultados = await proveedor.geocode(direccionCompleta);
        
        if (resultados && resultados.length > 0) {
          const { latitude, longitude } = resultados[0];
          console.log(`Coordenadas obtenidas con ${nombreProveedor}: ${latitude}, ${longitude}`);
          return { lat: latitude, lon: longitude, proveedor: nombreProveedor };
        }
      } catch (error) {
        console.error(`Error con proveedor ${nombreProveedor} (intento ${intento}):`, error.message);
      }
    }
    
    console.log(`No se encontraron coordenadas con ${nombreProveedor}`);
  }
  
  // Si llegamos aquí, ningún proveedor tuvo éxito
  console.log('No se encontraron coordenadas con ningún proveedor');
  return null;
};

/**
 * Valida si las coordenadas parecen ser correctas
 * @param {number} lat - Latitud
 * @param {number} lon - Longitud
 * @param {string} estado - Nombre del estado (para validación regional)
 * @returns {boolean} - true si las coordenadas parecen válidas
 */
const validarCoordenadas = (lat, lon, estado) => {
  // Verificar que las coordenadas estén dentro de Venezuela
  const VENEZUELA_BOUNDS = {
    north: 13.3821, // Latitud máxima
    south: 0.6475,  // Latitud mínima
    west: -73.3529, // Longitud mínima
    east: -59.8038  // Longitud máxima
  };
  
  // Verificación básica de rango
  const enRango = (
    lat >= VENEZUELA_BOUNDS.south && 
    lat <= VENEZUELA_BOUNDS.north &&
    lon >= VENEZUELA_BOUNDS.west && 
    lon <= VENEZUELA_BOUNDS.east
  );
  
  if (!enRango) {
    console.log(`❌ Coordenadas fuera de los límites de Venezuela: ${lat}, ${lon}`);
    return false;
  }
  
  // TODO: Se podría añadir validación específica por estado
  // Ejemplo:
  // if (estado === 'Zulia') {
  //   // Verificar límites específicos del Zulia
  // }
  
  return true;
};

/**
 * Actualiza las coordenadas de un centro de votación
 * @param {number} codCentro - El código del centro de votación
 * @param {object} opciones - Opciones para la geocodificación
 * @returns {Promise<boolean>} - true si se actualizó correctamente, false en caso contrario
 */
const actualizarCoordenadasCentro = async (codCentro, opciones = {}) => {
  try {
    // Buscar el centro de votación
    const centro = await CentroVotacion.findByPk(codCentro);
    if (!centro) {
      console.error(`Centro de votación con código ${codCentro} no encontrado`);
      return false;
    }
    
    // Verificar si ya tiene coordenadas y no estamos forzando la actualización
    if (centro.latitud && centro.longitud && !opciones.forzarActualizacion) {
      console.log(`El centro ${codCentro} ya tiene coordenadas: ${centro.latitud}, ${centro.longitud}`);
      return true;
    }
    
    // Buscar información geográfica
    const geografia = await Geografia.findOne({
      where: {
        cod_estado: centro.cod_estado,
        cod_municipio: centro.cod_municipio,
        cod_parroquia: centro.cod_parroquia
      }
    });
    
    if (!geografia) {
      console.error(`No se encontró información geográfica para el centro ${codCentro}`);
      return false;
    }
    
    // Geocodificar la dirección
    const coordenadas = await geocodificarDireccion(
      centro.direccion,
      geografia.nom_municipio,
      geografia.nom_estado,
      opciones
    );
    
    if (!coordenadas) {
      return false;
    }
    
    // Validar coordenadas antes de guardar
    if (!validarCoordenadas(coordenadas.lat, coordenadas.lon, geografia.nom_estado)) {
      console.error(`Coordenadas inválidas para el centro ${codCentro}`);
      return false;
    }
    
    // Actualizar las coordenadas en la base de datos
    await centro.update({
      latitud: coordenadas.lat,
      longitud: coordenadas.lon,
      proveedor_geo: coordenadas.proveedor || 'desconocido'
    });
    
    console.log(`Coordenadas actualizadas para el centro ${codCentro}: ${coordenadas.lat}, ${coordenadas.lon} (${coordenadas.proveedor})`);
    return true;
  } catch (error) {
    console.error(`Error al actualizar coordenadas del centro ${codCentro}:`, error);
    return false;
  }
};

/**
 * Procesa centros de votación sin coordenadas
 * @param {number} limite - El número máximo de centros a procesar
 * @param {object} opciones - Opciones adicionales
 * @returns {Promise<{total: number, actualizados: number}>} - Estadísticas del proceso
 */
const procesarCentrosSinCoordenadas = async (limite = 10, opciones = {}) => {
  try {
    // Construir condición de búsqueda
    const condicion = opciones.forzarActualizacion 
      ? {}  // Procesar todos los centros si se fuerza actualización
      : {
        [Op.or]: [
          { latitud: null },
          { longitud: null }
        ]
      };
    
    // Buscar centros sin coordenadas
    const centrosSinCoordenadas = await CentroVotacion.findAll({
      where: condicion,
      limit: limite
    });
    
    console.log(`Se encontraron ${centrosSinCoordenadas.length} centros ${opciones.forzarActualizacion ? 'para procesar' : 'sin coordenadas'}`);
    
    // Estadísticas
    const estadisticas = {
      total: centrosSinCoordenadas.length,
      actualizados: 0
    };
    
    // Procesar cada centro
    for (const centro of centrosSinCoordenadas) {
      const resultado = await actualizarCoordenadasCentro(centro.id, opciones);
      if (resultado) {
        estadisticas.actualizados++;
      }
      
      // Esperar un poco para no sobrecargar el servicio de geocodificación
      await new Promise(resolve => setTimeout(resolve, opciones.delayEntreCentros || 1000));
    }
    
    console.log(`Proceso completado. Centros actualizados: ${estadisticas.actualizados} de ${estadisticas.total}`);
    return estadisticas;
  } catch (error) {
    console.error('Error al procesar centros sin coordenadas:', error);
    return { total: 0, actualizados: 0 };
  }
};

/**
 * Corrige coordenadas erróneas para un centro específico
 * @param {number} codCentro - Código del centro a corregir
 * @param {number} latitud - Nueva latitud (opcional, si se proporciona manualmente)
 * @param {number} longitud - Nueva longitud (opcional, si se proporciona manualmente)
 * @returns {Promise<boolean>} - true si se corrigió correctamente
 */
const corregirCoordenadasCentro = async (codCentro, latitud, longitud) => {
  try {
    // Buscar el centro de votación
    const centro = await CentroVotacion.findByPk(codCentro);
    if (!centro) {
      console.error(`Centro de votación con código ${codCentro} no encontrado`);
      return false;
    }
    
    // Si se proporcionan coordenadas manualmente, actualizar directamente
    if (latitud !== undefined && longitud !== undefined) {
      console.log(`Actualizando coordenadas manualmente para centro ${codCentro}: ${latitud}, ${longitud}`);
      
      // Validar las coordenadas proporcionadas
      const geografia = await Geografia.findOne({
        where: {
          cod_estado: centro.cod_estado,
          cod_municipio: centro.cod_municipio,
          cod_parroquia: centro.cod_parroquia
        }
      });
      
      if (!geografia) {
        console.error(`No se encontró información geográfica para el centro ${codCentro}`);
        return false;
      }
      
      if (!validarCoordenadas(latitud, longitud, geografia.nom_estado)) {
        console.error(`Las coordenadas proporcionadas (${latitud}, ${longitud}) parecen estar fuera de rango`);
        return false;
      }
      
      // Actualizar las coordenadas
      await centro.update({
        latitud,
        longitud,
        proveedor_geo: 'manual'
      });
      
      console.log(`Coordenadas actualizadas manualmente para el centro ${codCentro}`);
      return true;
    }
    
    // Si no se proporcionan coordenadas, forzar una nueva geocodificación
    return await actualizarCoordenadasCentro(codCentro, { 
      forzarActualizacion: true, 
      intentosMaximos: 5,
      delayEntreIntentos: 2000,
      // Intentar con todos los proveedores disponibles
      proveedoresPreferidos: ordenProveedores
    });
  } catch (error) {
    console.error(`Error al corregir coordenadas del centro ${codCentro}:`, error);
    return false;
  }
};

// Funciones para usar con el API REST
const procesarCentrosPorAPI = async (req, res) => {
  try {
    const { limite = 10, forzar = false } = req.query;
    const estadisticas = await procesarCentrosSinCoordenadas(parseInt(limite), {
      forzarActualizacion: forzar === 'true'
    });
    res.json({ success: true, data: estadisticas });
  } catch (error) {
    console.error('Error en API de geocodificación:', error);
    res.status(500).json({ success: false, error: 'Error al procesar centros' });
  }
};

module.exports = {
  geocodificarDireccion,
  actualizarCoordenadasCentro,
  procesarCentrosSinCoordenadas,
  procesarCentrosPorAPI,
  corregirCoordenadasCentro,
  validarCoordenadas
}; 