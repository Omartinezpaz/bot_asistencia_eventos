// Variables globales
const API_BASE_URL = '/api';
let currentUser = null;

// Función para inicializar la aplicación
document.addEventListener('DOMContentLoaded', function() {
    // Verificar si el usuario está autenticado
    checkAuthentication();
    
    // Configurar eventos de navegación
    setupNavigation();
    
    // Configurar eventos de formularios
    setupFormHandlers();
    
    // Botón de recarga
    document.getElementById('reload-page-btn').addEventListener('click', function() {
        console.log('Forzando recarga completa de la página...');
        window.location.reload(true); // true para forzar recarga desde el servidor
    });
});

// Función para verificar la autenticación del usuario
function checkAuthentication() {
    const token = localStorage.getItem('adminToken');
    
    if (!token) {
        // Redirigir a la página de login si no hay token
        window.location.href = 'login.html';
        return;
    }
    
    // Verificar validez del token
    fetch(`${API_BASE_URL}/auth/verify`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Token inválido');
        }
        return response.json();
    })
    .then(data => {
        currentUser = data.user;
        // Actualizar UI con información del usuario
        document.getElementById('userDropdown').innerHTML = `
            <i class="bi bi-person-circle me-1"></i>
            ${currentUser.username || 'Admin'}
        `;
        
        // Cargar datos iniciales
        loadDashboardData();
    })
    .catch(error => {
        console.error('Error de autenticación:', error);
        // Redirigir a login si hay error de autenticación
        localStorage.removeItem('adminToken');
        window.location.href = 'login.html';
    });
}

// Configurar eventos de navegación
function setupNavigation() {
    // Dashboard
    document.getElementById('dashboard-link').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('dashboard');
        loadDashboardData();
    });
    
    // Organizaciones
    document.getElementById('organizations-link').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('organizations');
        loadOrganizations();
    });
    
    // Eventos
    document.getElementById('events-link').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('events');
        loadEvents();
    });
    
    // Participantes
    document.getElementById('participants-link').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('participants');
        loadParticipants();
    });
    
    // Asistencias
    document.getElementById('attendance-link').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('attendance');
        loadAttendanceData();
    });
    
    // Notificaciones
    document.getElementById('notifications-link').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('notifications');
        loadNotificationsData();
    });
    
    // Reportes
    document.getElementById('reports-link').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('reports');
        loadReportsData();
    });
    
    // Configuración
    document.getElementById('settings-link').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('settings');
        loadSettingsData();
    });
    
    // Cerrar sesión
    document.getElementById('logout-btn').addEventListener('click', function(e) {
        e.preventDefault();
        logout();
    });
}

// Configurar eventos de formularios
function setupFormHandlers() {
    // Modal de organización
    document.getElementById('add-organization-btn')?.addEventListener('click', function() {
        // Limpiar formulario
        document.getElementById('organization-form').reset();
        document.getElementById('organization-id').value = '';
        document.getElementById('organizationModalLabel').textContent = 'Nueva Organización';
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('organizationModal'));
        modal.show();
    });
    
    // Guardar organización
    document.getElementById('save-organization-btn')?.addEventListener('click', function() {
        saveOrganization();
    });
    
    // Modal de evento
    document.getElementById('add-event-btn')?.addEventListener('click', function() {
        // Limpiar formulario
        document.getElementById('event-form').reset();
        document.getElementById('event-id').value = '';
        document.getElementById('eventModalLabel').textContent = 'Nuevo Evento';
        
        // Cargar organizaciones para el select
        loadOrganizationsForSelect();
        
        // Establecer fecha predeterminada (hoy)
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('event-date').value = now.toISOString().slice(0, 16);
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('eventModal'));
        modal.show();
    });
    
    // Guardar evento
    document.getElementById('save-event-btn')?.addEventListener('click', function() {
        saveEvent();
    });
    
    // Modal de participante
    document.getElementById('add-participant-btn')?.addEventListener('click', function() {
        // Limpiar formulario
        document.getElementById('participant-form').reset();
        document.getElementById('participant-id').value = '';
        document.getElementById('participantModalLabel').textContent = 'Nuevo Participante';
        
        // Cargar organizaciones para el select
        loadOrganizationsForSelect('participant-organization');
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('participantModal'));
        modal.show();
    });
    
    // Guardar participante
    document.getElementById('save-participant-btn')?.addEventListener('click', function() {
        saveParticipant();
    });
    
    // Modal de importación
    document.getElementById('import-participants-btn')?.addEventListener('click', function() {
        // Limpiar formulario
        document.getElementById('import-participants-form').reset();
        
        // Cargar organizaciones para el select
        loadOrganizationsForSelect('import-organization');
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('importParticipantsModal'));
        modal.show();
    });
    
    // Iniciar importación
    document.getElementById('start-import-btn')?.addEventListener('click', function() {
        importParticipants();
    });
    
    // Búsqueda de participantes
    document.getElementById('btn-participant-search')?.addEventListener('click', function() {
        const searchTerm = document.getElementById('participant-search').value.trim();
        loadParticipants(1, searchTerm); // Buscar en la primera página
    });
    
    // Búsqueda con Enter
    document.getElementById('participant-search')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const searchTerm = document.getElementById('participant-search').value.trim();
            loadParticipants(1, searchTerm);
        }
    });
    
    // Modal de asistencia
    document.getElementById('add-attendance-btn')?.addEventListener('click', function() {
        // Limpiar formulario
        document.getElementById('attendance-form').reset();
        document.getElementById('attendance-id').value = '';
        document.getElementById('attendanceModalLabel').textContent = 'Registrar Asistencia';
        
        // Cargar selects
        loadParticipantsForSelect();
        loadEventsForSelect();
        
        // Establecer fecha predeterminada (ahora)
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('attendance-date').value = now.toISOString().slice(0, 16);
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('attendanceModal'));
        modal.show();
    });
    
    // Guardar asistencia
    document.getElementById('save-attendance-btn')?.addEventListener('click', function() {
        saveAttendance();
    });
    
    // Modal de exportación
    document.getElementById('export-attendance-btn')?.addEventListener('click', function() {
        // Limpiar formulario
        document.getElementById('export-attendance-form').reset();
        
        // Cargar eventos para el select
        loadEventsForSelect('export-event');
        
        // Establecer fechas predeterminadas (último mes)
        const today = new Date();
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        
        document.getElementById('export-date-start').value = lastMonth.toISOString().split('T')[0];
        document.getElementById('export-date-end').value = today.toISOString().split('T')[0];
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('exportAttendanceModal'));
        modal.show();
    });
    
    // Iniciar exportación
    document.getElementById('start-export-btn')?.addEventListener('click', function() {
        exportAttendances();
    });
    
    // Editar desde la vista de detalles
    document.getElementById('edit-from-view-btn')?.addEventListener('click', function() {
        const attendanceId = this.getAttribute('data-id');
        // Cerrar modal de detalles
        bootstrap.Modal.getInstance(document.getElementById('viewAttendanceModal')).hide();
        // Abrir modal de edición
        editAttendance(attendanceId);
    });
    
    // Filtro de evento para asistencias
    document.getElementById('attendance-event-filter')?.addEventListener('change', function() {
        loadAttendances();
    });
    
    // Búsqueda de asistencias
    document.getElementById('btn-attendance-search')?.addEventListener('click', function() {
        const searchTerm = document.getElementById('attendance-search').value.trim();
        loadAttendances(1, searchTerm);
    });
    
    // Búsqueda con Enter
    document.getElementById('attendance-search')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const searchTerm = this.value.trim();
            loadAttendances(1, searchTerm);
        }
    });
    
    // Configurar handlers específicos para notificaciones
    setupNotificationsHandlers();
}

// Función para mostrar una sección y ocultar las demás
function showSection(sectionId) {
    // Depuración
    console.log('Intentando mostrar sección:', sectionId);
    
    // Actualizar título de la página
    const pageTitle = document.getElementById('page-title');
    
    // Ocultar todas las secciones
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('d-none');
    });
    
    // Desactivar todos los enlaces de navegación
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Mostrar la sección seleccionada
    const targetSection = document.getElementById(`${sectionId}-content`);
    if (targetSection) {
        console.log(`Sección ${sectionId}-content encontrada, mostrando...`);
        targetSection.classList.remove('d-none');
    } else {
        console.error(`Error: No se encontró la sección con id "${sectionId}-content"`);
        // Si la sección no existe, crear un div temporal para mostrar un mensaje de error
        const mainContent = document.querySelector('main');
        if (mainContent) {
            const errorDiv = document.createElement('div');
            errorDiv.id = `${sectionId}-content-temp`;
            errorDiv.className = 'content-section alert alert-warning';
            errorDiv.innerHTML = `
                <h4>Sección no disponible</h4>
                <p>La sección "${sectionId}" no está disponible en este momento. Por favor, intente nuevamente o contacte al administrador.</p>
                <button class="btn btn-primary" onclick="window.location.reload()">Recargar página</button>
            `;
            mainContent.appendChild(errorDiv);
        }
    }
    
    // Activar el enlace de navegación correspondiente
    const navLink = document.getElementById(`${sectionId}-link`);
    if (navLink) {
        navLink.classList.add('active');
    } else {
        console.error(`Error: No se encontró el enlace con id "${sectionId}-link"`);
    }
    
    // Actualizar título según la sección
    if (pageTitle) {
        switch(sectionId) {
            case 'dashboard':
                pageTitle.textContent = 'Dashboard';
                break;
            case 'organizations':
                pageTitle.textContent = 'Organizaciones';
                break;
            case 'events':
                pageTitle.textContent = 'Eventos';
                break;
            case 'participants':
                pageTitle.textContent = 'Participantes';
                break;
            case 'attendance':
                pageTitle.textContent = 'Asistencias';
                break;
            case 'notifications':
                pageTitle.textContent = 'Notificaciones';
                break;
            case 'reports':
                pageTitle.textContent = 'Reportes';
                break;
            case 'settings':
                pageTitle.textContent = 'Configuración';
                break;
            default:
                pageTitle.textContent = 'Panel de Administración';
        }
    }
    
    // Limpiar cualquier mensaje de error temporal anterior
    document.querySelectorAll('[id$="-content-temp"]').forEach(tempElement => {
        if (tempElement.id !== `${sectionId}-content-temp`) {
            tempElement.remove();
        }
    });
}

// Función para cargar datos del dashboard
function loadDashboardData() {
    // Obtener contadores
    fetch(`${API_BASE_URL}/dashboard/stats`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Actualizar contadores
        document.getElementById('org-count').textContent = data?.organizations || 0;
        document.getElementById('event-count').textContent = data?.events || 0;
        document.getElementById('participant-count').textContent = data?.participants || 0;
        document.getElementById('attendance-count').textContent = data?.attendances || 0;
        
        // Cargar eventos recientes
        loadRecentEvents();
        
        // Cargar gráfico de notificaciones
        loadNotificationsChart(data?.notificationStats);
    })
    .catch(error => {
        console.error('Error al cargar estadísticas:', error);
        showAlert('Error al cargar estadísticas del dashboard', 'danger');
        document.getElementById('org-count').textContent = 0;
        document.getElementById('event-count').textContent = 0;
        document.getElementById('participant-count').textContent = 0;
        document.getElementById('attendance-count').textContent = 0;
    });
}

// Función para cargar eventos recientes
function loadRecentEvents() {
    fetch(`${API_BASE_URL}/events/recent`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return response.json();
    })
    .then(events => {
        const tableBody = document.getElementById('recent-events-body');
        tableBody.innerHTML = '';
        
        if (!events || events.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center">No hay eventos recientes</td></tr>';
            return;
        }
        
        events.forEach(event => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${event.name}</td>
                <td>${new Date(event.date).toLocaleString()}</td>
                <td>${event.organization?.name || 'N/A'}</td>
                <td>${event.attendanceCount || 0}</td>
            `;
            tableBody.appendChild(row);
        });
    })
    .catch(error => {
        console.error('Error al cargar eventos recientes:', error);
        const tableBody = document.getElementById('recent-events-body');
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Error al cargar eventos</td></tr>';
    });
}

// Función para cargar gráfico de notificaciones
function loadNotificationsChart(stats) {
    if (!stats) return;
    
    const ctx = document.getElementById('notification-stats-chart');
    if (!ctx) {
        console.error('Error: No se encontró el elemento canvas con ID "notification-stats-chart"');
        return;
    }
    
    try {
        // Destruir gráfico anterior si existe
        if (window.notificationsChart instanceof Chart) {
            window.notificationsChart.destroy();
        }
        
        // Crear nuevo gráfico
        window.notificationsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Enviadas', 'Entregadas', 'Leídas', 'Respondidas'],
                datasets: [{
                    label: 'Notificaciones',
                    data: [
                        stats.sent || 0,
                        stats.delivered || 0,
                        stats.read || 0,
                        stats.responded || 0
                    ],
                    backgroundColor: [
                        'rgba(78, 115, 223, 0.8)',
                        'rgba(28, 200, 138, 0.8)',
                        'rgba(54, 185, 204, 0.8)',
                        'rgba(246, 194, 62, 0.8)'
                    ],
                    borderColor: [
                        'rgb(78, 115, 223)',
                        'rgb(28, 200, 138)',
                        'rgb(54, 185, 204)',
                        'rgb(246, 194, 62)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error al crear el gráfico de notificaciones:', error);
    }
}

// Función para cargar organizaciones
function loadOrganizations() {
    console.log('Cargando organizaciones...');
    
    // Verificar si el contenedor existe
    const container = document.getElementById('organizations-body');
    if (!container) {
        console.error('Error: No se encontró el elemento con ID "organizations-body"');
        showAlert('Error al cargar organizaciones: Elemento contenedor no encontrado', 'danger');
        return;
    }
    
    // Mostrar indicador de carga
    container.innerHTML = '<tr><td colspan="6" class="text-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div></td></tr>';
    
    fetch(`${API_BASE_URL}/organizations`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return response.json();
    })
    .then(organizations => {
        // Verificar si el contenedor sigue existiendo (podría haber cambiado de vista)
        if (!document.getElementById('organizations-body')) {
            console.warn('El contenedor ya no existe, posiblemente se cambió de vista');
            return;
        }
        
        if (!organizations || organizations.length === 0) {
            container.innerHTML = '<tr><td colspan="6" class="text-center">No hay organizaciones registradas</td></tr>';
            return;
        }
        
        container.innerHTML = '';
        
        organizations.forEach(org => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${org.id}</td>
                <td>${org.name}</td>
                <td>${org.contact_email || '-'}</td>
                <td>${org.contact_phone || '-'}</td>
                <td>
                    <span class="badge ${org.active ? 'bg-success' : 'bg-danger'}">
                        ${org.active ? 'Activa' : 'Inactiva'}
                    </span>
                </td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm" role="group" aria-label="Acciones para organización ${org.name}">
                        <button type="button" class="btn btn-outline-primary" onclick="viewOrganization(${org.id})" aria-label="Ver detalles de ${org.name}">
                            <i class="bi bi-eye" aria-hidden="true"></i>
                            <span class="visually-hidden">Ver detalles</span>
                        </button>
                        <button type="button" class="btn btn-outline-primary" onclick="editOrganization(${org.id})" aria-label="Editar ${org.name}">
                            <i class="bi bi-pencil" aria-hidden="true"></i>
                            <span class="visually-hidden">Editar</span>
                        </button>
                        <button type="button" class="btn ${org.active ? 'btn-outline-danger' : 'btn-outline-success'}" 
                                onclick="toggleOrganizationStatus(${org.id}, ${!org.active})"
                                aria-label="${org.active ? 'Desactivar' : 'Activar'} ${org.name}">
                            <i class="bi ${org.active ? 'bi-toggle-on' : 'bi-toggle-off'}" aria-hidden="true"></i>
                            <span class="visually-hidden">${org.active ? 'Desactivar' : 'Activar'}</span>
                        </button>
                    </div>
                </td>
            `;
            container.appendChild(row);
        });
        
        // Actualizar contador si existe
        const counter = document.getElementById('organizations-count');
        if (counter) {
            counter.textContent = organizations.length;
        }
    })
    .catch(error => {
        console.error('Error al cargar organizaciones:', error);
        // Solo actualizar el HTML si el contenedor aún existe
        if (document.getElementById('organizations-body')) {
            container.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error al cargar organizaciones</td></tr>';
        }
        showAlert('Error al cargar organizaciones: ' + error.message, 'danger');
    });
}

// Función para editar una organización
function editOrganization(orgId) {
    fetch(`${API_BASE_URL}/organizations/${orgId}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => response.json())
    .then(org => {
        // Llenar formulario con datos de la organización
        document.getElementById('organization-id').value = org.id;
        document.getElementById('organization-name').value = org.name;
        document.getElementById('organization-description').value = org.description || '';
        document.getElementById('organization-contact-email').value = org.contact_email || '';
        document.getElementById('organization-contact-phone').value = org.contact_phone || '';
        document.getElementById('organization-active').checked = org.active;
        
        // Actualizar título del modal
        document.getElementById('organizationModalLabel').textContent = 'Editar Organización';
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('organizationModal'));
        modal.show();
    })
    .catch(error => {
        console.error('Error al cargar datos de la organización:', error);
        showAlert('Error al cargar datos de la organización', 'danger');
    });
}

// Función para guardar una organización (nueva o existente)
function saveOrganization() {
    // Obtener datos del formulario
    const orgId = document.getElementById('organization-id').value;
    const orgData = {
        name: document.getElementById('organization-name').value,
        description: document.getElementById('organization-description').value,
        contact_email: document.getElementById('organization-contact-email').value,
        contact_phone: document.getElementById('organization-contact-phone').value,
        active: document.getElementById('organization-active').checked
    };
    
    // Validar datos
    if (!orgData.name) {
        showAlert('El nombre de la organización es obligatorio', 'warning');
        return;
    }
    
    // URL y método según si es creación o edición
    const url = orgId ? `${API_BASE_URL}/organizations/${orgId}` : `${API_BASE_URL}/organizations`;
    const method = orgId ? 'PUT' : 'POST';
    
    // Enviar petición
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify(orgData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al guardar la organización');
        }
        return response.json();
    })
    .then(data => {
        // Cerrar modal
        bootstrap.Modal.getInstance(document.getElementById('organizationModal')).hide();
        
        // Mostrar mensaje de éxito
        showAlert(
            orgId ? 'Organización actualizada correctamente' : 'Organización creada correctamente',
            'success'
        );
        
        // Recargar lista de organizaciones
        loadOrganizations();
    })
    .catch(error => {
        console.error('Error al guardar organización:', error);
        showAlert('Error al guardar la organización', 'danger');
    });
}

// Función para cambiar el estado de una organización
function toggleOrganizationStatus(orgId, active) {
    fetch(`${API_BASE_URL}/organizations/${orgId}/status`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({ active })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al cambiar el estado de la organización');
        }
        return response.json();
    })
    .then(data => {
        showAlert(`Organización ${active ? 'activada' : 'desactivada'} correctamente`, 'success');
        loadOrganizations();
    })
    .catch(error => {
        console.error('Error al cambiar estado de organización:', error);
        showAlert('Error al cambiar el estado de la organización', 'danger');
    });
}

// Función para ver detalles de una organización
function viewOrganization(orgId) {
    // Implementar vista detallada de organización
    // Por ahora, solo redireccionar a la edición
    editOrganization(orgId);
}

// Función para cargar eventos
function loadEvents() {
    fetch(`${API_BASE_URL}/events`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return response.json();
    })
    .then(events => {
        const tableBody = document.getElementById('events-body');
        if (!tableBody) {
            console.error('Error: No se encontró el elemento con ID "events-body"');
            return;
        }
        
        tableBody.innerHTML = '';
        
        if (!events || events.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No hay eventos registrados</td></tr>';
            return;
        }
        
        events.forEach(event => {
            const date = new Date(event.date);
            const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${event.id}</td>
                <td>${event.name}</td>
                <td>${formattedDate}</td>
                <td>${event.Organizacion?.name || 'N/A'}</td>
                <td>
                    <span class="badge ${event.active ? 'bg-success' : 'bg-danger'}">
                        ${event.active ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>${event.attendanceCount || 0}</td>
                <td>
                    <button class="btn btn-sm btn-primary edit-event-btn" data-id="${event.id}">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm ${event.active ? 'btn-warning' : 'btn-success'} toggle-event-btn" data-id="${event.id}" data-active="${event.active}">
                        <i class="bi ${event.active ? 'bi-x-circle' : 'bi-check-circle'}"></i>
                    </button>
                    <button class="btn btn-sm btn-info view-event-attendances-btn" data-id="${event.id}">
                        <i class="bi bi-people"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        // Configurar eventos para botones de edición
        document.querySelectorAll('.edit-event-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const eventId = this.getAttribute('data-id');
                editEvent(eventId);
            });
        });
        
        // Configurar eventos para botones de activar/desactivar
        document.querySelectorAll('.toggle-event-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const eventId = this.getAttribute('data-id');
                const isActive = this.getAttribute('data-active') === 'true';
                toggleEventStatus(eventId, !isActive);
            });
        });
        
        // Configurar eventos para botones de ver asistencias
        document.querySelectorAll('.view-event-attendances-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const eventId = this.getAttribute('data-id');
                viewEventAttendances(eventId);
            });
        });
    })
    .catch(error => {
        console.error('Error al cargar eventos:', error);
        showAlert('Error al cargar la lista de eventos', 'danger');
        const tableBody = document.getElementById('events-body');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Error al cargar eventos</td></tr>';
        }
    });
}

// Función para cargar organizaciones en el select del formulario de eventos
function loadOrganizationsForSelect() {
    fetch(`${API_BASE_URL}/organizations`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return response.json();
    })
    .then(organizations => {
        const select = document.getElementById('event-organization');
        
        // Mantener la primera opción (Seleccione una organización)
        const firstOption = select.options[0];
        select.innerHTML = '';
        select.appendChild(firstOption);
        
        // Agregar opciones de organizaciones
        if (organizations && organizations.length > 0) {
            organizations.forEach(org => {
                if (org.active) { // Solo incluir organizaciones activas
                    const option = document.createElement('option');
                    option.value = org.id;
                    option.textContent = org.name;
                    select.appendChild(option);
                }
            });
        }
    })
    .catch(error => {
        console.error('Error al cargar organizaciones para el select:', error);
        showAlert('Error al cargar la lista de organizaciones', 'warning');
    });
}

// Función para editar un evento
function editEvent(eventId) {
    fetch(`${API_BASE_URL}/events/${eventId}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return response.json();
    })
    .then(event => {
        // Cargar organizaciones para el select
        loadOrganizationsForSelect();
        
        // Formatear fecha para el input datetime-local
        const eventDate = new Date(event.date);
        eventDate.setMinutes(eventDate.getMinutes() - eventDate.getTimezoneOffset());
        const formattedDate = eventDate.toISOString().slice(0, 16);
        
        // Llenar formulario con datos del evento
        document.getElementById('event-id').value = event.id;
        document.getElementById('event-name').value = event.name;
        document.getElementById('event-description').value = event.description || '';
        document.getElementById('event-date').value = formattedDate;
        document.getElementById('event-location').value = event.location || '';
        document.getElementById('event-active').checked = event.active;
        document.getElementById('event-notification-enabled').checked = event.notification_enabled;
        document.getElementById('event-notification-hours').value = event.notification_hours_before || 24;
        
        // Establecer organización seleccionada (con un pequeño retraso para asegurar que las opciones estén cargadas)
        setTimeout(() => {
            const orgSelect = document.getElementById('event-organization');
            if (event.organization_id) {
                for (let i = 0; i < orgSelect.options.length; i++) {
                    if (orgSelect.options[i].value == event.organization_id) {
                        orgSelect.selectedIndex = i;
                        break;
                    }
                }
            }
        }, 300);
        
        // Actualizar título del modal
        document.getElementById('eventModalLabel').textContent = 'Editar Evento';
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('eventModal'));
        modal.show();
    })
    .catch(error => {
        console.error('Error al cargar datos del evento:', error);
        showAlert('Error al cargar datos del evento', 'danger');
    });
}

// Función para guardar un evento (nuevo o existente)
function saveEvent() {
    // Obtener datos del formulario
    const eventId = document.getElementById('event-id').value;
    const eventData = {
        name: document.getElementById('event-name').value,
        description: document.getElementById('event-description').value,
        date: document.getElementById('event-date').value,
        location: document.getElementById('event-location').value,
        organization_id: document.getElementById('event-organization').value,
        active: document.getElementById('event-active').checked,
        notification_enabled: document.getElementById('event-notification-enabled').checked,
        notification_hours_before: document.getElementById('event-notification-hours').value
    };
    
    // Validar datos
    if (!eventData.name) {
        showAlert('El nombre del evento es obligatorio', 'warning');
        return;
    }
    
    if (!eventData.date) {
        showAlert('La fecha del evento es obligatoria', 'warning');
        return;
    }
    
    if (!eventData.organization_id) {
        showAlert('Debe seleccionar una organización', 'warning');
        return;
    }
    
    // URL y método según si es creación o edición
    const url = eventId ? `${API_BASE_URL}/events/${eventId}` : `${API_BASE_URL}/events`;
    const method = eventId ? 'PUT' : 'POST';
    
    // Enviar petición
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify(eventData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al guardar el evento');
        }
        return response.json();
    })
    .then(data => {
        // Cerrar modal
        bootstrap.Modal.getInstance(document.getElementById('eventModal')).hide();
        
        // Mostrar mensaje de éxito
        showAlert(
            eventId ? 'Evento actualizado correctamente' : 'Evento creado correctamente',
            'success'
        );
        
        // Recargar lista de eventos
        loadEvents();
    })
    .catch(error => {
        console.error('Error al guardar evento:', error);
        showAlert('Error al guardar el evento', 'danger');
    });
}

// Función para cambiar el estado de un evento
function toggleEventStatus(eventId, active) {
    fetch(`${API_BASE_URL}/events/${eventId}/status`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({ active })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al cambiar el estado del evento');
        }
        return response.json();
    })
    .then(data => {
        showAlert(`Evento ${active ? 'activado' : 'desactivado'} correctamente`, 'success');
        loadEvents();
    })
    .catch(error => {
        console.error('Error al cambiar estado del evento:', error);
        showAlert('Error al cambiar el estado del evento', 'danger');
    });
}

// Función para ver asistencias de un evento
function viewEventAttendances(eventId) {
    // Cambiar a la pestaña de asistencias y filtrar por el evento seleccionado
    showSection('attendance');
    
    // Aquí implementaremos después la función para filtrar asistencias por evento
    // Por ahora, solo mostraremos un mensaje
    showAlert(`Mostrando asistencias para el evento ID: ${eventId}`, 'info');
    
    // La función loadEventAttendances se implementará cuando desarrollemos la pestaña de asistencias
}

// Función para cerrar sesión
function logout() {
    localStorage.removeItem('adminToken');
    window.location.href = 'login.html';
}

// Función para mostrar alertas
function showAlert(message, type = 'info') {
    // Crear elemento de alerta
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Insertar alerta al inicio del contenido principal
    const main = document.querySelector('main');
    main.insertBefore(alertDiv, main.firstChild);
    
    // Eliminar automáticamente después de 5 segundos
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 150);
    }, 5000);
}

// Función para cargar participantes
function loadParticipants(page = 1, searchTerm = '') {
    const limit = 10;
    fetch(`${API_BASE_URL}/participants?page=${page}&limit=${limit}&search=${searchTerm}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        const tableBody = document.getElementById('participants-body');
        if (!tableBody) {
            console.error('Error: No se encontró el elemento con ID "participants-body"');
            return;
        }
        
        tableBody.innerHTML = '';
        
        if (!data.participants || data.participants.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No hay participantes registrados</td></tr>';
            return;
        }
        
        data.participants.forEach(participant => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${participant.id}</td>
                <td>${participant.nac}-${participant.cedula}</td>
                <td>${participant.firstName} ${participant.lastName}</td>
                <td>${participant.Organizacion?.name || 'Sin organización'}</td>
                <td>
                    ${participant.telegramId ? 
                        `<span class="badge bg-success"><i class="bi bi-telegram"></i> Vinculado</span>` : 
                        `<span class="badge bg-secondary">No vinculado</span>`
                    }
                </td>
                <td>
                    <button class="btn btn-sm btn-primary edit-participant-btn" data-id="${participant.id}">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-danger delete-participant-btn" data-id="${participant.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                    <button class="btn btn-sm btn-info view-participant-attendance-btn" data-id="${participant.id}">
                        <i class="bi bi-calendar-check"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        // Configurar eventos para botones
        document.querySelectorAll('.edit-participant-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const participantId = this.getAttribute('data-id');
                editParticipant(participantId);
            });
        });
        
        document.querySelectorAll('.delete-participant-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const participantId = this.getAttribute('data-id');
                if (confirm('¿Está seguro que desea eliminar este participante?')) {
                    deleteParticipant(participantId);
                }
            });
        });
        
        document.querySelectorAll('.view-participant-attendance-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const participantId = this.getAttribute('data-id');
                viewParticipantAttendance(participantId);
            });
        });
        
        // Actualizar paginación
        updateParticipantsPagination(page, data.totalPages, data.totalItems, searchTerm);
    })
    .catch(error => {
        console.error('Error al cargar participantes:', error);
        showAlert('Error al cargar la lista de participantes', 'danger');
        const tableBody = document.getElementById('participants-body');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Error al cargar participantes</td></tr>';
        }
    });
}

// Función para actualizar la paginación de participantes
function updateParticipantsPagination(currentPage, totalPages, totalItems, searchTerm = '') {
    const pagination = document.getElementById('participants-pagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // Botón anterior
    paginationHTML += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Anterior">
                <span aria-hidden="true">&laquo;</span>
            </a>
        </li>
    `;
    
    // Mostrar solo un máximo de 5 páginas (con elipsis si es necesario)
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    // Ajustar si estamos cerca del final
    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    // Primera página si no se muestra
    if (startPage > 1) {
        paginationHTML += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="1">1</a>
            </li>
        `;
        
        if (startPage > 2) {
            paginationHTML += `
                <li class="page-item disabled">
                    <a class="page-link" href="#">...</a>
                </li>
            `;
        }
    }
    
    // Páginas numeradas
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>
        `;
    }
    
    // Última página si no se muestra
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `
                <li class="page-item disabled">
                    <a class="page-link" href="#">...</a>
                </li>
            `;
        }
        
        paginationHTML += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a>
            </li>
        `;
    }
    
    // Botón siguiente
    paginationHTML += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Siguiente">
                <span aria-hidden="true">&raquo;</span>
            </a>
        </li>
    `;
    
    pagination.innerHTML = paginationHTML;
    
    // Agregar eventos de clic a los enlaces de paginación
    pagination.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = parseInt(this.getAttribute('data-page'));
            
            if (!isNaN(page) && page !== currentPage) {
                loadParticipants(page, searchTerm);
            }
        });
    });
}

// Función para cargar organizaciones en el select
function loadOrganizationsForSelect(selectId = 'event-organization') {
    fetch(`${API_BASE_URL}/organizations`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return response.json();
    })
    .then(organizations => {
        const select = document.getElementById(selectId);
        
        // Mantener la primera opción
        const firstOption = select.options[0];
        select.innerHTML = '';
        select.appendChild(firstOption);
        
        // Agregar opciones de organizaciones
        if (organizations && organizations.length > 0) {
            organizations.forEach(org => {
                if (org.active) { // Solo incluir organizaciones activas
                    const option = document.createElement('option');
                    option.value = org.id;
                    option.textContent = org.name;
                    select.appendChild(option);
                }
            });
        }
    })
    .catch(error => {
        console.error('Error al cargar organizaciones para el select:', error);
        showAlert('Error al cargar la lista de organizaciones', 'warning');
    });
}

// Función para editar un participante
function editParticipant(participantId) {
    fetch(`${API_BASE_URL}/participants/${participantId}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return response.json();
    })
    .then(participant => {
        // Cargar organizaciones para el select
        loadOrganizationsForSelect('participant-organization');
        
        // Llenar formulario con datos del participante
        document.getElementById('participant-id').value = participant.id;
        document.getElementById('participant-nac').value = participant.nac || 'V';
        document.getElementById('participant-cedula').value = participant.cedula || '';
        document.getElementById('participant-firstName').value = participant.firstName || '';
        document.getElementById('participant-lastName').value = participant.lastName || '';
        document.getElementById('participant-telegramId').value = participant.telegramId || '';
        document.getElementById('participant-email').value = participant.email || '';
        document.getElementById('participant-phone').value = participant.phone || '';
        document.getElementById('participant-rol').value = participant.rol || 'user';
        
        // Establecer organización seleccionada (con un pequeño retraso para asegurar que las opciones estén cargadas)
        setTimeout(() => {
            const orgSelect = document.getElementById('participant-organization');
            if (participant.organization_id) {
                for (let i = 0; i < orgSelect.options.length; i++) {
                    if (orgSelect.options[i].value == participant.organization_id) {
                        orgSelect.selectedIndex = i;
                        break;
                    }
                }
            }
        }, 300);
        
        // Actualizar título del modal
        document.getElementById('participantModalLabel').textContent = 'Editar Participante';
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('participantModal'));
        modal.show();
    })
    .catch(error => {
        console.error('Error al cargar datos del participante:', error);
        showAlert('Error al cargar datos del participante', 'danger');
    });
}

// Función para guardar un participante (nuevo o existente)
function saveParticipant() {
    // Obtener datos del formulario
    const participantId = document.getElementById('participant-id').value;
    const participantData = {
        nac: document.getElementById('participant-nac').value,
        cedula: document.getElementById('participant-cedula').value,
        firstName: document.getElementById('participant-firstName').value,
        lastName: document.getElementById('participant-lastName').value,
        telegramId: document.getElementById('participant-telegramId').value,
        email: document.getElementById('participant-email').value,
        phone: document.getElementById('participant-phone').value,
        organization_id: document.getElementById('participant-organization').value || null,
        rol: document.getElementById('participant-rol').value
    };
    
    // Validar datos
    if (!participantData.cedula) {
        showAlert('La cédula del participante es obligatoria', 'warning');
        return;
    }
    
    if (!participantData.firstName) {
        showAlert('El nombre del participante es obligatorio', 'warning');
        return;
    }
    
    if (!participantData.lastName) {
        showAlert('El apellido del participante es obligatorio', 'warning');
        return;
    }
    
    // URL y método según si es creación o edición
    const url = participantId ? `${API_BASE_URL}/participants/${participantId}` : `${API_BASE_URL}/participants`;
    const method = participantId ? 'PUT' : 'POST';
    
    // Enviar petición
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify(participantData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Error al guardar el participante');
            });
        }
        return response.json();
    })
    .then(data => {
        // Cerrar modal
        bootstrap.Modal.getInstance(document.getElementById('participantModal')).hide();
        
        // Mostrar mensaje de éxito
        showAlert(
            participantId ? 'Participante actualizado correctamente' : 'Participante creado correctamente',
            'success'
        );
        
        // Recargar lista de participantes
        loadParticipants();
    })
    .catch(error => {
        console.error('Error al guardar participante:', error);
        showAlert(error.message || 'Error al guardar el participante', 'danger');
    });
}

// Función para eliminar un participante
function deleteParticipant(participantId) {
    // Confirmar antes de eliminar
    if (!confirm('¿Está seguro de que desea eliminar este participante? Esta acción no se puede deshacer.')) {
        return;
    }
    
    fetch(`${API_BASE_URL}/participants/${participantId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al eliminar el participante');
        }
        return response.json();
    })
    .then(data => {
        showAlert('Participante eliminado correctamente', 'success');
        loadParticipants(); // Recargar lista
    })
    .catch(error => {
        console.error('Error al eliminar participante:', error);
        showAlert('Error al eliminar el participante. Es posible que tenga asistencias registradas.', 'danger');
    });
}

// Función para ver asistencias de un participante
function viewParticipantAttendance(participantId) {
    // Cambiar a la pestaña de asistencias y filtrar por el participante seleccionado
    showSection('attendance');
    
    // Aquí implementaremos después la función para filtrar asistencias por participante
    // Por ahora, solo mostraremos un mensaje
    showAlert(`Mostrando asistencias para el participante ID: ${participantId}`, 'info');
    
    // La función loadParticipantAttendances se implementará cuando desarrollemos la pestaña de asistencias
}

// Función para importar participantes desde CSV
function importParticipants() {
    const fileInput = document.getElementById('import-file');
    const hasHeader = document.getElementById('import-has-header').checked;
    const updateExisting = document.getElementById('import-update-existing').checked;
    const defaultOrgId = document.getElementById('import-organization').value;
    
    if (!fileInput.files || fileInput.files.length === 0) {
        showAlert('Debe seleccionar un archivo CSV', 'warning');
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const csvData = e.target.result;
        
        // Enviar al servidor para procesamiento
        fetch(`${API_BASE_URL}/participants/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            },
            body: JSON.stringify({
                csvData,
                hasHeader,
                updateExisting,
                defaultOrgId: defaultOrgId || null
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || 'Error al importar participantes');
                });
            }
            return response.json();
        })
        .then(result => {
            // Cerrar modal
            bootstrap.Modal.getInstance(document.getElementById('importParticipantsModal')).hide();
            
            // Mostrar resultado
            showAlert(`
                Importación completada: ${result.created} creados, 
                ${result.updated} actualizados, ${result.failed} fallidos
            `, 'success');
            
            // Recargar lista de participantes
            loadParticipants();
        })
        .catch(error => {
            console.error('Error al importar participantes:', error);
            showAlert(error.message || 'Error al importar participantes', 'danger');
        });
    };
    
    reader.onerror = function() {
        showAlert('Error al leer el archivo', 'danger');
    };
    
    reader.readAsText(file);
}

// Función para cargar datos de asistencias
function loadAttendanceData() {
    // Cargar lista de asistencias
    loadAttendances();
    
    // Cargar resumen por evento
    loadAttendanceSummary();
    
    // Cargar eventos para el filtro
    loadEventsForSelect('attendance-event-filter');
}

// Función para cargar asistencias con paginación
function loadAttendances(page = 1, searchTerm = '') {
    const limit = 10; // Elementos por página
    const eventId = document.getElementById('attendance-event-filter').value;
    
    // Construir URL con parámetros
    let url = `${API_BASE_URL}/attendances?page=${page}&limit=${limit}`;
    if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
    }
    if (eventId) {
        url += `&eventId=${eventId}`;
    }
    
    fetch(url, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        const attendances = data.attendances || [];
        const totalAttendances = data.total || 0;
        const totalPages = data.totalPages || 1;
        
        const tableBody = document.getElementById('attendances-body');
        tableBody.innerHTML = '';
        
        if (attendances.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center">No hay asistencias registradas</td></tr>';
            // Ocultar paginación
            document.getElementById('attendances-pagination').innerHTML = '';
            return;
        }
        
        // Mostrar asistencias
        attendances.forEach(attendance => {
            const row = document.createElement('tr');
            
            // Formatear fecha
            const regDate = new Date(attendance.registeredAt);
            const formattedDate = regDate.toLocaleDateString() + ' ' + regDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            // Formatear ubicación
            let locationText = 'N/A';
            if (attendance.latitude && attendance.longitude) {
                locationText = `${attendance.latitude.toFixed(4)}, ${attendance.longitude.toFixed(4)}`;
            }
            
            // Formatear método
            let methodText = 'Manual';
            switch(attendance.method) {
                case 'bot': methodText = 'Bot Telegram'; break;
                case 'qr': methodText = 'Escaneo QR'; break;
                case 'location': methodText = 'Ubicación'; break;
            }
            
            // Formatear estado
            let statusBadge = 'bg-success';
            let statusText = 'Confirmada';
            switch(attendance.status) {
                case 'pending': 
                    statusBadge = 'bg-warning'; 
                    statusText = 'Pendiente'; 
                    break;
                case 'rejected': 
                    statusBadge = 'bg-danger'; 
                    statusText = 'Rechazada'; 
                    break;
            }
            
            row.innerHTML = `
                <td>${attendance.id}</td>
                <td>${attendance.Participante ? (attendance.Participante.firstName + ' ' + attendance.Participante.lastName) : 'N/A'}</td>
                <td>${attendance.Evento ? attendance.Evento.name : 'N/A'}</td>
                <td>${formattedDate}</td>
                <td>${methodText}</td>
                <td>${locationText}</td>
                <td>
                    <span class="badge ${statusBadge}">
                        ${statusText}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary edit-attendance-btn" data-id="${attendance.id}">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-danger delete-attendance-btn" data-id="${attendance.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                    <button class="btn btn-sm btn-info view-attendance-btn" data-id="${attendance.id}">
                        <i class="bi bi-eye"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        // Configurar eventos para botones de acciones
        document.querySelectorAll('.edit-attendance-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const attendanceId = this.getAttribute('data-id');
                editAttendance(attendanceId);
            });
        });
        
        document.querySelectorAll('.delete-attendance-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const attendanceId = this.getAttribute('data-id');
                deleteAttendance(attendanceId);
            });
        });
        
        document.querySelectorAll('.view-attendance-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const attendanceId = this.getAttribute('data-id');
                viewAttendanceDetails(attendanceId);
            });
        });
        
        // Actualizar paginación
        updateAttendancesPagination(page, totalPages, totalAttendances, searchTerm, eventId);
    })
    .catch(error => {
        console.error('Error al cargar asistencias:', error);
        showAlert('Error al cargar la lista de asistencias', 'danger');
        const tableBody = document.getElementById('attendances-body');
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center">Error al cargar asistencias</td></tr>';
    });
}

// Función para actualizar la paginación de asistencias
function updateAttendancesPagination(currentPage, totalPages, totalItems, searchTerm = '', eventId = '') {
    const pagination = document.getElementById('attendances-pagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // Botón anterior
    paginationHTML += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Anterior">
                <span aria-hidden="true">&laquo;</span>
            </a>
        </li>
    `;
    
    // Mostrar solo un máximo de 5 páginas (con elipsis si es necesario)
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    // Ajustar si estamos cerca del final
    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    // Primera página si no se muestra
    if (startPage > 1) {
        paginationHTML += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="1">1</a>
            </li>
        `;
        
        if (startPage > 2) {
            paginationHTML += `
                <li class="page-item disabled">
                    <a class="page-link" href="#">...</a>
                </li>
            `;
        }
    }
    
    // Páginas numeradas
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>
        `;
    }
    
    // Última página si no se muestra
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `
                <li class="page-item disabled">
                    <a class="page-link" href="#">...</a>
                </li>
            `;
        }
        
        paginationHTML += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a>
            </li>
        `;
    }
    
    // Botón siguiente
    paginationHTML += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Siguiente">
                <span aria-hidden="true">&raquo;</span>
            </a>
        </li>
    `;
    
    pagination.innerHTML = paginationHTML;
    
    // Agregar eventos de clic a los enlaces de paginación
    pagination.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = parseInt(this.getAttribute('data-page'));
            
            if (!isNaN(page) && page !== currentPage) {
                loadAttendances(page, searchTerm, eventId);
            }
        });
    });
}

// Función para cargar resumen de asistencias por evento
function loadAttendanceSummary() {
    fetch(`${API_BASE_URL}/attendances/summary`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        const tableBody = document.getElementById('attendance-summary-body');
        
        // Verificar si el elemento existe
        if (!tableBody) {
            console.error('Error: No se encontró el elemento con ID "attendance-summary-body"');
            showAlert('Error al cargar resumen de asistencias: Elemento contenedor no encontrado', 'danger');
            return;
        }
        
        tableBody.innerHTML = '';
        
        if (!data || data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No hay datos de asistencia</td></tr>';
            return;
        }
        
        data.forEach(item => {
            const row = document.createElement('tr');
            
            // Calcular porcentaje
            const percentage = item.expected_count > 0 
                ? ((item.confirmed_count / item.expected_count) * 100).toFixed(1) 
                : 0;
            
            // Formatear fecha
            const eventDate = new Date(item.event_date);
            const formattedDate = eventDate.toLocaleDateString();
            
            row.innerHTML = `
                <td>${item.event_name}</td>
                <td>${formattedDate}</td>
                <td>${item.total_count}</td>
                <td>${item.confirmed_count}</td>
                <td>${item.pending_count}</td>
                <td>
                    <div class="progress">
                        <div class="progress-bar" role="progressbar" style="width: ${percentage}%" 
                            aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">
                            ${percentage}%
                        </div>
                    </div>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary view-event-attendances-btn" data-id="${item.event_id}">
                        <i class="bi bi-list-check"></i>
                    </button>
                    <button class="btn btn-sm btn-success export-event-btn" data-id="${item.event_id}">
                        <i class="bi bi-file-earmark-arrow-down"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        // Configurar eventos para botones
        document.querySelectorAll('.view-event-attendances-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const eventId = this.getAttribute('data-id');
                // Establecer filtro y cargar asistencias
                document.getElementById('attendance-event-filter').value = eventId;
                loadAttendances();
            });
        });
        
        document.querySelectorAll('.export-event-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const eventId = this.getAttribute('data-id');
                // Abrir modal de exportación con evento preseleccionado
                document.getElementById('export-attendance-form').reset();
                
                // Cargar eventos y preseleccionar
                loadEventsForSelect('export-event').then(() => {
                    document.getElementById('export-event').value = eventId;
                });
                
                // Establecer fechas predeterminadas (último mes)
                const today = new Date();
                const lastMonth = new Date();
                lastMonth.setMonth(lastMonth.getMonth() - 1);
                
                document.getElementById('export-date-start').value = lastMonth.toISOString().split('T')[0];
                document.getElementById('export-date-end').value = today.toISOString().split('T')[0];
                
                // Mostrar modal
                const modal = new bootstrap.Modal(document.getElementById('exportAttendanceModal'));
                modal.show();
            });
        });
    })
    .catch(error => {
        console.error('Error al cargar resumen de asistencias:', error);
        showAlert('Error al cargar el resumen de asistencias por evento', 'danger');
        
        // Verificar si el elemento existe antes de intentar manipularlo
        const tableBody = document.getElementById('attendance-summary-body');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Error al cargar datos</td></tr>';
        }
    });
}

// Función para cargar participantes en un select
function loadParticipantsForSelect(selectId = 'attendance-participant') {
    fetch(`${API_BASE_URL}/participants?limit=1000`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        const participants = data.participants || [];
        const select = document.getElementById(selectId);
        
        // Mantener la primera opción
        const firstOption = select.options[0];
        select.innerHTML = '';
        select.appendChild(firstOption);
        
        // Agregar opciones de participantes
        if (participants.length > 0) {
            participants.forEach(participant => {
                const option = document.createElement('option');
                option.value = participant.id;
                option.textContent = `${participant.nac}-${participant.cedula}: ${participant.firstName} ${participant.lastName}`;
                select.appendChild(option);
            });
        }
        
        return participants.length;
    })
    .catch(error => {
        console.error('Error al cargar participantes para el select:', error);
        showAlert('Error al cargar la lista de participantes', 'warning');
    });
}

// Función para cargar eventos en un select
function loadEventsForSelect(selectId = 'attendance-event') {
    return fetch(`${API_BASE_URL}/events`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return response.json();
    })
    .then(events => {
        const select = document.getElementById(selectId);
        
        // Mantener la primera opción
        const firstOption = select.options[0];
        select.innerHTML = '';
        select.appendChild(firstOption);
        
        // Agregar opciones de eventos
        if (events && events.length > 0) {
            events.forEach(event => {
                const option = document.createElement('option');
                option.value = event.id;
                
                // Formatear fecha
                const eventDate = new Date(event.date);
                const formattedDate = eventDate.toLocaleDateString();
                
                option.textContent = `${event.name} (${formattedDate})`;
                select.appendChild(option);
            });
        }
        
        return events.length;
    })
    .catch(error => {
        console.error('Error al cargar eventos para el select:', error);
        showAlert('Error al cargar la lista de eventos', 'warning');
        return 0;
    });
}

// Función para editar una asistencia
function editAttendance(attendanceId) {
    fetch(`${API_BASE_URL}/attendances/${attendanceId}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return response.json();
    })
    .then(attendance => {
        // Cargar selectores
        Promise.all([
            loadParticipantsForSelect(),
            loadEventsForSelect()
        ]).then(() => {
            // Llenar formulario con datos
            document.getElementById('attendance-id').value = attendance.id;
            
            // Formatear fecha para el input datetime-local
            const attendanceDate = new Date(attendance.registeredAt);
            attendanceDate.setMinutes(attendanceDate.getMinutes() - attendanceDate.getTimezoneOffset());
            const formattedDate = attendanceDate.toISOString().slice(0, 16);
            document.getElementById('attendance-date').value = formattedDate;
            
            // Establecer método
            document.getElementById('attendance-method').value = attendance.method || 'manual';
            
            // Establecer estado
            document.getElementById('attendance-status').value = attendance.status || 'confirmed';
            
            // Establecer ubicación
            let locationValue = '';
            if (attendance.latitude && attendance.longitude) {
                locationValue = `${attendance.latitude}, ${attendance.longitude}`;
            }
            document.getElementById('attendance-location').value = locationValue;
            
            // Establecer notas
            document.getElementById('attendance-notes').value = attendance.notes || '';
            
            // Seleccionar participante y evento
            const participantSelect = document.getElementById('attendance-participant');
            const eventSelect = document.getElementById('attendance-event');
            
            if (attendance.participant_id) {
                for (let i = 0; i < participantSelect.options.length; i++) {
                    if (participantSelect.options[i].value == attendance.participant_id) {
                        participantSelect.selectedIndex = i;
                        break;
                    }
                }
            }
            
            if (attendance.eventid) {
                for (let i = 0; i < eventSelect.options.length; i++) {
                    if (eventSelect.options[i].value == attendance.eventid) {
                        eventSelect.selectedIndex = i;
                        break;
                    }
                }
            }
            
            // Actualizar título del modal
            document.getElementById('attendanceModalLabel').textContent = 'Editar Asistencia';
            
            // Mostrar modal
            const modal = new bootstrap.Modal(document.getElementById('attendanceModal'));
            modal.show();
        });
    })
    .catch(error => {
        console.error('Error al cargar datos de la asistencia:', error);
        showAlert('Error al cargar datos de la asistencia', 'danger');
    });
}

// Función para guardar una asistencia (nueva o existente)
function saveAttendance() {
    // Obtener datos del formulario
    const attendanceId = document.getElementById('attendance-id').value;
    
    // Procesar ubicación (latitud, longitud)
    const locationInput = document.getElementById('attendance-location').value;
    let latitude = null;
    let longitude = null;
    
    if (locationInput) {
        const locationParts = locationInput.split(',').map(part => parseFloat(part.trim()));
        if (locationParts.length === 2 && !isNaN(locationParts[0]) && !isNaN(locationParts[1])) {
            latitude = locationParts[0];
            longitude = locationParts[1];
        }
    }
    
    const attendanceData = {
        participant_id: document.getElementById('attendance-participant').value,
        eventid: document.getElementById('attendance-event').value,
        registeredAt: document.getElementById('attendance-date').value,
        method: document.getElementById('attendance-method').value,
        status: document.getElementById('attendance-status').value,
        latitude: latitude,
        longitude: longitude,
        notes: document.getElementById('attendance-notes').value
    };
    
    // Validar datos
    if (!attendanceData.participant_id) {
        showAlert('Debe seleccionar un participante', 'warning');
        return;
    }
    
    if (!attendanceData.eventid) {
        showAlert('Debe seleccionar un evento', 'warning');
        return;
    }
    
    if (!attendanceData.registeredAt) {
        showAlert('La fecha de registro es obligatoria', 'warning');
        return;
    }
    
    // URL y método según si es creación o edición
    const url = attendanceId ? `${API_BASE_URL}/attendances/${attendanceId}` : `${API_BASE_URL}/attendances`;
    const method = attendanceId ? 'PUT' : 'POST';
    
    // Enviar petición
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify(attendanceData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Error al guardar la asistencia');
            });
        }
        return response.json();
    })
    .then(data => {
        // Cerrar modal
        bootstrap.Modal.getInstance(document.getElementById('attendanceModal')).hide();
        
        // Mostrar mensaje de éxito
        showAlert(
            attendanceId ? 'Asistencia actualizada correctamente' : 'Asistencia registrada correctamente',
            'success'
        );
        
        // Recargar datos
        loadAttendanceData();
    })
    .catch(error => {
        console.error('Error al guardar asistencia:', error);
        showAlert(error.message || 'Error al guardar la asistencia', 'danger');
    });
}

// Función para eliminar una asistencia
function deleteAttendance(attendanceId) {
    // Confirmar antes de eliminar
    if (!confirm('¿Está seguro de que desea eliminar este registro de asistencia? Esta acción no se puede deshacer.')) {
        return;
    }
    
    fetch(`${API_BASE_URL}/attendances/${attendanceId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al eliminar la asistencia');
        }
        return response.json();
    })
    .then(data => {
        showAlert('Registro de asistencia eliminado correctamente', 'success');
        loadAttendanceData(); // Recargar datos
    })
    .catch(error => {
        console.error('Error al eliminar asistencia:', error);
        showAlert('Error al eliminar el registro de asistencia', 'danger');
    });
}

// Función para ver detalles de una asistencia
function viewAttendanceDetails(attendanceId) {
    fetch(`${API_BASE_URL}/attendances/${attendanceId}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return response.json();
    })
    .then(attendance => {
        // Llenar datos del participante
        const participantName = attendance.Participante ? 
            `${attendance.Participante.firstName} ${attendance.Participante.lastName}` : 'N/A';
        const participantCedula = attendance.Participante ? 
            `${attendance.Participante.nac}-${attendance.Participante.cedula}` : 'N/A';
        const participantOrg = attendance.Participante && attendance.Participante.Organizacion ? 
            attendance.Participante.Organizacion.name : 'N/A';
        const participantTelegram = attendance.Participante && attendance.Participante.telegramId ? 
            attendance.Participante.telegramId : 'N/A';
        
        document.getElementById('view-participant-name').textContent = participantName;
        document.getElementById('view-participant-cedula').textContent = participantCedula;
        document.getElementById('view-participant-organization').textContent = participantOrg;
        document.getElementById('view-participant-telegram').textContent = participantTelegram;
        
        // Llenar datos del evento
        const eventName = attendance.Evento ? attendance.Evento.name : 'N/A';
        const eventDate = attendance.Evento ? 
            new Date(attendance.Evento.date).toLocaleString() : 'N/A';
        const eventLocation = attendance.Evento && attendance.Evento.location ? 
            attendance.Evento.location : 'N/A';
        const eventOrg = attendance.Evento && attendance.Evento.Organizacion ? 
            attendance.Evento.Organizacion.name : 'N/A';
        
        document.getElementById('view-event-name').textContent = eventName;
        document.getElementById('view-event-date').textContent = eventDate;
        document.getElementById('view-event-location').textContent = eventLocation;
        document.getElementById('view-event-organization').textContent = eventOrg;
        
        // Llenar datos de la asistencia
        const attendanceDate = new Date(attendance.registeredAt).toLocaleString();
        
        let methodText = 'Manual';
        switch(attendance.method) {
            case 'bot': methodText = 'Bot Telegram'; break;
            case 'qr': methodText = 'Escaneo QR'; break;
            case 'location': methodText = 'Ubicación'; break;
        }
        
        let statusText = 'Confirmada';
        let statusClass = 'text-success';
        switch(attendance.status) {
            case 'pending': 
                statusText = 'Pendiente'; 
                statusClass = 'text-warning';
                break;
            case 'rejected': 
                statusText = 'Rechazada'; 
                statusClass = 'text-danger';
                break;
        }
        
        document.getElementById('view-attendance-date').textContent = attendanceDate;
        document.getElementById('view-attendance-method').textContent = methodText;
        document.getElementById('view-attendance-status').innerHTML = `<span class="${statusClass}">${statusText}</span>`;
        document.getElementById('view-attendance-notes').textContent = attendance.notes || 'Sin notas';
        
        // Manejar ubicación
        if (attendance.latitude && attendance.longitude) {
            // Aquí podríamos integrar un mapa si es necesario
            document.getElementById('view-attendance-map-placeholder').innerHTML = `
                <p class="mb-2">Coordenadas: ${attendance.latitude}, ${attendance.longitude}</p>
                <a href="https://maps.google.com/?q=${attendance.latitude},${attendance.longitude}" 
                   target="_blank" class="btn btn-sm btn-outline-primary">
                    Ver en Google Maps
                </a>
            `;
        } else {
            document.getElementById('view-attendance-map-placeholder').innerHTML = `
                <i class="bi bi-geo-alt" style="font-size: 2rem;"></i>
                <p class="mt-2">No hay datos de ubicación</p>
            `;
        }
        
        // Configurar botón de edición
        document.getElementById('edit-from-view-btn').setAttribute('data-id', attendance.id);
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('viewAttendanceModal'));
        modal.show();
    })
    .catch(error => {
        console.error('Error al cargar detalles de la asistencia:', error);
        showAlert('Error al cargar detalles de la asistencia', 'danger');
    });
}

// Función para exportar asistencias
function exportAttendances() {
    const eventId = document.getElementById('export-event').value;
    const dateStart = document.getElementById('export-date-start').value;
    const dateEnd = document.getElementById('export-date-end').value;
    const format = document.querySelector('input[name="export-format"]:checked').value;
    const includeDetails = document.getElementById('export-include-details').checked;
    
    // Validar fechas
    if (!dateStart || !dateEnd) {
        showAlert('Debe seleccionar un rango de fechas', 'warning');
        return;
    }
    
    // Construir URL con parámetros
    let url = `${API_BASE_URL}/attendances/export?format=${format}`;
    
    if (eventId) {
        url += `&eventId=${eventId}`;
    }
    
    if (dateStart) {
        url += `&dateStart=${dateStart}`;
    }
    
    if (dateEnd) {
        url += `&dateEnd=${dateEnd}`;
    }
    
    if (includeDetails) {
        url += `&includeDetails=1`;
    }
    
    // Añadir token de autenticación como parámetro para la descarga
    const token = localStorage.getItem('adminToken');
    url += `&token=${token}`;
    
    // Cerrar modal
    bootstrap.Modal.getInstance(document.getElementById('exportAttendanceModal')).hide();
    
    // Abrir nueva ventana con la URL de descarga
    window.open(url, '_blank');
    
    showAlert('Exportación iniciada. Si no comienza la descarga, verifique el bloqueador de ventanas emergentes.', 'info');
}

// Función para cargar desempeño de notificaciones por evento
function loadNotificationPerformance() {
  // Intentar cargar desde el endpoint de prueba primero
  fetch(`${API_BASE_URL}/notifications/stats/test`)
    .then(response => {
      if (!response.ok) {
        // Si falla, intentar con el endpoint autenticado
        return fetch(`${API_BASE_URL}/notifications/stats/`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
          }
        });
      }
      return response;
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      return response.json();
    })
    .then(stats => {
      if (!stats || stats.length === 0) {
        console.log('No hay estadísticas de notificaciones disponibles');
        return;
      }
      
      // Crear datos para el gráfico
      const labels = stats.map(s => s.notification_type || 'custom');
      const sentData = stats.map(s => s.sent_count || 0);
      const deliveredData = stats.map(s => s.delivered_count || 0);
      const readData = stats.map(s => s.read_count || 0);
      
      // Configurar el gráfico
      const ctx = document.getElementById('notification-performance-chart').getContext('2d');
      
      // Destruir gráfico anterior si existe
      if (window.notificationPerformanceChart instanceof Chart) {
        window.notificationPerformanceChart.destroy();
      }
      
      // Crear nuevo gráfico
      window.notificationPerformanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Enviadas',
              data: sentData,
              backgroundColor: 'rgba(54, 162, 235, 0.5)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 1
            },
            {
              label: 'Entregadas',
              data: deliveredData,
              backgroundColor: 'rgba(75, 192, 192, 0.5)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1
            },
            {
              label: 'Leídas',
              data: readData,
              backgroundColor: 'rgba(255, 206, 86, 0.5)',
              borderColor: 'rgba(255, 206, 86, 1)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    })
    .catch(error => {
      console.error('Error al cargar estadísticas de notificaciones:', error);
    });
}

// Función para ver estadísticas de una notificación
function viewNotificationStats(notificationId) {
    fetch(`${API_BASE_URL}/notifications/${notificationId}/stats`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Llenar datos de la notificación
        document.getElementById('notification-stats-title').textContent = 
            `Detalles de la notificación #${data.id}`;
        
        // Formatear tipo de notificación
        let typeText = 'Mensaje personalizado';
        switch(data.type) {
            case 'event_reminder': typeText = 'Recordatorio de evento'; break;
            case 'attendance_confirmation': typeText = 'Confirmación de asistencia'; break;
            case 'event_update': typeText = 'Actualización de evento'; break;
            case 'event_cancellation': typeText = 'Cancelación de evento'; break;
        }
        
        // Formatear estado
        let statusText = 'Pendiente';
        let statusClass = 'text-info';
        switch(data.status) {
            case 'sent': 
                statusText = 'Enviada'; 
                statusClass = 'text-success';
                break;
            case 'failed': 
                statusText = 'Fallida'; 
                statusClass = 'text-danger';
                break;
            case 'cancelled': 
                statusText = 'Cancelada'; 
                statusClass = 'text-secondary';
                break;
        }
        
        // Formatear fecha
        const scheduledDate = new Date(data.scheduled_date);
        const formattedDate = scheduledDate.toLocaleDateString() + ' ' + 
            scheduledDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        // Actualizar información en la tabla
        document.getElementById('stats-notification-type').textContent = typeText;
        document.getElementById('stats-notification-event').textContent = 
            data.event ? data.event.name : 'N/A';
        document.getElementById('stats-notification-scheduled').textContent = formattedDate;
        document.getElementById('stats-notification-status').innerHTML = 
            `<span class="${statusClass}">${statusText}</span>`;
        
        // Actualizar barras de progreso
        const totalRecipients = data.stats.total || 0;
        
        if (totalRecipients > 0) {
            const sentPercent = Math.round((data.stats.sent / totalRecipients) * 100);
            const failedPercent = Math.round((data.stats.failed / totalRecipients) * 100);
            const readPercent = Math.round((data.stats.read / totalRecipients) * 100);
            const deliveredPercent = Math.round((data.stats.delivered / totalRecipients) * 100) - readPercent;
            const pendingPercent = 100 - sentPercent - failedPercent;
            
            document.getElementById('progress-sent').style.width = `${sentPercent}%`;
            document.getElementById('progress-sent').textContent = `Enviados: ${sentPercent}%`;
            document.getElementById('progress-sent').setAttribute('aria-valuenow', sentPercent);
            
            document.getElementById('progress-failed').style.width = `${failedPercent}%`;
            document.getElementById('progress-failed').textContent = `Fallidos: ${failedPercent}%`;
            document.getElementById('progress-failed').setAttribute('aria-valuenow', failedPercent);
            
            document.getElementById('progress-read').style.width = `${readPercent}%`;
            document.getElementById('progress-read').textContent = `Leídos: ${readPercent}%`;
            document.getElementById('progress-read').setAttribute('aria-valuenow', readPercent);
            
            document.getElementById('progress-delivered').style.width = `${deliveredPercent}%`;
            document.getElementById('progress-delivered').textContent = `Entregados: ${deliveredPercent}%`;
            document.getElementById('progress-delivered').setAttribute('aria-valuenow', deliveredPercent);
            
            document.getElementById('progress-pending').style.width = `${pendingPercent}%`;
            document.getElementById('progress-pending').textContent = `Pendientes: ${pendingPercent}%`;
            document.getElementById('progress-pending').setAttribute('aria-valuenow', pendingPercent);
        } else {
            // Sin destinatarios, mostrar barras vacías
            document.getElementById('progress-sent').style.width = '0%';
            document.getElementById('progress-failed').style.width = '0%';
            document.getElementById('progress-read').style.width = '0%';
            document.getElementById('progress-delivered').style.width = '0%';
            document.getElementById('progress-pending').style.width = '100%';
        }
        
        // Crear gráfico de detalles
        createNotificationDetailChart(data.stats);
        
        // Mostrar lista de destinatarios
        const recipientsTableBody = document.getElementById('notification-recipients-body');
        recipientsTableBody.innerHTML = '';
        
        if (data.recipients && data.recipients.length > 0) {
            data.recipients.forEach(recipient => {
                const row = document.createElement('tr');
                
                // Formatear estado
                let recipientStatusText = 'Pendiente';
                let recipientStatusClass = 'text-secondary';
                
                if (recipient.status === 'failed') {
                    recipientStatusText = 'Fallido';
                    recipientStatusClass = 'text-danger';
                } else if (recipient.status === 'sent') {
                    if (recipient.read) {
                        recipientStatusText = 'Leído';
                        recipientStatusClass = 'text-success';
                    } else if (recipient.delivered) {
                        recipientStatusText = 'Entregado';
                        recipientStatusClass = 'text-info';
                    } else {
                        recipientStatusText = 'Enviado';
                        recipientStatusClass = 'text-primary';
                    }
                }
                
                // Formatear fechas
                const sentDate = recipient.sent_at ? 
                    new Date(recipient.sent_at).toLocaleString() : 'N/A';
                const deliveredDate = recipient.delivered_at ? 
                    new Date(recipient.delivered_at).toLocaleString() : 'N/A';
                const readDate = recipient.read_at ? 
                    new Date(recipient.read_at).toLocaleString() : 'N/A';
                
                row.innerHTML = `
                    <td>${recipient.participant_name || recipient.telegram_id || 'N/A'}</td>
                    <td><span class="${recipientStatusClass}">${recipientStatusText}</span></td>
                    <td>${sentDate}</td>
                    <td>${deliveredDate}</td>
                    <td>${readDate}</td>
                    <td>${recipient.response || 'Sin respuesta'}</td>
                `;
                recipientsTableBody.appendChild(row);
            });
        } else {
            recipientsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No hay datos de destinatarios</td></tr>';
        }
        
        // Configurar botón de reenvío
        const resendButton = document.getElementById('resend-notification-btn');
        resendButton.setAttribute('data-id', notificationId);
        
        // Habilitar/deshabilitar botón de reenvío según el estado
        if (data.status === 'sent' || data.status === 'failed') {
            resendButton.removeAttribute('disabled');
        } else {
            resendButton.setAttribute('disabled', 'disabled');
        }
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('notificationStatsModal'));
        modal.show();
    })
    .catch(error => {
        console.error('Error al obtener estadísticas:', error);
        showAlert('Error al cargar estadísticas de la notificación', 'danger');
    });
}

// Función para crear gráfico detallado de una notificación
function createNotificationDetailChart(stats) {
    const ctx = document.getElementById('notification-detail-chart').getContext('2d');
    
    // Destruir gráfico anterior si existe
    if (window.notificationDetailChart instanceof Chart) {
        window.notificationDetailChart.destroy();
    }
    
    // Datos para el gráfico
    const chartData = {
        labels: ['Enviados', 'Entregados', 'Leídos', 'Respondidos', 'Fallidos'],
        datasets: [{
            data: [
                stats.sent || 0,
                stats.delivered || 0,
                stats.read || 0,
                stats.responded || 0,
                stats.failed || 0
            ],
            backgroundColor: [
                'rgba(54, 162, 235, 0.6)',
                'rgba(75, 192, 192, 0.6)',
                'rgba(255, 206, 86, 0.6)',
                'rgba(255, 99, 132, 0.6)',
                'rgba(201, 203, 207, 0.6)'
            ],
            borderColor: [
                'rgba(54, 162, 235, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(255, 99, 132, 1)',
                'rgba(201, 203, 207, 1)'
            ],
            borderWidth: 1
        }]
    };
    
    // Crear gráfico
    window.notificationDetailChart = new Chart(ctx, {
        type: 'doughnut',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                }
            }
        }
    });
}

// Función para editar una notificación
function editNotification(notificationId) {
    fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return response.json();
    })
    .then(notification => {
        // Cargar selectores
        Promise.all([
            loadEventsForSelect('notification-event'),
            loadOrganizationsForSelect('notification-organization')
        ]).then(() => {
            // Llenar formulario con datos
            document.getElementById('notification-id').value = notification.id;
            document.getElementById('notification-type').value = notification.type || 'custom_message';
            document.getElementById('notification-message').value = notification.message || '';
            document.getElementById('notification-include-buttons').checked = notification.include_buttons;
            
            // Formatear fecha y hora
            const scheduledDate = new Date(notification.scheduled_at);
            const dateStr = scheduledDate.toISOString().split('T')[0];
            
            // Formatear hora (HH:MM)
            const hours = String(scheduledDate.getHours()).padStart(2, '0');
            const minutes = String(scheduledDate.getMinutes()).padStart(2, '0');
            const timeStr = `${hours}:${minutes}`;
            
            document.getElementById('notification-schedule-date').value = dateStr;
            document.getElementById('notification-schedule-time').value = timeStr;
            
            // Establecer destinatarios
            const recipientType = notification.recipient_type || 'all';
            document.getElementById(`recipients-${recipientType}`).checked = true;
            
            // Mostrar/ocultar selectores según tipo de destinatario
            if (recipientType === 'organization') {
                document.getElementById('organization-selector').classList.remove('d-none');
                document.getElementById('participants-selector').classList.add('d-none');
                
                // Seleccionar organización
                if (notification.organization_id) {
                    document.getElementById('notification-organization').value = notification.organization_id;
                }
            } else if (recipientType === 'custom') {
                document.getElementById('participants-selector').classList.remove('d-none');
                document.getElementById('organization-selector').classList.add('d-none');
                
                // Cargar participantes y seleccionar los indicados
                loadParticipantsForSelect('notification-participants').then(() => {
                    if (notification.participant_ids && notification.participant_ids.length > 0) {
                        const select = document.getElementById('notification-participants');
                        for (let i = 0; i < select.options.length; i++) {
                            if (notification.participant_ids.includes(parseInt(select.options[i].value))) {
                                select.options[i].selected = true;
                            }
                        }
                    }
                });
            } else {
                // Ocultar ambos selectores para 'all'
                document.getElementById('organization-selector').classList.add('d-none');
                document.getElementById('participants-selector').classList.add('d-none');
            }
            
            // Seleccionar evento
            if (notification.event_id) {
                document.getElementById('notification-event').value = notification.event_id;
            }
            
            // Actualizar título del modal
            document.getElementById('notificationModalLabel').textContent = 'Editar Notificación';
            
            // Mostrar modal
            const modal = new bootstrap.Modal(document.getElementById('notificationModal'));
            modal.show();
        });
    })
    .catch(error => {
        console.error('Error al cargar datos de la notificación:', error);
        showAlert('Error al cargar datos de la notificación', 'danger');
    });
}

// Función para eliminar una notificación
function deleteNotification(notificationId) {
    // Confirmar antes de eliminar
    if (!confirm('¿Está seguro de que desea eliminar esta notificación? Esta acción no se puede deshacer.')) {
        return;
    }
    
    fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al eliminar la notificación');
        }
        return response.json();
    })
    .then(data => {
        showAlert('Notificación eliminada correctamente', 'success');
        loadNotificationsData(); // Recargar datos
    })
    .catch(error => {
        console.error('Error al eliminar notificación:', error);
        showAlert('Error al eliminar la notificación. Es posible que ya haya sido enviada.', 'danger');
    });
}

// Función para cargar participantes en un select múltiple
function loadParticipantsForSelect(selectId = 'notification-participants') {
    return fetch(`${API_BASE_URL}/participants?limit=1000`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        const participants = data.participants || [];
        const select = document.getElementById(selectId);
        
        // Limpiar opciones actuales
        select.innerHTML = '';
        
        // Agregar opciones de participantes
        if (participants.length > 0) {
            participants.forEach(participant => {
                // Solo incluir participantes con ID de Telegram
                if (participant.telegramId) {
                    const option = document.createElement('option');
                    option.value = participant.id;
                    option.textContent = `${participant.nac}-${participant.cedula}: ${participant.firstName} ${participant.lastName}`;
                    select.appendChild(option);
                }
            });
            
            if (select.options.length === 0) {
                const option = document.createElement('option');
                option.value = "";
                option.textContent = "No hay participantes con ID de Telegram";
                option.disabled = true;
                select.appendChild(option);
            }
        } else {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No hay participantes disponibles";
            option.disabled = true;
            select.appendChild(option);
        }
        
        return participants.length;
    })
    .catch(error => {
        console.error('Error al cargar participantes para el select:', error);
        showAlert('Error al cargar la lista de participantes', 'warning');
        return 0;
    });
}

// Función para configurar eventos para la sección de notificaciones
function setupNotificationsHandlers() {
    // Modal de nueva notificación
    document.getElementById('add-notification-btn')?.addEventListener('click', function() {
        // Limpiar formulario
        document.getElementById('notification-form').reset();
        document.getElementById('notification-id').value = '';
        document.getElementById('notificationModalLabel').textContent = 'Nueva Notificación';
        
        // Establecer fecha y hora predeterminadas (mañana a las 9:00 AM)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        
        document.getElementById('notification-schedule-date').value = tomorrow.toISOString().split('T')[0];
        document.getElementById('notification-schedule-time').value = '09:00';
        
        // Cargar selectores
        loadEventsForSelect('notification-event');
        loadOrganizationsForSelect('notification-organization');
        
        // Ocultar selectores de destinatarios
        document.getElementById('organization-selector').classList.add('d-none');
        document.getElementById('participants-selector').classList.add('d-none');
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('notificationModal'));
        modal.show();
    });
    
    // Cambio en tipo de destinatarios
    document.querySelectorAll('input[name="notification-recipients"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const recipientType = this.value;
            
            if (recipientType === 'organization') {
                document.getElementById('organization-selector').classList.remove('d-none');
                document.getElementById('participants-selector').classList.add('d-none');
            } else if (recipientType === 'custom') {
                document.getElementById('participants-selector').classList.remove('d-none');
                document.getElementById('organization-selector').classList.add('d-none');
                
                // Cargar participantes si no se han cargado
                if (document.getElementById('notification-participants').options.length === 0) {
                    loadParticipantsForSelect('notification-participants');
                }
            } else {
                // Tipo 'all'
                document.getElementById('organization-selector').classList.add('d-none');
                document.getElementById('participants-selector').classList.add('d-none');
            }
        });
    });
    
    // Guardar notificación
    document.getElementById('save-notification-btn')?.addEventListener('click', function() {
        saveNotification();
    });
    
    // Previsualizar notificación
    document.getElementById('preview-notification-btn')?.addEventListener('click', function() {
        previewNotification();
    });
    
    // Reenviar notificación a destinatarios fallidos
    document.getElementById('resend-notification-btn')?.addEventListener('click', function() {
        const notificationId = this.getAttribute('data-id');
        resendNotification(notificationId);
    });
    
    // Filtros de notificaciones
    document.querySelectorAll('.dropdown-menu [data-filter]').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const filter = this.getAttribute('data-filter');
            document.getElementById('notification-filter-dropdown').textContent = this.textContent;
            loadNotifications(1, document.getElementById('notification-search').value, filter);
        });
    });
    
    // Búsqueda de notificaciones
    document.getElementById('notification-search')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const filter = document.querySelector('.dropdown-menu [data-filter].active')?.getAttribute('data-filter') || 'all';
            loadNotifications(1, this.value, filter);
        }
    });
}

// Función para guardar una notificación (nueva o existente)
function saveNotification() {
    // Obtener datos del formulario
    const notificationId = document.getElementById('notification-id').value;
    
    // Obtener fecha y hora de programación
    const scheduleDate = document.getElementById('notification-schedule-date').value;
    const scheduleTime = document.getElementById('notification-schedule-time').value;
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
    
    // Obtener tipo de destinatarios
    const recipientType = document.querySelector('input[name="notification-recipients"]:checked').value;
    
    // Preparar datos según tipo de destinatarios
    let recipientData = {};
    if (recipientType === 'organization') {
        recipientData.organization_id = document.getElementById('notification-organization').value;
        
        if (!recipientData.organization_id) {
            showAlert('Debe seleccionar una organización', 'warning');
            return;
        }
    } else if (recipientType === 'custom') {
        const select = document.getElementById('notification-participants');
        const selectedOptions = Array.from(select.selectedOptions).map(option => parseInt(option.value));
        
        if (selectedOptions.length === 0) {
            showAlert('Debe seleccionar al menos un participante', 'warning');
            return;
        }
        
        recipientData.participant_ids = selectedOptions;
    }
    
    const notificationData = {
        type: document.getElementById('notification-type').value,
        message: document.getElementById('notification-message').value,
        event_id: document.getElementById('notification-event').value || null,
        scheduled_at: scheduledAt.toISOString(),
        recipient_type: recipientType,
        include_buttons: document.getElementById('notification-include-buttons').checked,
        ...recipientData
    };
    
    // Validar datos
    if (!notificationData.type) {
        showAlert('Debe seleccionar un tipo de notificación', 'warning');
        return;
    }
    
    if (!notificationData.message) {
        showAlert('El mensaje de la notificación es obligatorio', 'warning');
        return;
    }
    
    if (notificationData.type !== 'custom_message' && !notificationData.event_id) {
        showAlert('Debe seleccionar un evento para este tipo de notificación', 'warning');
        return;
    }
    
    // URL y método según si es creación o edición
    const url = notificationId ? `${API_BASE_URL}/notifications/${notificationId}` : `${API_BASE_URL}/notifications`;
    const method = notificationId ? 'PUT' : 'POST';
    
    // Enviar petición
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify(notificationData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Error al guardar la notificación');
            });
        }
        return response.json();
    })
    .then(data => {
        // Cerrar modal
        bootstrap.Modal.getInstance(document.getElementById('notificationModal')).hide();
        
        // Mostrar mensaje de éxito
        showAlert(
            notificationId ? 'Notificación actualizada correctamente' : 'Notificación programada correctamente',
            'success'
        );
        
        // Recargar datos
        loadNotificationsData();
    })
    .catch(error => {
        console.error('Error al guardar notificación:', error);
        showAlert(error.message || 'Error al guardar la notificación', 'danger');
    });
}

// Función para previsualizar notificación
function previewNotification() {
    // Obtener datos del formulario
    const message = document.getElementById('notification-message').value;
    const includeButtons = document.getElementById('notification-include-buttons').checked;
    const eventId = document.getElementById('notification-event').value;
    
    // Validar que haya un mensaje
    if (!message) {
        showAlert('Debe ingresar un mensaje para previsualizar', 'warning');
        return;
    }
    
    // Obtener datos del evento si está seleccionado
    if (eventId) {
        fetch(`${API_BASE_URL}/events/${eventId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        })
        .then(response => response.json())
        .then(event => {
            // Reemplazar variables en el mensaje
            const date = new Date(event.date);
            const formattedDate = date.toLocaleDateString();
            const formattedTime = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            let previewText = message
                .replace(/{evento}/g, event.name)
                .replace(/{fecha}/g, formattedDate)
                .replace(/{hora}/g, formattedTime)
                .replace(/{ubicacion}/g, event.location || 'N/A')
                .replace(/{nombre}/g, 'Juan Pérez'); // Nombre de ejemplo
            
            // Mostrar mensaje en la vista previa
            document.getElementById('preview-message').textContent = previewText;
            
            // Agregar botones si está habilitado
            if (includeButtons) {
                document.getElementById('preview-buttons').innerHTML = `
                    <div class="d-flex justify-content-between">
                        <button class="btn btn-sm btn-success me-1" style="flex: 1;">✅ Asistiré</button>
                        <button class="btn btn-sm btn-danger" style="flex: 1;">❌ No asistiré</button>
                    </div>
                `;
            } else {
                document.getElementById('preview-buttons').innerHTML = '';
            }
            
            // Mostrar modal de vista previa
            const modal = new bootstrap.Modal(document.getElementById('previewModal'));
            modal.show();
        })
        .catch(error => {
            console.error('Error al obtener datos del evento:', error);
            
            // Mostrar vista previa sin datos de evento
            const previewText = message
                .replace(/{evento}/g, '[Nombre del Evento]')
                .replace(/{fecha}/g, '[Fecha]')
                .replace(/{hora}/g, '[Hora]')
                .replace(/{ubicacion}/g, '[Ubicación]')
                .replace(/{nombre}/g, 'Juan Pérez');
            
            document.getElementById('preview-message').textContent = previewText;
            
            if (includeButtons) {
                document.getElementById('preview-buttons').innerHTML = `
                    <div class="d-flex justify-content-between">
                        <button class="btn btn-sm btn-success me-1" style="flex: 1;">✅ Asistiré</button>
                        <button class="btn btn-sm btn-danger" style="flex: 1;">❌ No asistiré</button>
                    </div>
                `;
            } else {
                document.getElementById('preview-buttons').innerHTML = '';
            }
            
            const modal = new bootstrap.Modal(document.getElementById('previewModal'));
            modal.show();
        });
    } else {
        // Sin evento, mostrar vista previa básica
        const previewText = message
            .replace(/{evento}/g, '[Nombre del Evento]')
            .replace(/{fecha}/g, '[Fecha]')
            .replace(/{hora}/g, '[Hora]')
            .replace(/{ubicacion}/g, '[Ubicación]')
            .replace(/{nombre}/g, 'Juan Pérez');
        
        document.getElementById('preview-message').textContent = previewText;
        
        if (includeButtons) {
            document.getElementById('preview-buttons').innerHTML = `
                <div class="d-flex justify-content-between">
                    <button class="btn btn-sm btn-success me-1" style="flex: 1;">✅ Asistiré</button>
                    <button class="btn btn-sm btn-danger" style="flex: 1;">❌ No asistiré</button>
                </div>
            `;
        } else {
            document.getElementById('preview-buttons').innerHTML = '';
        }
        
        const modal = new bootstrap.Modal(document.getElementById('previewModal'));
        modal.show();
    }
}

// Función para reenviar notificación a destinatarios fallidos
function resendNotification(notificationId) {
    // Confirmar antes de reenviar
    if (!confirm('¿Está seguro de que desea reenviar esta notificación a los destinatarios con envío fallido?')) {
        return;
    }
    
    fetch(`${API_BASE_URL}/notifications/${notificationId}/resend`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al reenviar la notificación');
        }
        return response.json();
    })
    .then(data => {
        // Cerrar modal de estadísticas
        bootstrap.Modal.getInstance(document.getElementById('notificationStatsModal')).hide();
        
        showAlert(`Notificación reenviada a ${data.resenCount || 0} destinatarios`, 'success');
        loadNotificationsData(); // Recargar datos
    })
    .catch(error => {
        console.error('Error al reenviar notificación:', error);
        showAlert('Error al reenviar la notificación', 'danger');
    });
}

// Función para cargar datos de notificaciones
function loadNotificationsData() {
  showLoadingOverlay('Cargando datos de notificaciones...');
  
  // Cargar listado de notificaciones
  fetch(`${API_BASE_URL}/notifications`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    const notificationsTable = document.getElementById('notifications-body');
    
    if (!notificationsTable) {
      console.error('Error: No se encontró el elemento con ID "notifications-body"');
      throw new Error('Elemento HTML no encontrado: notifications-body');
    }
    
    notificationsTable.innerHTML = '';
    
    if (data.items && data.items.length > 0) {
      data.items.forEach(notification => {
        const row = document.createElement('tr');
        
        // Formatear tipo de notificación
        let typeText = 'Mensaje personalizado';
        switch(notification.notification_type) {
          case 'event_reminder': typeText = 'Recordatorio de evento'; break;
          case 'attendance_confirmation': typeText = 'Confirmación de asistencia'; break;
          case 'event_update': typeText = 'Actualización de evento'; break;
          case 'event_cancellation': typeText = 'Cancelación de evento'; break;
        }
        
        // Formatear estado
        let statusText = 'Pendiente';
        let statusClass = 'text-info';
        switch(notification.status) {
          case 'sent': 
            statusText = 'Enviada'; 
            statusClass = 'text-success';
            break;
          case 'failed': 
            statusText = 'Fallida'; 
            statusClass = 'text-danger';
            break;
          case 'cancelled': 
            statusText = 'Cancelada'; 
            statusClass = 'text-secondary';
            break;
        }
        
        // Formatear fecha
        const scheduledDate = new Date(notification.scheduled_date);
        const formattedDate = scheduledDate.toLocaleDateString() + ' ' + 
          scheduledDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        row.innerHTML = `
          <td headers="notif-col-id">${notification.id}</td>
          <td headers="notif-col-event">${notification.event_name || 'N/A'}</td>
          <td headers="notif-col-type">${typeText}</td>
          <td headers="notif-col-scheduled">${formattedDate}</td>
          <td headers="notif-col-status"><span class="${statusClass}">${statusText}</span></td>
          <td headers="notif-col-actions">
            <button class="btn btn-sm btn-info view-notification-stats" data-id="${notification.id}" title="Ver estadísticas" aria-label="Ver estadísticas de notificación #${notification.id}">
              <i class="bi bi-bar-chart" aria-hidden="true"></i>
              <span class="visually-hidden">Ver estadísticas</span>
            </button>
            <button class="btn btn-sm btn-primary edit-notification" data-id="${notification.id}" title="Editar" aria-label="Editar notificación #${notification.id}">
              <i class="bi bi-pencil" aria-hidden="true"></i>
              <span class="visually-hidden">Editar</span>
            </button>
            <button class="btn btn-sm btn-danger delete-notification" data-id="${notification.id}" title="Eliminar" aria-label="Eliminar notificación #${notification.id}">
              <i class="bi bi-trash" aria-hidden="true"></i>
              <span class="visually-hidden">Eliminar</span>
            </button>
          </td>
        `;
        
        notificationsTable.appendChild(row);
      });
    } else {
      notificationsTable.innerHTML = '<tr><td colspan="6" class="text-center">No hay notificaciones programadas</td></tr>';
    }
    
    // Configurar eventos para los botones
    document.querySelectorAll('.view-notification-stats').forEach(btn => {
      btn.addEventListener('click', function() {
        const notificationId = this.getAttribute('data-id');
        viewNotificationStats(notificationId);
      });
    });
    
    document.querySelectorAll('.edit-notification').forEach(btn => {
      btn.addEventListener('click', function() {
        const notificationId = this.getAttribute('data-id');
        editNotification(notificationId);
      });
    });
    
    document.querySelectorAll('.delete-notification').forEach(btn => {
      btn.addEventListener('click', function() {
        const notificationId = this.getAttribute('data-id');
        deleteNotification(notificationId);
      });
    });
    
    // Cargar estadísticas generales
    loadNotificationPerformance();
    
    hideLoadingOverlay();
  })
  .catch(error => {
    console.error('Error al cargar notificaciones:', error);
    showAlert('Error al cargar datos de notificaciones', 'danger');
    hideLoadingOverlay();
  });
}

// Función para cargar datos de reportes
function loadReportsData() {
    // Cargar lista de organizaciones para los filtros
    loadOrganizationsForSelect('report-organization');
    
    // Cargar lista de eventos para los filtros
    loadEventsForSelect('report-event');
    
    // Configurar fechas predeterminadas
    setDefaultDateRange();
    
    // Agregar eventos a los botones de generación de reportes
    document.querySelectorAll('.generate-report').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const reportType = this.getAttribute('data-type');
            showReportConfigModal(reportType);
        });
    });
    
    // Agregar evento al botón de generación de reporte en el modal
    document.getElementById('generate-report-btn').addEventListener('click', function() {
        const reportType = document.getElementById('report-type').value;
        generateReport(reportType);
    });
}

// Función para mostrar el modal de configuración de reportes
function showReportConfigModal(reportType) {
    // Establecer el tipo de reporte
    document.getElementById('report-type').value = reportType;
    
    // Reiniciar el formulario
    document.getElementById('report-config-form').reset();
    
    // Ocultar todos los campos de parámetros
    document.querySelectorAll('.param-field').forEach(field => {
        field.style.display = 'none';
    });
    
    // Mostrar campos según el tipo de reporte
    switch(reportType) {
        case 'events-summary':
            document.getElementById('organization-param').style.display = 'block';
            document.getElementById('date-range-param').style.display = 'block';
            loadOrganizationsForSelect('report-organization');
            break;
            
        case 'event-attendance-detail':
            document.getElementById('event-param').style.display = 'block';
            loadEventsForSelect('report-event');
            break;
            
        case 'events-by-organization':
            document.getElementById('organization-param').style.display = 'block';
            loadOrganizationsForSelect('report-organization');
            break;
            
        case 'participants-by-organization':
            document.getElementById('organization-param').style.display = 'block';
            loadOrganizationsForSelect('report-organization');
            break;
            
        case 'participant-activity':
            // No se necesitan filtros específicos, pero podría agregarse un selector de participante
            break;
            
        case 'participants-without-telegram':
            document.getElementById('organization-param').style.display = 'block';
            loadOrganizationsForSelect('report-organization');
            break;
            
        case 'attendance-summary':
            document.getElementById('organization-param').style.display = 'block';
            document.getElementById('date-range-param').style.display = 'block';
            loadOrganizationsForSelect('report-organization');
            break;
            
        case 'attendance-by-date':
            document.getElementById('date-range-param').style.display = 'block';
            // Establecer fechas predeterminadas (último mes)
            setDefaultDateRange();
            break;
            
        case 'attendance-method-analysis':
            document.getElementById('date-range-param').style.display = 'block';
            setDefaultDateRange();
            break;
            
        case 'notification-effectiveness':
            document.getElementById('date-range-param').style.display = 'block';
            document.getElementById('event-param').style.display = 'block';
            loadEventsForSelect('report-event');
            setDefaultDateRange();
            break;
            
        case 'notification-response-time':
            document.getElementById('date-range-param').style.display = 'block';
            setDefaultDateRange();
            break;
            
        case 'failed-notifications':
            document.getElementById('date-range-param').style.display = 'block';
            setDefaultDateRange();
            break;
    }
    
    // Configurar botón de generación
    const generateBtn = document.getElementById('generate-report-btn');
    generateBtn.onclick = function() {
        generateReport(reportType);
    };
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('reportConfigModal'));
    modal.show();
}

// Función para establecer un rango de fechas predeterminado (último mes)
function setDefaultDateRange() {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    document.getElementById('report-date-start').value = lastMonth.toISOString().split('T')[0];
    document.getElementById('report-date-end').value = today.toISOString().split('T')[0];
}

// Función para generar el reporte solicitado
function generateReport(reportType) {
    // Recopilar parámetros del formulario
    const params = {
        type: reportType,
        format: document.querySelector('input[name="report-format"]:checked').value,
        includeCharts: document.getElementById('include-charts').checked
    };
    
    // Añadir parámetros específicos según los campos visibles
    if (document.getElementById('organization-param').style.display !== 'none') {
        params.organizationId = document.getElementById('report-organization').value;
    }
    
    if (document.getElementById('event-param').style.display !== 'none') {
        params.eventId = document.getElementById('report-event').value;
    }
    
    if (document.getElementById('date-range-param').style.display !== 'none') {
        params.dateStart = document.getElementById('report-date-start').value;
        params.dateEnd = document.getElementById('report-date-end').value;
    }
    
    // Validar parámetros requeridos según el tipo de reporte
    if (reportType === 'event-attendance-detail' && !params.eventId) {
        showAlert('Debe seleccionar un evento para este reporte', 'warning');
        return;
    }
    
    // Construir URL para la descarga
    let url = `${API_BASE_URL}/reports?type=${params.type}&format=${params.format}`;
    
    if (params.organizationId) {
        url += `&organizationId=${params.organizationId}`;
    }
    
    if (params.eventId) {
        url += `&eventId=${params.eventId}`;
    }
    
    if (params.dateStart) {
        url += `&dateStart=${params.dateStart}`;
    }
    
    if (params.dateEnd) {
        url += `&dateEnd=${params.dateEnd}`;
    }
    
    if (params.includeCharts) {
        url += `&includeCharts=1`;
    }
    
    // Añadir token de autenticación
    const token = localStorage.getItem('adminToken');
    url += `&token=${token}`;
    
    // Cerrar modal
    bootstrap.Modal.getInstance(document.getElementById('reportConfigModal')).hide();
    
    // Mostrar mensaje de generación
    showAlert('Generando reporte, espere un momento...', 'info');
    
    // Iniciar descarga
    window.open(url, '_blank');
}

// Función para cargar datos de configuración
function loadSettingsData() {
    showLoadingOverlay('Cargando configuración...');
    
    // Utilizar Promise.all para ejecutar todas las peticiones en paralelo
    Promise.allSettled([
        loadGeneralSettings(),
        loadBotSettings(),
        loadNotificationSettings(),
        loadAdmins(),
        loadBackups()
    ])
    .then(results => {
        // Verificar si alguna promesa falló
        const failures = results.filter(result => result.status === 'rejected');
        if (failures.length > 0) {
            console.error('Algunas peticiones fallaron:', failures);
            showToast('Algunos datos de configuración no pudieron cargarse', 'warning');
        }
        
        hideLoadingOverlay();
    })
    .catch(error => {
        console.error('Error al cargar configuración:', error);
        showToast('Error al cargar configuración', 'error');
        hideLoadingOverlay();
    });
    
    // Configurar eventos para los botones y formularios
    setupSettingsEventListeners();
}

// Cargar ajustes generales
function loadGeneralSettings() {
    return fetch('/api/settings/general', {
        headers: {
            'Authorization': `Bearer ${getToken()}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al cargar ajustes generales');
        }
        return response.json();
    })
    .then(data => {
        // Si data no es un objeto, manejar el error
        if (!data || typeof data !== 'object') {
            console.error('Error: Los datos recibidos no tienen el formato esperado', data);
            return;
        }
        
        // Llenar formulario con datos
        document.getElementById('system-name').value = data.systemName || '';
        document.getElementById('system-admin-email').value = data.adminEmail || '';
        document.getElementById('timezone').value = data.timezone || 'America/Caracas';
        document.getElementById('date-format').value = data.dateFormat || 'DD/MM/YYYY';
        document.getElementById('maintenance-mode').checked = data.maintenanceMode || false;
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error al cargar ajustes generales', 'error');
        throw error; // Repropagar el error para que Promise.all lo detecte
    });
}

// Cargar configuración del bot
function loadBotSettings() {
    return fetch('/api/settings/bot', {
        headers: {
            'Authorization': `Bearer ${getToken()}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al cargar configuración del bot');
        }
        return response.json();
    })
    .then(data => {
        // Llenar formulario con datos
        document.getElementById('bot-token').value = data.botToken || '';
        document.getElementById('bot-username').value = data.botUsername || '';
        document.getElementById('welcome-message').value = data.welcomeMessage || '';
        document.getElementById('require-registration').checked = data.requireRegistration || false;
        document.getElementById('use-webhook').checked = data.useWebhook !== false; // Por defecto true
        
        // Configurar visibilidad del token
        document.getElementById('toggle-token-btn').addEventListener('click', function() {
            const tokenInput = document.getElementById('bot-token');
            const eyeIcon = this.querySelector('i');
            
            if (tokenInput.type === 'password') {
                tokenInput.type = 'text';
                eyeIcon.classList.remove('bi-eye');
                eyeIcon.classList.add('bi-eye-slash');
            } else {
                tokenInput.type = 'password';
                eyeIcon.classList.remove('bi-eye-slash');
                eyeIcon.classList.add('bi-eye');
            }
        });
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error al cargar configuración del bot', 'error');
        throw error; // Repropagar el error para que Promise.all lo detecte
    });
}

// Cargar configuración de notificaciones
function loadNotificationSettings() {
    return fetch('/api/settings/notifications', {
        headers: {
            'Authorization': `Bearer ${getToken()}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al cargar configuración de notificaciones');
        }
        return response.json();
    })
    .then(data => {
        // Llenar formulario con datos
        document.getElementById('default-reminder-time').value = data.defaultReminderTime || 24;
        document.getElementById('notification-limit').value = data.notificationLimit || 100;
        document.getElementById('send-error-notifications').checked = data.sendErrorNotifications !== false; // Por defecto true
        document.getElementById('auto-retry-failed').checked = data.autoRetryFailed !== false; // Por defecto true
        document.getElementById('use-scheduled-notifications').checked = data.useScheduledNotifications !== false; // Por defecto true
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error al cargar configuración de notificaciones', 'error');
        throw error; // Repropagar el error para que Promise.all lo detecte
    });
}

// Cargar administradores
function loadAdmins() {
    return fetch('/api/settings/admins', {
        headers: {
            'Authorization': `Bearer ${getToken()}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al cargar administradores');
        }
        return response.json();
    })
    .then(data => {
        const tableBody = document.getElementById('admins-table-body');
        if (!tableBody) {
            console.error('Error: No se encontró el elemento con ID "admins-table-body"');
            return;
        }
        
        tableBody.innerHTML = '';
        
        // Si recibimos un objeto de configuración en lugar de un array
        if (!Array.isArray(data)) {
            console.log('Datos recibidos en formato de configuración:', data);
            
            // Mostrar los datos de configuración en la tabla
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="4" class="text-left">
                    <div class="alert alert-info mb-0">
                        <h5>Configuración de Administradores</h5>
                        <ul class="mb-0">
                            <li>Aprobación de admin requerida: ${data.admin_approval ? 'Sí' : 'No'}</li>
                            <li>Permitir registro: ${data.allow_register ? 'Sí' : 'No'}</li>
                            <li>Tiempo de sesión: ${data.session_timeout || 60} minutos</li>
                        </ul>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
            
            // Si hay un array de admins dentro del objeto, usarlo
            if (data.admins && Array.isArray(data.admins)) {
                displayAdminsList(data.admins, tableBody);
            } else {
                // Añadir fila de "no hay administradores"
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = `<td colspan="4" class="text-center">No hay administradores registrados</td>`;
                tableBody.appendChild(emptyRow);
            }
            return;
        }
        
        // Si es un array vacío
        if (data.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="4" class="text-center">No hay administradores registrados</td>`;
            tableBody.appendChild(row);
            return;
        }
        
        // Si tenemos un array con elementos, mostrarlos
        displayAdminsList(data, tableBody);
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error al cargar administradores', 'error');
        throw error; // Repropagar el error para que Promise.all lo detecte
    });
}

// Función auxiliar para mostrar la lista de administradores
function displayAdminsList(admins, tableBody) {
    // Llenar tabla con datos
    admins.forEach(admin => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${admin.name}</td>
            <td>${admin.telegramId}</td>
            <td>${getAdminTypeLabel(admin.type)}</td>
            <td>
                <button class="btn btn-sm btn-primary edit-admin-btn" data-id="${admin.id}">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-danger delete-admin-btn" data-id="${admin.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    
    // Configurar eventos para botones de edición y eliminación
    document.querySelectorAll('.edit-admin-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const adminId = this.getAttribute('data-id');
            openAdminModal(adminId);
        });
    });
    
    document.querySelectorAll('.delete-admin-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const adminId = this.getAttribute('data-id');
            if (confirm('¿Está seguro que desea eliminar este administrador?')) {
                deleteAdmin(adminId);
            }
        });
    });
}

// Obtener etiqueta de tipo de administrador
function getAdminTypeLabel(type) {
    switch (type) {
        case 'super':
            return '<span class="badge bg-danger">Super Admin</span>';
        case 'admin':
            return '<span class="badge bg-primary">Administrador</span>';
        case 'operator':
            return '<span class="badge bg-success">Operador</span>';
        default:
            return '<span class="badge bg-secondary">Desconocido</span>';
    }
}

// Cargar respaldos
function loadBackups() {
    return fetch('/api/settings/backups', {
        headers: {
            'Authorization': `Bearer ${getToken()}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al cargar respaldos');
        }
        return response.json();
    })
    .then(data => {
        const tableBody = document.getElementById('backups-table-body');
        if (!tableBody) {
            console.error('Error: No se encontró el elemento con ID "backups-table-body"');
            return;
        }
        
        tableBody.innerHTML = '';
        
        // Si recibimos un objeto de configuración en lugar de un array
        if (!Array.isArray(data)) {
            console.log('Datos recibidos en formato de configuración:', data);
            
            // Mostrar los datos de configuración en la tabla
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="4" class="text-left">
                    <div class="alert alert-info mb-0">
                        <h5>Configuración de Respaldos</h5>
                        <ul class="mb-0">
                            <li>Respaldos automáticos: ${data.backup_enabled ? 'Activados' : 'Desactivados'}</li>
                            <li>Frecuencia: Cada ${data.backup_frequency || 7} días</li>
                            <li>Retención: ${data.backup_retention || 30} días</li>
                        </ul>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
            
            // Si hay un array de backups dentro del objeto, usarlo
            if (data.backups && Array.isArray(data.backups)) {
                displayBackupsList(data.backups, tableBody);
            } else {
                // Añadir fila de "no hay respaldos"
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = `<td colspan="4" class="text-center">No hay respaldos disponibles</td>`;
                tableBody.appendChild(emptyRow);
            }
            return;
        }
        
        // Si es un array vacío
        if (data.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="4" class="text-center">No hay respaldos disponibles</td>`;
            tableBody.appendChild(row);
            return;
        }
        
        // Si tenemos un array con elementos, mostrarlos
        displayBackupsList(data, tableBody);
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error al cargar respaldos', 'error');
        throw error; // Repropagar el error para que Promise.all lo detecte
    });
}

// Función auxiliar para mostrar la lista de respaldos
function displayBackupsList(backups, tableBody) {
    // Llenar tabla con datos
    backups.forEach(backup => {
        const row = document.createElement('tr');
        const date = new Date(backup.createdAt);
        
        row.innerHTML = `
            <td>${date.toLocaleString()}</td>
            <td>${formatFileSize(backup.size)}</td>
            <td>${backup.createdBy}</td>
            <td>
                <button class="btn btn-sm btn-success download-backup-btn" data-id="${backup.id}">
                    <i class="bi bi-download"></i>
                </button>
                <button class="btn btn-sm btn-warning restore-backup-btn" data-id="${backup.id}">
                    <i class="bi bi-arrow-counterclockwise"></i>
                </button>
                <button class="btn btn-sm btn-danger delete-backup-btn" data-id="${backup.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    
    // Configurar eventos para botones
    document.querySelectorAll('.download-backup-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const backupId = this.getAttribute('data-id');
            downloadBackup(backupId);
        });
    });
    
    document.querySelectorAll('.restore-backup-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const backupId = this.getAttribute('data-id');
            if (confirm('¿Está seguro que desea restaurar este respaldo?')) {
                restoreBackup(backupId);
            }
        });
    });
    
    document.querySelectorAll('.delete-backup-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const backupId = this.getAttribute('data-id');
            if (confirm('¿Está seguro que desea eliminar este respaldo?')) {
                deleteBackup(backupId);
            }
        });
    });
}

// Formatear tamaño de archivo
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Configurar eventos para botones y formularios
function setupSettingsEventListeners() {
    // Guardar todos los ajustes
    document.getElementById('save-all-settings-btn').addEventListener('click', function() {
        saveGeneralSettings();
        saveBotSettings();
        saveNotificationSettings();
    });
    
    // Guardar ajustes generales
    document.getElementById('save-general-settings-btn').addEventListener('click', saveGeneralSettings);
    
    // Guardar configuración del bot
    document.getElementById('save-bot-settings-btn').addEventListener('click', saveBotSettings);
    
    // Guardar configuración de notificaciones
    document.getElementById('save-notification-settings-btn').addEventListener('click', saveNotificationSettings);
    
    // Abrir modal para añadir administrador
    document.getElementById('add-admin-btn').addEventListener('click', function() {
        openAdminModal();
    });
    
    // Guardar administrador
    document.getElementById('save-admin-btn').addEventListener('click', saveAdmin);
    
    // Crear respaldo
    document.getElementById('create-backup-btn').addEventListener('click', createBackup);
    
    // Restaurar respaldo
    document.getElementById('restore-backup-btn').addEventListener('click', restoreBackup);
    
    // Cambiar tipo de administrador
    document.getElementById('admin-type').addEventListener('change', function() {
        const organizationField = document.getElementById('admin-organization').parentElement;
        if (this.value === 'operator') {
            organizationField.classList.remove('d-none');
        } else {
            organizationField.classList.add('d-none');
        }
    });
}

// Guardar ajustes generales
function saveGeneralSettings() {
    const settings = {
        systemName: document.getElementById('system-name').value,
        adminEmail: document.getElementById('system-admin-email').value,
        timezone: document.getElementById('timezone').value,
        dateFormat: document.getElementById('date-format').value,
        maintenanceMode: document.getElementById('maintenance-mode').checked
    };
    
    fetch('/api/settings/general', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(settings)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al guardar ajustes generales');
        }
        return response.json();
    })
    .then(data => {
        showToast('Ajustes generales guardados correctamente');
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error al guardar ajustes generales', 'error');
    });
}

// Guardar configuración del bot
function saveBotSettings() {
    const settings = {
        botToken: document.getElementById('bot-token').value,
        botUsername: document.getElementById('bot-username').value,
        welcomeMessage: document.getElementById('welcome-message').value,
        requireRegistration: document.getElementById('require-registration').checked,
        useWebhook: document.getElementById('use-webhook').checked
    };
    
    fetch('/api/settings/bot', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(settings)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al guardar configuración del bot');
        }
        return response.json();
    })
    .then(data => {
        showToast('Configuración del bot guardada correctamente');
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error al guardar configuración del bot', 'error');
    });
}

// Guardar configuración de notificaciones
function saveNotificationSettings() {
    const settings = {
        defaultReminderTime: parseInt(document.getElementById('default-reminder-time').value),
        notificationLimit: parseInt(document.getElementById('notification-limit').value),
        sendErrorNotifications: document.getElementById('send-error-notifications').checked,
        autoRetryFailed: document.getElementById('auto-retry-failed').checked,
        useScheduledNotifications: document.getElementById('use-scheduled-notifications').checked
    };
    
    fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(settings)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al guardar configuración de notificaciones');
        }
        return response.json();
    })
    .then(data => {
        showToast('Configuración de notificaciones guardada correctamente');
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error al guardar configuración de notificaciones', 'error');
    });
}

// Abrir modal para agregar o editar administrador
function openAdminModal(adminId = null) {
    // Limpiar formulario
    document.getElementById('admin-form').reset();
    document.getElementById('admin-id').value = '';
    
    // Cargar organizaciones para el selector
    loadOrganizationsForSelect();
    
    // Cambiar título y preparar para nuevo registro o edición
    const modalTitle = document.getElementById('adminModalLabel');
    
    if (adminId) {
        modalTitle.textContent = 'Editar Administrador';
        
        // Cargar datos del administrador
        fetch(`/api/settings/admins/${adminId}`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar datos del administrador');
            }
            return response.json();
        })
        .then(data => {
            document.getElementById('admin-id').value = data.id;
            document.getElementById('admin-name').value = data.name;
            document.getElementById('admin-telegram-id').value = data.telegramId;
            document.getElementById('admin-type').value = data.type;
            document.getElementById('admin-email').value = data.email || '';
            document.getElementById('admin-organization').value = data.organizationId || '';
            document.getElementById('admin-active').checked = data.active;
            
            // Actualizar visibilidad del campo de organización
            const organizationField = document.getElementById('admin-organization').parentElement;
            if (data.type === 'operator') {
                organizationField.classList.remove('d-none');
            } else {
                organizationField.classList.add('d-none');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Error al cargar datos del administrador', 'error');
        });
    } else {
        modalTitle.textContent = 'Nuevo Administrador';
        // El campo de organización inicia oculto para tipos 'super' y 'admin'
        document.getElementById('admin-organization').parentElement.classList.add('d-none');
    }
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('adminModal'));
    modal.show();
}

// Cargar organizaciones para el selector de administradores
function loadOrganizationsForSelect() {
    fetch('/api/organizations', {
        headers: {
            'Authorization': `Bearer ${getToken()}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al cargar organizaciones');
        }
        return response.json();
    })
    .then(data => {
        const select = document.getElementById('admin-organization');
        
        // Mantener la opción predeterminada
        const defaultOption = select.querySelector('option');
        select.innerHTML = '';
        select.appendChild(defaultOption);
        
        // Agregar opciones de organizaciones
        data.forEach(org => {
            const option = document.createElement('option');
            option.value = org.id;
            option.textContent = org.name;
            select.appendChild(option);
        });
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error al cargar organizaciones', 'error');
    });
}

// Guardar administrador
function saveAdmin() {
    // Validar formulario
    const form = document.getElementById('admin-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const adminId = document.getElementById('admin-id').value;
    const adminData = {
        name: document.getElementById('admin-name').value,
        telegramId: document.getElementById('admin-telegram-id').value,
        type: document.getElementById('admin-type').value,
        email: document.getElementById('admin-email').value,
        organizationId: document.getElementById('admin-type').value === 'operator' 
            ? document.getElementById('admin-organization').value 
            : null,
        active: document.getElementById('admin-active').checked
    };
    
    let url = '/api/settings/admins';
    let method = 'POST';
    
    if (adminId) {
        url = `/api/settings/admins/${adminId}`;
        method = 'PUT';
    }
    
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(adminData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al guardar administrador');
        }
        return response.json();
    })
    .then(data => {
        showToast('Administrador guardado correctamente');
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('adminModal'));
        modal.hide();
        
        // Recargar lista de administradores
        loadAdmins();
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error al guardar administrador', 'error');
    });
}

// Eliminar administrador
function deleteAdmin(adminId) {
    fetch(`/api/settings/admins/${adminId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${getToken()}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al eliminar administrador');
        }
        return response.json();
    })
    .then(data => {
        showToast('Administrador eliminado correctamente');
        loadAdmins();
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error al eliminar administrador', 'error');
    });
}

// Crear respaldo
function createBackup() {
    const includeAttachments = document.getElementById('include-attachments').checked;
    
    // Mostrar indicador de carga
    showLoadingOverlay('Creando respaldo...');
    
    fetch('/api/settings/backups', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ includeAttachments })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al crear respaldo');
        }
        return response.json();
    })
    .then(data => {
        hideLoadingOverlay();
        showToast('Respaldo creado correctamente');
        loadBackups();
        
        // Si se proporciona un enlace de descarga, ofrecer descargar
        if (data.downloadUrl) {
            if (confirm('¿Desea descargar el respaldo ahora?')) {
                window.location.href = data.downloadUrl + `?token=${getToken()}`;
            }
        }
    })
    .catch(error => {
        hideLoadingOverlay();
        console.error('Error:', error);
        showToast('Error al crear respaldo', 'error');
    });
}

// Descargar respaldo
function downloadBackup(backupId) {
    window.location.href = `/api/settings/backups/${backupId}/download?token=${getToken()}`;
}

// Eliminar respaldo
function deleteBackup(backupId) {
    fetch(`/api/settings/backups/${backupId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${getToken()}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al eliminar respaldo');
        }
        return response.json();
    })
    .then(data => {
        showToast('Respaldo eliminado correctamente');
        loadBackups();
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error al eliminar respaldo', 'error');
    });
}

// Restaurar sistema desde respaldo
function restoreBackup() {
    const fileInput = document.getElementById('backup-file');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        showToast('Debe seleccionar un archivo de respaldo', 'warning');
        return;
    }
    
    if (!confirm('¡ADVERTENCIA! Restaurar un respaldo sobrescribirá todos los datos actuales. Esta acción no se puede deshacer. ¿Está seguro de continuar?')) {
        return;
    }
    
    // Mostrar indicador de carga
    showLoadingOverlay('Restaurando sistema...');
    
    const formData = new FormData();
    formData.append('backupFile', fileInput.files[0]);
    
    fetch('/api/settings/backups/restore', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${getToken()}`
        },
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al restaurar sistema');
        }
        return response.json();
    })
    .then(data => {
        hideLoadingOverlay();
        showToast('Sistema restaurado correctamente. Se cerrará la sesión para aplicar los cambios.');
        
        // Cerrar sesión después de 3 segundos
        setTimeout(() => {
            logout();
        }, 3000);
    })
    .catch(error => {
        hideLoadingOverlay();
        console.error('Error:', error);
        showToast('Error al restaurar sistema: ' + error.message, 'error');
    });
}

// Función para mostrar el overlay de carga
function showLoadingOverlay(message = 'Cargando...') {
    // Verificar si el overlay ya existe
    let overlay = document.getElementById('loading-overlay');
    
    // Si no existe, crearlo
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '9999';
        
        const spinner = document.createElement('div');
        spinner.className = 'd-flex flex-column align-items-center';
        spinner.innerHTML = `
            <div class="spinner-border text-light mb-3" role="status" style="width: 3rem; height: 3rem;">
                <span class="visually-hidden">Cargando...</span>
            </div>
            <div class="text-light" id="loading-message">${message}</div>
        `;
        
        overlay.appendChild(spinner);
        document.body.appendChild(overlay);
    } else {
        // Si ya existe, actualizar el mensaje
        document.getElementById('loading-message').textContent = message;
        overlay.style.display = 'flex';
    }
}

// Función para ocultar el overlay de carga
function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Función para mostrar notificaciones tipo toast
function showToast(message, type = 'success') {
    // Crear contenedor de toasts si no existe
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Crear elemento toast
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    // Añadir colores según el tipo
    let bgColor, iconClass;
    switch (type) {
        case 'success':
            bgColor = 'bg-success text-white';
            iconClass = 'bi-check-circle-fill';
            break;
        case 'error':
            bgColor = 'bg-danger text-white';
            iconClass = 'bi-exclamation-circle-fill';
            break;
        case 'warning':
            bgColor = 'bg-warning text-dark';
            iconClass = 'bi-exclamation-triangle-fill';
            break;
        case 'info':
        default:
            bgColor = 'bg-info text-white';
            iconClass = 'bi-info-circle-fill';
            break;
    }
    
    // Construir HTML del toast
    toast.innerHTML = `
        <div class="toast-header ${bgColor}">
            <i class="bi ${iconClass} me-2"></i>
            <strong class="me-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    // Añadir al contenedor
    toastContainer.appendChild(toast);
    
    // Mostrar toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Ocultar después de 5 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
    
    // Permitir cerrar manualmente
    const closeBtn = toast.querySelector('.btn-close');
    closeBtn.addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    });
}

// Función para obtener el token de autenticación
function getToken() {
    return localStorage.getItem('adminToken');
}