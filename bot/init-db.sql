-- Script para inicializar la base de datos de asistencia a eventos
 
-- Conectar a la base de datos
 psql -h localhost -p 5432 -U omarte -d notificaciones -f update-centrosv_723-notif_eventos_bot.sql
    psql -U omarte -d notificaciones -f update-centros-schema.sql
-- DATABASE notificaciones

-- SCHEMA: notif_eventos_bot

-- Primero crear la secuencia
CREATE SEQUENCE IF NOT EXISTS notif_eventos_bot.participants_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

-- 1  Tabla: Participantes

CREATE TABLE IF NOT EXISTS notif_eventos_bot.participants
(
    id integer NOT NULL DEFAULT nextval('notif_eventos_bot.participants_id_seq'::regclass),
    telegramid character varying(50) COLLATE pg_catalog."default" NOT NULL,
    nac character varying(50) COLLATE pg_catalog."default" NOT NULL,
    cedula character varying(50) COLLATE pg_catalog."default" NOT NULL,
    firstname character varying(100) COLLATE pg_catalog."default",
    lastname character varying(100) COLLATE pg_catalog."default",
    username character varying(100) COLLATE pg_catalog."default",
    email character varying(255) COLLATE pg_catalog."default",
    phone character varying(50) COLLATE pg_catalog."default",
    createdat timestamp without time zone NOT NULL DEFAULT now(),
    updatedat timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT participants_pkey PRIMARY KEY (id),
    CONSTRAINT participants_telegramid_key UNIQUE (telegramid)
);

-- Resto de tus comandos ALTER TABLE y GRANT...

-- 2 Tabla: eventos

CREATE TABLE IF NOT EXISTS notif_eventos_bot.events (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  date TIMESTAMP NOT NULL,
  location VARCHAR(255),
  active BOOLEAN DEFAULT true,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW()
);


-- Crear tipo ENUM para estado de asistencia
CREATE TYPE notif_eventos_bot.attendance_status AS ENUM ('confirmado', 'asistió', 'ausente');

-- 3 Tabla: registros de asistencia

CREATE TABLE IF NOT EXISTS notif_eventos_bot.attendances (
  id SERIAL PRIMARY KEY,
  status attendance_status NOT NULL DEFAULT 'confirmado',
  registeredAt TIMESTAMP NOT NULL DEFAULT NOW(),
  notes TEXT,
  EventId INTEGER NOT NULL REFERENCES notif_eventos_bot.events(id) ON DELETE CASCADE,
  ParticipantId INTEGER NOT NULL REFERENCES notif_eventos_bot.participants(id) ON DELETE CASCADE,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(EventId, ParticipantId)
);

-- Insertar eventos de ejemplo
INSERT INTO notif_eventos_bot.events (name, description, date, location, active) VALUES 
('Conferencia Anual de Tecnología', 'Presentación de las últimas tendencias tecnológicas del año', '2023-12-15 09:00:00', 'Centro de Convenciones, Madrid', true),
('Taller de Desarrollo Web', 'Aprende las mejores prácticas para el desarrollo web moderno', '2023-11-20 14:00:00', 'Campus Tech, Barcelona', true),
('Reunión de Networking', 'Conecta con profesionales del sector y expande tu red de contactos', '2023-11-10 18:30:00', 'Espacio Coworking, Valencia', true);

-- 4 Tabla: geo_724

CREATE TABLE IF NOT EXISTS notif_eventos_bot.geo_724
(
    cod_estado integer,
    cod_municipio integer,
    cod_parroquia integer,
    nom_estado character varying(35) COLLATE pg_catalog."default",
    nom_municipio character varying(35) COLLATE pg_catalog."default",
    nom_parroquia character varying(35) COLLATE pg_catalog."default",
    PRIMARY KEY (cod_estado, cod_municipio, cod_parroquia)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS notif_eventos_bot.geo_724
    OWNER to postgres;

-- 5 Tabla: re_723 

CREATE TABLE IF NOT EXISTS notif_eventos_bot.re_72
(
    nac character varying(1) COLLATE pg_catalog."default",
    cedula_ch character varying(9) COLLATE pg_catalog."default",
    p_apellido character varying(35) COLLATE pg_catalog."default",
    s_apellido character varying(35) COLLATE pg_catalog."default",
    p_nombre character varying(35) COLLATE pg_catalog."default",
    s_nombre character varying(35) COLLATE pg_catalog."default",
    sexo character varying(2) COLLATE pg_catalog."default",
    fecha_nac date,
    cod_estado character varying(2) COLLATE pg_catalog."default",
    cod_municipio character(2) COLLATE pg_catalog."default",
    cod_parroquia character varying(2) COLLATE pg_catalog."default",
    cod_centrov character varying(10) COLLATE pg_catalog."default",
    cedula integer
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS notif_eventos_bot.re_724
    OWNER to postgres;

-- 6 Tabla: centrosv_723

CREATE TABLE IF NOT EXISTS notif_eventos_bot.centrosv_724
(
    cod_viej_cv integer,
    cod_centro character varying(9) COLLATE pg_catalog."default",
    condicion integer,
    cod_estado integer,
    cod_municipio integer,
    cod_parroquia integer,
    nom_centro character varying(255) COLLATE pg_catalog."default",
    direccion character varying(755) COLLATE pg_catalog."default",
    plantel_mppe character varying(2) COLLATE pg_catalog."default",
    latitud float,
    longitud float,
    FOREIGN KEY (cod_estado, cod_municipio, cod_parroquia) REFERENCES notif_eventos_bot.geo_724(cod_estado, cod_municipio, cod_parroquia)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS notif_eventos_bot.centrosv_724
    OWNER to postgres;

-- Resto de tus comandos ALTER TABLE y GRANT...

INSERT INTO notif_eventos_bot.participants 
(telegramid, nac, cedula, firstname, lastname, phone, username, email)
VALUES 
('123456789', 'V', '12311614', 'Oscar José', 'Martínez Paz', '04242050125', NULL, NULL);


-- Comentarios adicionales
/*
Para ejecutar este script:
1. Asegúrate de tener PostgreSQL instalado
2. Crea la base de datos: createdb asistencia_db
3. Ejecuta el script: psql -d asistencia_db -f init-db.sql

O desde psql:
1. Conéctate a PostgreSQL: psql
2. Descomenta y ejecuta la línea CREATE DATABASE
3. Descomenta y ejecuta la línea \c asistencia_db
4. Ejecuta el resto del script
*/ 

-- Configurar el esquema
SET search_path TO notif_eventos_bot;

-- Participante ejemplo (el usuario Oscar)
INSERT INTO participants (telegramid, nac, cedula, firstname, lastname, phone)
VALUES ('123456789', 'V', '12311614', 'Oscar José', 'Martínez Paz', '04242050125')
ON CONFLICT (cedula) DO NOTHING; 