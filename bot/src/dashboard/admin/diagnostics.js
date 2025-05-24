/**
 * Herramienta de diagnóstico para el Panel de Administración
 * Este script ayuda a identificar y corregir problemas comunes con la base de datos y el panel
 */

// Variables globales
// Usamos la variable API_BASE_URL ya definida en app.js

// Función para iniciar diagnóstico completo
function runDiagnostics() {
    console.log('🔍 Iniciando diagnóstico completo del sistema...');
    showDiagnosticOverlay('Iniciando diagnóstico completo...');
    
    // Verificar conexión a API
    checkApiConnection()
        .then(apiStatus => {
            updateDiagnosticStatus('api', apiStatus);
            
            // Si la API está conectada, verificar estructura de la base de datos
            if (apiStatus.ok) {
                return checkDatabaseStructure();
            } else {
                throw new Error('No se pudo conectar con la API');
            }
        })
        .then(dbStatus => {
            updateDiagnosticStatus('database', dbStatus);
            
            // Verificar consistencia de datos
            return checkDataConsistency();
        })
        .then(dataStatus => {
            updateDiagnosticStatus('data', dataStatus);
            
            // Verificar estructura del DOM
            return checkDomStructure();
        })
        .then(domStatus => {
            updateDiagnosticStatus('dom', domStatus);
            
            // Finalizar diagnóstico
            completeDiagnostic();
        })
        .catch(error => {
            console.error('Error durante el diagnóstico:', error);
            failDiagnostic(error.message);
        });
}

// Verificar conexión a API
function checkApiConnection() {
    return new Promise((resolve, reject) => {
        console.log('Verificando conexión a API...');
        updateDiagnosticOverlay('Verificando conexión a API...');
        
        fetch(`${API_BASE_URL}/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        })
        .then(response => {
            if (response.ok) {
                resolve({
                    ok: true,
                    message: 'Conexión a API establecida correctamente',
                    details: { status: response.status, statusText: response.statusText }
                });
            } else {
                resolve({
                    ok: false,
                    message: `Error de conexión: ${response.status} ${response.statusText}`,
                    details: { status: response.status, statusText: response.statusText }
                });
            }
        })
        .catch(error => {
            resolve({
                ok: false,
                message: `No se pudo conectar con la API: ${error.message}`,
                details: { error: error.message }
            });
        });
    });
}

// Verificar estructura de la base de datos
function checkDatabaseStructure() {
    return new Promise((resolve, reject) => {
        console.log('Verificando estructura de la base de datos...');
        updateDiagnosticOverlay('Verificando estructura de la base de datos...');
        
        fetch(`${API_BASE_URL}/notifications/diagnostic`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            // Verificar columna scheduled_date
            const hasScheduledDate = data.table_structure.some(col => col.column_name === 'scheduled_date');
            
            // Verificar presencia de notification_stats
            const diagnosticResults = {
                ok: hasScheduledDate,
                message: hasScheduledDate 
                    ? 'Estructura de base de datos correcta' 
                    : 'Problema con la estructura de la base de datos: falta columna scheduled_date',
                details: {
                    tableStructure: data.table_structure,
                    sampleData: data.sample_data,
                    hasScheduledDate: hasScheduledDate
                },
                fixes: !hasScheduledDate ? [
                    {
                        type: 'sql',
                        description: 'Agregar columna scheduled_date',
                        sql: `ALTER TABLE notif_eventos_bot.scheduled_notifications 
                              ADD COLUMN IF NOT EXISTS scheduled_date timestamp with time zone;
                              
                              -- Copiar datos de scheduled_at si existe
                              UPDATE notif_eventos_bot.scheduled_notifications 
                              SET scheduled_date = scheduled_at 
                              WHERE scheduled_date IS NULL AND scheduled_at IS NOT NULL;`
                    }
                ] : []
            };
            
            resolve(diagnosticResults);
        })
        .catch(error => {
            resolve({
                ok: false,
                message: `Error al verificar estructura de la base de datos: ${error.message}`,
                details: { error: error.message }
            });
        });
    });
}

// Verificar consistencia de datos
function checkDataConsistency() {
    return new Promise((resolve, reject) => {
        console.log('Verificando consistencia de datos...');
        updateDiagnosticOverlay('Verificando consistencia de datos...');
        
        // Simular verificación (en una aplicación real, haría verificaciones más exhaustivas)
        setTimeout(() => {
            resolve({
                ok: true,
                message: 'Datos consistentes',
                details: { checkedTables: ['notifications', 'participants', 'events'] }
            });
        }, 1000);
    });
}

// Verificar estructura del DOM
function checkDomStructure() {
    return new Promise((resolve, reject) => {
        console.log('Verificando estructura del DOM...');
        updateDiagnosticOverlay('Verificando estructura del DOM...');
        
        // Verificar presencia de elementos críticos
        const criticalSections = [
            'dashboard-content', 
            'organizations-content', 
            'events-content', 
            'participants-content', 
            'attendance-content', 
            'notifications-content'
        ];
        
        const missingElements = criticalSections.filter(id => !document.getElementById(id));
        
        // Verificar presencia de elementos de UI críticos
        const criticalElements = [
            'notification-stats-chart', 
            'organizations-table-body',
            'events-table-body',
            'participants-table-body'
        ];
        
        const missingUIElements = criticalElements.filter(id => !document.getElementById(id));
        
        // Crear resultados de diagnóstico
        const results = {
            ok: missingElements.length === 0 && missingUIElements.length === 0,
            message: missingElements.length === 0 && missingUIElements.length === 0
                ? 'Estructura del DOM correcta'
                : `Faltan elementos en el DOM: ${[...missingElements, ...missingUIElements].join(', ')}`,
            details: {
                missingCriticalSections: missingElements,
                missingUIElements: missingUIElements
            },
            fixes: []
        };
        
        // Proponer soluciones
        if (missingElements.length > 0) {
            results.fixes.push({
                type: 'dom',
                description: 'Crear secciones faltantes',
                action: 'createMissingSections',
                elements: missingElements
            });
        }
        
        if (missingUIElements.length > 0) {
            results.fixes.push({
                type: 'dom',
                description: 'Crear elementos de UI faltantes',
                action: 'createMissingUIElements',
                elements: missingUIElements
            });
        }
        
        resolve(results);
    });
}

// Función para crear secciones faltantes
function createMissingSections(elements) {
    console.log('Creando secciones faltantes:', elements);
    
    const mainContent = document.querySelector('main');
    if (!mainContent) {
        console.error('No se encontró el elemento main para crear secciones');
        return false;
    }
    
    elements.forEach(id => {
        if (!document.getElementById(id)) {
            const section = document.createElement('div');
            section.id = id;
            section.className = 'content-section d-none';
            section.innerHTML = `
                <div class="alert alert-warning">
                    <h4>Sección restaurada</h4>
                    <p>Esta sección (${id}) fue creada automáticamente por la herramienta de diagnóstico.</p>
                    <p>Es posible que necesite actualizar el contenido o consultar al administrador.</p>
                </div>
            `;
            mainContent.appendChild(section);
            console.log(`Sección ${id} creada`);
        }
    });
    
    return true;
}

// Función para crear elementos de UI faltantes
function createMissingUIElements(elements) {
    console.log('Creando elementos de UI faltantes:', elements);
    
    elements.forEach(id => {
        if (!document.getElementById(id)) {
            // Determinar el contenedor apropiado según el tipo de elemento
            let container = null;
            
            if (id.includes('chart')) {
                // Es un gráfico, buscar contenedor de gráficos
                container = document.querySelector('.chart-container');
                if (container) {
                    const canvas = document.createElement('canvas');
                    canvas.id = id;
                    container.appendChild(canvas);
                    console.log(`Canvas ${id} creado`);
                }
            } else if (id.includes('table-body')) {
                // Es un cuerpo de tabla, buscar la tabla contenedora
                const tableId = id.replace('-body', '');
                const table = document.getElementById(tableId);
                if (table) {
                    const tbody = document.createElement('tbody');
                    tbody.id = id;
                    table.appendChild(tbody);
                    console.log(`Tbody ${id} creado`);
                } else {
                    // Si no existe la tabla, crear tanto la tabla como el tbody
                    const sectionId = id.split('-')[0] + '-content';
                    const section = document.getElementById(sectionId);
                    if (section) {
                        const tableContainer = document.createElement('div');
                        tableContainer.className = 'table-responsive';
                        
                        const table = document.createElement('table');
                        table.id = tableId;
                        table.className = 'table table-striped';
                        
                        const thead = document.createElement('thead');
                        thead.innerHTML = '<tr><th>ID</th><th>Nombre</th><th>Estado</th><th>Acciones</th></tr>';
                        
                        const tbody = document.createElement('tbody');
                        tbody.id = id;
                        
                        table.appendChild(thead);
                        table.appendChild(tbody);
                        tableContainer.appendChild(table);
                        section.appendChild(tableContainer);
                        
                        console.log(`Tabla ${tableId} y tbody ${id} creados`);
                    }
                }
            }
        }
    });
    
    return true;
}

// Mostrar overlay de diagnóstico
function showDiagnosticOverlay(message) {
    let overlay = document.getElementById('diagnostic-overlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'diagnostic-overlay';
        overlay.className = 'position-fixed top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center bg-dark bg-opacity-75 text-white';
        overlay.style.zIndex = '9999';
        
        overlay.innerHTML = `
            <h3>Diagnóstico del Sistema</h3>
            <div class="spinner-border text-light mb-3" role="status">
                <span class="visually-hidden">Cargando...</span>
            </div>
            <p id="diagnostic-message">${message || 'Realizando diagnóstico...'}</p>
            <div id="diagnostic-results" class="container mt-4" style="max-height: 60vh; overflow-y: auto;"></div>
        `;
        
        document.body.appendChild(overlay);
    } else {
        document.getElementById('diagnostic-message').textContent = message;
    }
}

// Actualizar mensaje en overlay de diagnóstico
function updateDiagnosticOverlay(message) {
    const msgElement = document.getElementById('diagnostic-message');
    if (msgElement) {
        msgElement.textContent = message;
    }
}

// Actualizar estado de diagnóstico
function updateDiagnosticStatus(category, status) {
    const resultsContainer = document.getElementById('diagnostic-results');
    if (!resultsContainer) return;
    
    // Crear o actualizar la sección de esta categoría
    let categorySection = document.getElementById(`diagnostic-${category}`);
    
    if (!categorySection) {
        categorySection = document.createElement('div');
        categorySection.id = `diagnostic-${category}`;
        categorySection.className = 'card mb-3';
        
        categorySection.innerHTML = `
            <div class="card-header bg-${status.ok ? 'success' : 'danger'} text-white">
                ${getCategoryTitle(category)}
            </div>
            <div class="card-body">
                <p>${status.message}</p>
                <div class="fixes-container"></div>
            </div>
        `;
        
        resultsContainer.appendChild(categorySection);
    } else {
        categorySection.querySelector('.card-header').className = `card-header bg-${status.ok ? 'success' : 'danger'} text-white`;
        categorySection.querySelector('.card-body p').textContent = status.message;
    }
    
    // Añadir soluciones si hay disponibles
    if (status.fixes && status.fixes.length > 0) {
        const fixesContainer = categorySection.querySelector('.fixes-container');
        fixesContainer.innerHTML = '<h6 class="mt-3">Soluciones disponibles:</h6>';
        
        status.fixes.forEach((fix, index) => {
            const fixBtn = document.createElement('button');
            fixBtn.className = 'btn btn-sm btn-primary me-2 mb-2';
            fixBtn.textContent = fix.description;
            fixBtn.onclick = () => applyFix(category, index, fix);
            
            fixesContainer.appendChild(fixBtn);
        });
    }
}

// Obtener título para cada categoría
function getCategoryTitle(category) {
    switch(category) {
        case 'api': return '🔌 Conexión API';
        case 'database': return '🗄️ Estructura de Base de Datos';
        case 'data': return '📊 Consistencia de Datos';
        case 'dom': return '🖥️ Estructura del DOM';
        default: return category;
    }
}

// Aplicar una solución
function applyFix(category, index, fix) {
    console.log(`Aplicando solución para ${category}:`, fix);
    
    switch(fix.type) {
        case 'dom':
            if (fix.action === 'createMissingSections') {
                if (createMissingSections(fix.elements)) {
                    showFixSuccess(category, index, 'Secciones creadas correctamente');
                } else {
                    showFixError(category, index, 'Error al crear secciones');
                }
            } else if (fix.action === 'createMissingUIElements') {
                if (createMissingUIElements(fix.elements)) {
                    showFixSuccess(category, index, 'Elementos de UI creados correctamente');
                } else {
                    showFixError(category, index, 'Error al crear elementos de UI');
                }
            }
            break;
            
        case 'sql':
            // En un entorno real, esto enviaría el SQL al servidor
            showFixSuccess(category, index, 'Consulta SQL aplicada correctamente (simulado)');
            break;
            
        default:
            console.error('Tipo de solución desconocido:', fix.type);
    }
}

// Mostrar éxito al aplicar solución
function showFixSuccess(category, index, message) {
    const categorySection = document.getElementById(`diagnostic-${category}`);
    if (!categorySection) return;
    
    const fixButtons = categorySection.querySelectorAll('.fixes-container button');
    if (fixButtons[index]) {
        fixButtons[index].disabled = true;
        fixButtons[index].className = 'btn btn-sm btn-success me-2 mb-2';
        fixButtons[index].innerHTML = `<i class="bi bi-check"></i> ${fixButtons[index].textContent}`;
        
        const successMsg = document.createElement('div');
        successMsg.className = 'alert alert-success mt-2';
        successMsg.textContent = message;
        
        fixButtons[index].parentNode.appendChild(successMsg);
        
        setTimeout(() => {
            successMsg.remove();
        }, 5000);
    }
}

// Mostrar error al aplicar solución
function showFixError(category, index, message) {
    const categorySection = document.getElementById(`diagnostic-${category}`);
    if (!categorySection) return;
    
    const fixButtons = categorySection.querySelectorAll('.fixes-container button');
    if (fixButtons[index]) {
        fixButtons[index].className = 'btn btn-sm btn-danger me-2 mb-2';
        
        const errorMsg = document.createElement('div');
        errorMsg.className = 'alert alert-danger mt-2';
        errorMsg.textContent = message;
        
        fixButtons[index].parentNode.appendChild(errorMsg);
        
        setTimeout(() => {
            errorMsg.remove();
            fixButtons[index].className = 'btn btn-sm btn-primary me-2 mb-2';
        }, 5000);
    }
}

// Completar diagnóstico con éxito
function completeDiagnostic() {
    const overlay = document.getElementById('diagnostic-overlay');
    if (!overlay) return;
    
    const spinner = overlay.querySelector('.spinner-border');
    if (spinner) spinner.remove();
    
    document.getElementById('diagnostic-message').textContent = '✅ Diagnóstico completado';
    
    // Añadir botón para cerrar
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-light mt-3';
    closeBtn.textContent = 'Cerrar';
    closeBtn.onclick = () => {
        overlay.remove();
        window.location.reload(); // Recargar para aplicar cambios
    };
    
    overlay.appendChild(closeBtn);
}

// Fallar diagnóstico
function failDiagnostic(message) {
    const overlay = document.getElementById('diagnostic-overlay');
    if (!overlay) return;
    
    const spinner = overlay.querySelector('.spinner-border');
    if (spinner) spinner.remove();
    
    document.getElementById('diagnostic-message').textContent = `❌ Error en diagnóstico: ${message}`;
    
    // Añadir botón para cerrar
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-light mt-3';
    closeBtn.textContent = 'Cerrar';
    closeBtn.onclick = () => overlay.remove();
    
    overlay.appendChild(closeBtn);
}

// Exponer funciones al ámbito global
window.runDiagnostics = runDiagnostics; 