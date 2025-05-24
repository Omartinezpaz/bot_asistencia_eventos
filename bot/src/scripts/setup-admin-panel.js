require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Participante } = require('../database');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Función para crear el directorio del panel de administración
async function crearDirectorios() {
  console.log('Creando directorios necesarios...');
  
  // Crear directorio para el panel de administración si no existe
  const adminDir = path.join(__dirname, '../dashboard/admin');
  if (!fs.existsSync(adminDir)) {
    fs.mkdirSync(adminDir, { recursive: true });
    console.log(`✅ Directorio creado: ${adminDir}`);
  } else {
    console.log(`ℹ️ El directorio ya existe: ${adminDir}`);
  }
  
  // Crear directorio para los reportes si no existe
  const reportesDir = path.join(__dirname, '../../reportes');
  if (!fs.existsSync(reportesDir)) {
    fs.mkdirSync(reportesDir, { recursive: true });
    console.log(`✅ Directorio creado: ${reportesDir}`);
  } else {
    console.log(`ℹ️ El directorio ya existe: ${reportesDir}`);
  }
  
  // Crear directorio para los logos si no existe
  const logosDir = path.join(__dirname, '../../logos');
  if (!fs.existsSync(logosDir)) {
    fs.mkdirSync(logosDir, { recursive: true });
    console.log(`✅ Directorio creado: ${logosDir}`);
  } else {
    console.log(`ℹ️ El directorio ya existe: ${logosDir}`);
  }
}

// Función para crear un usuario administrador si no existe
async function crearAdminUser() {
  try {
    console.log('Verificando usuario administrador...');
    
    // Buscar si ya existe un usuario admin
    const adminUser = await Participante.findOne({
      where: { rol: 'admin' }
    });
    
    if (adminUser) {
      console.log(`✅ Usuario administrador ya existe: ${adminUser.username || adminUser.telegramId}`);
      return;
    }
    
    // Crear usuario administrador
    const admin = await Participante.create({
      telegramId: process.env.ADMIN_TELEGRAM_ID || '12345678',
      username: 'admin',
      firstName: 'Administrador',
      lastName: 'Sistema',
      nac: 'V',
      cedula: '0',
      rol: 'admin',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log(`✅ Usuario administrador creado con ID: ${admin.id}`);
    console.log(`   Telegram ID: ${admin.telegramId}`);
    console.log(`   Username: ${admin.username}`);
    
    // Recordar configurar la contraseña en el .env
    console.log('\nIMPORTANTE: Asegúrate de configurar ADMIN_PASSWORD en el archivo .env');
    
  } catch (error) {
    console.error('❌ Error al crear usuario administrador:', error);
  }
}

// Función para instalar dependencias necesarias
function instalarDependencias() {
  return new Promise((resolve, reject) => {
    console.log('Instalando dependencias necesarias...');
    
    exec('npm install bcryptjs jsonwebtoken', { cwd: path.join(__dirname, '../..') }, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Error al instalar dependencias:', error);
        reject(error);
        return;
      }
      
      console.log(stdout);
      console.log('✅ Dependencias instaladas correctamente');
      resolve();
    });
  });
}

// Función principal
async function setup() {
  try {
    console.log('Iniciando configuración del panel de administración...\n');
    
    // Crear directorios necesarios
    await crearDirectorios();
    
    // Instalar dependencias
    await instalarDependencias();
    
    // Crear usuario administrador
    await crearAdminUser();
    
    console.log('\n✅ Configuración completada correctamente');
    console.log('\nPara acceder al panel de administración:');
    console.log('1. Inicia el servidor con "npm start" o "npm run dev"');
    console.log('2. Accede a http://localhost:3000/admin');
    console.log('3. Usa el nombre de usuario "admin" y la contraseña configurada en ADMIN_PASSWORD');
    
  } catch (error) {
    console.error('❌ Error durante la configuración:', error);
  } finally {
    process.exit();
  }
}

// Ejecutar configuración
setup(); 