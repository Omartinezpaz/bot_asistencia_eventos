# Sistema de Asistencia a Eventos con Bot de Telegram

Un sistema integral para gestionar la asistencia a eventos mediante un bot de Telegram, permitiendo la notificación automatizada y el registro de asistentes.

## Características

- Bot de Telegram para interacción con los participantes
- Panel de administración para gestión de organizaciones, eventos y asistencias
- Envío de notificaciones programadas
- Registro de asistencia mediante ubicación geográfica, QR o método manual
- Generación de reportes y estadísticas
- Gestión de usuarios y permisos

## Requisitos del sistema

- Node.js v14.x o superior
- PostgreSQL 12.x o superior
- Cuenta de Telegram Bot API

## Instalación

1. Clonar el repositorio
```bash
git clone https://github.com/Omartinezpaz/bot_asistencia_eventos.git
cd bot_asistencia_eventos
```

2. Instalar dependencias
```bash
npm install
```

3. Copiar el archivo de ejemplo de variables de entorno
```bash
cp bot/.env.example bot/.env
```

4. Configurar las variables de entorno en el archivo `.env`

5. Inicializar la base de datos
```bash
psql -U [usuario] -d [nombre_base_datos] -a -f bot/init-db.sql
```

6. Iniciar el servidor
```bash
npm start
```

## Configuración del Bot de Telegram

1. Crear un bot en Telegram a través de @BotFather
2. Obtener el token del bot
3. Configurar el token en el archivo `.env`
4. Configurar el webhook (opcional)

## Estructura del Proyecto

- `/bot/src`: Código fuente principal
- `/bot/src/commands`: Comandos del bot
- `/bot/src/database`: Configuración y modelos de la base de datos
- `/bot/src/dashboard`: Panel de administración web
- `/bot/src/utils`: Funciones de utilidad

## Licencia

Este proyecto está licenciado bajo los términos de la licencia MIT. 