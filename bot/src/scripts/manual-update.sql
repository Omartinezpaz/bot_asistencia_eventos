-- Script para añadir campos relacionados con geocodificación a la tabla de centros de votación
-- Este script puede ejecutarse directamente desde pgAdmin o cualquier cliente SQL
-- Autor: Claude AI
-- Fecha: 2023

-- Añadir campo latitud si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'notif_eventos_bot' AND table_name = 'centrosv_724' AND column_name = 'latitud'
    ) THEN
        ALTER TABLE notif_eventos_bot.centrosv_724 ADD COLUMN latitud FLOAT;
        RAISE NOTICE 'Campo latitud añadido';
    ELSE
        RAISE NOTICE 'Campo latitud ya existe';
    END IF;
END $$;

-- Añadir campo longitud si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'notif_eventos_bot' AND table_name = 'centrosv_724' AND column_name = 'longitud'
    ) THEN
        ALTER TABLE notif_eventos_bot.centrosv_724 ADD COLUMN longitud FLOAT;
        RAISE NOTICE 'Campo longitud añadido';
    ELSE
        RAISE NOTICE 'Campo longitud ya existe';
    END IF;
END $$;

-- Añadir campo proveedor_geo si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'notif_eventos_bot' AND table_name = 'centrosv_724' AND column_name = 'proveedor_geo'
    ) THEN
        ALTER TABLE notif_eventos_bot.centrosv_724 ADD COLUMN proveedor_geo VARCHAR(50);
        RAISE NOTICE 'Campo proveedor_geo añadido';
    ELSE
        RAISE NOTICE 'Campo proveedor_geo ya existe';
    END IF;
END $$;

-- Añadir campo ultima_actualizacion_geo si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'notif_eventos_bot' AND table_name = 'centrosv_724' AND column_name = 'ultima_actualizacion_geo'
    ) THEN
        ALTER TABLE notif_eventos_bot.centrosv_724 ADD COLUMN ultima_actualizacion_geo TIMESTAMP;
        RAISE NOTICE 'Campo ultima_actualizacion_geo añadido';
    ELSE
        RAISE NOTICE 'Campo ultima_actualizacion_geo ya existe';
    END IF;
END $$;

-- Verificar coordenadas nulas o inválidas
DO $$
BEGIN
    UPDATE notif_eventos_bot.centrosv_724
    SET latitud = NULL, longitud = NULL, proveedor_geo = NULL, ultima_actualizacion_geo = NULL
    WHERE latitud = 0 AND longitud = 0;
    RAISE NOTICE 'Coordenadas inválidas (0,0) corregidas';
END $$;

-- Configurar ultima_actualizacion_geo para los registros que ya tienen coordenadas
DO $$
BEGIN
    UPDATE notif_eventos_bot.centrosv_724
    SET ultima_actualizacion_geo = CURRENT_TIMESTAMP,
        proveedor_geo = 'desconocido'
    WHERE latitud IS NOT NULL AND longitud IS NOT NULL AND ultima_actualizacion_geo IS NULL;
    RAISE NOTICE 'Registros con coordenadas actualizados';
END $$;

-- Crear un índice para mejorar la búsqueda de centros sin coordenadas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'notif_eventos_bot' AND indexname = 'idx_centrosv_sin_coordenadas'
    ) THEN
        CREATE INDEX idx_centrosv_sin_coordenadas
        ON notif_eventos_bot.centrosv_724 ((latitud IS NULL OR longitud IS NULL));
        RAISE NOTICE 'Índice idx_centrosv_sin_coordenadas creado';
    ELSE
        RAISE NOTICE 'Índice idx_centrosv_sin_coordenadas ya existe';
    END IF;
END $$;

-- Crear un índice para búsquedas geográficas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'notif_eventos_bot' AND indexname = 'idx_centrosv_geografia'
    ) THEN
        CREATE INDEX idx_centrosv_geografia
        ON notif_eventos_bot.centrosv_724 (cod_estado, cod_municipio, cod_parroquia);
        RAISE NOTICE 'Índice idx_centrosv_geografia creado';
    ELSE
        RAISE NOTICE 'Índice idx_centrosv_geografia ya existe';
    END IF;
END $$;

-- Información sobre el resultado
SELECT 
    COUNT(*) AS total_centros,
    SUM(CASE WHEN latitud IS NULL OR longitud IS NULL THEN 1 ELSE 0 END) AS centros_sin_coordenadas,
    SUM(CASE WHEN latitud IS NOT NULL AND longitud IS NOT NULL THEN 1 ELSE 0 END) AS centros_con_coordenadas,
    COUNT(DISTINCT proveedor_geo) AS proveedores_usados
FROM notif_eventos_bot.centrosv_724; 