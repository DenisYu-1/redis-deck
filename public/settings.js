import { getTheme, setTheme } from './js/utils/theme.js';

document.addEventListener('DOMContentLoaded', () => {
    initThemeSelector();

    // DOM Elements
    const connectionsListContainer = document.getElementById('connections-list');
    const connectionFormContainer = document.getElementById('connection-form-container');
    const connectionForm = document.getElementById('connection-form');
    const addConnectionBtn = document.getElementById('add-connection-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const testConnectionBtn = document.getElementById('test-connection-btn');
    const editModeHeader = document.getElementById('edit-mode-header');
    const addModeHeader = document.getElementById('add-mode-header');
    const exportConnectionsBtn = document.getElementById('export-connections-btn');
    const importConnectionsBtn = document.getElementById('import-connections-btn');
    const importFileInput = document.getElementById('import-file-input');

    // Form fields
    const connectionIdInput = document.getElementById('connection-id');
    const connectionHostInput = document.getElementById('connection-host');
    const connectionPortInput = document.getElementById('connection-port');
    const connectionUsernameInput = document.getElementById('connection-username');
    const connectionPasswordInput = document.getElementById('connection-password');
    const connectionTlsInput = document.getElementById('connection-tls');
    const connectionClusterInput = document.getElementById('connection-cluster');

    // State
    let currentEditId = null;
    let connections = [];

    // Event listeners
    addConnectionBtn.addEventListener('click', showAddForm);
    cancelEditBtn.addEventListener('click', hideConnectionForm);
    testConnectionBtn.addEventListener('click', testConnection);
    connectionForm.addEventListener('submit', handleFormSubmit);
    exportConnectionsBtn.addEventListener('click', exportConnections);
    importConnectionsBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', importConnections);

    // Initial load of connections
    loadConnections();

    // Functions
    async function loadConnections() {
        try {
            const response = await fetch('/api/connections');
            if (!response.ok) {
                throw new Error('Failed to fetch connections');
            }

            const data = await response.json();
            connections = data.connections || [];

            renderConnections();
        } catch (error) {
            console.error('Error loading connections:', error);
            showToast('Failed to load connections', 'error');
            connectionsListContainer.innerHTML = '<p class="error">Failed to load connections</p>';
        }
    }

    function renderConnections() {
        if (connections.length === 0) {
            connectionsListContainer.innerHTML = '<p>No connections configured. Click "Add New Connection" to get started.</p>';
            exportConnectionsBtn.style.display = 'none';
            return;
        }

        exportConnectionsBtn.style.display = 'inline-block';

        let html = '';

        connections.forEach(conn => {
            html += `
                <div class="connection-card" draggable="true" data-id="${conn.id}">
                    <div class="connection-details">
                        <strong>${conn.id}</strong><br>
                        <span>${conn.host}:${conn.port}${conn.tls ? ' (TLS)' : ''}${conn.cluster ? ' (Cluster)' : ''}</span>
                        ${conn.username ? `<br><span>Username: ${conn.username}</span>` : ''}
                    </div>
                    <div class="connection-actions">
                        <button class="secondary-btn test-btn" data-id="${conn.id}" draggable="false">Test</button>
                        <button class="secondary-btn edit-btn" data-id="${conn.id}" draggable="false">Edit</button>
                        <button class="danger-btn delete-btn" data-id="${conn.id}" draggable="false">Delete</button>
                    </div>
                </div>
            `;
        });

        connectionsListContainer.innerHTML = html;

        // Add drag and drop event listeners
        setupDragAndDrop();

        // Add event listeners to buttons
        document.querySelectorAll('.test-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.target.dataset.id;
                testConnectionById(id, e.target);
            });
            btn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
        });

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.target.dataset.id;
                showEditForm(id);
            });
            btn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.target.dataset.id;
                deleteConnection(id);
            });
            btn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
        });
    }

    function setupDragAndDrop() {
        const cards = document.querySelectorAll('.connection-card');
        let draggedElement = null;
        let initialOrder = [];
        let isDragging = false;
        let dropHandled = false;

        cards.forEach((card) => {
            card.addEventListener('dragstart', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    e.preventDefault();
                    return;
                }
                draggedElement = card;
                isDragging = true;
                dropHandled = false;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', card.dataset.id);

                initialOrder = Array.from(connectionsListContainer.querySelectorAll('.connection-card'))
                    .map(c => c.dataset.id);
            });

            card.addEventListener('dragend', () => {
                isDragging = false;
                card.classList.remove('dragging');
                document.querySelectorAll('.connection-card').forEach(c => {
                    c.classList.remove('drag-over');
                });

                if (!dropHandled && initialOrder.length > 0) {
                    const finalOrder = Array.from(connectionsListContainer.querySelectorAll('.connection-card'))
                        .map(c => c.dataset.id);

                    const orderChanged = JSON.stringify(initialOrder) !== JSON.stringify(finalOrder);

                    if (orderChanged && finalOrder.length === initialOrder.length) {
                        updateConnectionOrder(finalOrder);
                    }
                }

                draggedElement = null;
                initialOrder = [];
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                const cardBeingDragged = document.querySelector('.dragging');
                if (!cardBeingDragged || card === cardBeingDragged) {
                    return;
                }

                const afterElement = getDragAfterElement(connectionsListContainer, e.clientY);

                if (afterElement == null) {
                    connectionsListContainer.appendChild(cardBeingDragged);
                } else {
                    connectionsListContainer.insertBefore(cardBeingDragged, afterElement);
                }
            });

            card.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (card !== draggedElement) {
                    card.classList.add('drag-over');
                }
            });

            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over');
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
            });
        });

        connectionsListContainer.addEventListener('dragover', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            const cardBeingDragged = document.querySelector('.dragging');
            if (!cardBeingDragged) return;

            const afterElement = getDragAfterElement(connectionsListContainer, e.clientY);

            if (afterElement == null) {
                connectionsListContainer.appendChild(cardBeingDragged);
            } else {
                connectionsListContainer.insertBefore(cardBeingDragged, afterElement);
            }
        });

        connectionsListContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            dropHandled = true;

            if (initialOrder.length > 0) {
                const finalOrder = Array.from(connectionsListContainer.querySelectorAll('.connection-card'))
                    .map(c => c.dataset.id);

                const orderChanged = JSON.stringify(initialOrder) !== JSON.stringify(finalOrder);

                if (orderChanged && finalOrder.length === initialOrder.length) {
                    updateConnectionOrder(finalOrder);
                }
            }
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.connection-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    async function updateConnectionOrder(connectionIds) {
        try {
            const response = await fetch('/api/connections/order', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ connectionIds })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update connection order');
            }

            await loadConnections();
            showToast('Connection order updated', 'success');
        } catch (error) {
            console.error('Error updating connection order:', error);
            showToast(error.message || 'Failed to update connection order', 'error');
        }
    }

    function showAddForm() {
        // Reset the form
        connectionForm.reset();
        connectionIdInput.disabled = false;

        // Enable ID field for new connections
        connectionIdInput.removeAttribute('readonly');

        // Show the form
        connectionFormContainer.style.display = 'block';
        editModeHeader.style.display = 'none';
        addModeHeader.style.display = 'block';

        // Set default port
        connectionPortInput.value = '6379';

        // Clear the current edit ID
        currentEditId = null;

        // Smooth scroll to the form
        connectionFormContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function showEditForm(id) {
        const connection = connections.find(conn => conn.id === id);
        if (!connection) {
            showToast(`Connection ${id} not found`, 'error');
            return;
        }

        // Fill the form with connection details
        connectionIdInput.value = connection.id;
        connectionHostInput.value = connection.host;
        connectionPortInput.value = connection.port;
        connectionUsernameInput.value = connection.username || '';
        connectionPasswordInput.value = ''; // Don't fill password for security
        connectionTlsInput.checked = connection.tls === 1 || connection.tls === true;
        connectionClusterInput.checked = connection.cluster === 1 || connection.cluster === true;

        // Disable ID field for existing connections
        connectionIdInput.setAttribute('readonly', true);

        // Show the form
        connectionFormContainer.style.display = 'block';
        editModeHeader.style.display = 'block';
        addModeHeader.style.display = 'none';

        // Set the current edit ID
        currentEditId = id;

        // Smooth scroll to the form
        connectionFormContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function hideConnectionForm() {
        connectionFormContainer.style.display = 'none';
        connectionForm.reset();
        currentEditId = null;
    }

    async function testConnection() {
        const id = currentEditId;
        const formData = new FormData(connectionForm);
        const connection = Object.fromEntries(formData.entries());

        // Convert checkbox to boolean
        connection.tls = connectionTlsInput.checked;
        connection.cluster = connectionClusterInput.checked;

        // Validate required fields
        if (!connection.id && !id) {
            showToast('Connection ID is required', 'error');
            return false;
        }

        if (!connection.host) {
            showToast('Host is required', 'error');
            return false;
        }

        if (!connection.port) {
            showToast('Port is required', 'error');
            return false;
        }

        try {
            // If we're editing, use the current ID, otherwise use the form ID
            const connectionId = id || connection.id;

            // If we're testing a form, we need to save it first if it's new
            if (!id && !connections.find(conn => conn.id === connection.id)) {
                await saveConnection(connection);
            }

            const testResult = await testConnectionById(connectionId);
            return testResult;
        } catch (error) {
            console.error('Error testing connection:', error);
            showToast(error.message || 'Failed to test connection', 'error');
            return false;
        }
    }

    async function testConnectionById(id, buttonEl) {
        // Validate ID
        if (!id) {
            showToast('Invalid connection ID', 'error');
            return false;
        }

        try {
            let testIndicator;

            // If a button element was provided, create an indicator next to it
            if (buttonEl) {
                // Remove existing indicator if any
                const existingIndicator = buttonEl.nextElementSibling;
                if (existingIndicator && existingIndicator.classList.contains('testing-indicator')) {
                    existingIndicator.remove();
                }

                // Create new indicator
                testIndicator = document.createElement('span');
                testIndicator.className = 'testing-indicator';
                testIndicator.textContent = 'Testing...';
                buttonEl.after(testIndicator);
            }

            // Test the connection
            const response = await fetch(`/api/connections/${id}/test`, {
                method: 'POST'
            });

            const result = await response.json();

            // Update the indicator if present
            if (testIndicator) {
                testIndicator.textContent = result.success ? 'Success!' : 'Failed';
                testIndicator.classList.add(result.success ? 'success' : 'error');

                // Remove the indicator after a delay
                setTimeout(() => {
                    testIndicator.remove();
                }, 3000);
            }

            // Show a toast
            showToast(result.message, result.success ? 'success' : 'error');

            return result.success;
        } catch (error) {
            console.error('Error testing connection:', error);
            showToast('Failed to test connection', 'error');

            if (buttonEl) {
                // Update the indicator if present
                const existingIndicator = buttonEl.nextElementSibling;
                if (existingIndicator && existingIndicator.classList.contains('testing-indicator')) {
                    existingIndicator.textContent = 'Error';
                    existingIndicator.classList.add('error');

                    // Remove the indicator after a delay
                    setTimeout(() => {
                        existingIndicator.remove();
                    }, 3000);
                }
            }

            return false;
        }
    }

    async function handleFormSubmit(e) {
        e.preventDefault();

        const formData = new FormData(connectionForm);
        const connection = Object.fromEntries(formData.entries());

        // Convert checkbox value
        connection.tls = connectionTlsInput.checked;
        connection.cluster = connectionClusterInput.checked;

        // Validate form
        if (!connection.id || !connection.host || !connection.port) {
            showToast('All required fields must be filled out', 'error');
            return;
        }

        try {
            const success = await saveConnection(connection);
            if (success) {
                // Form has been hidden by saveConnection
                if (currentEditId) {
                    showToast('Connection updated successfully', 'success');
                } else {
                    showToast('Connection created successfully', 'success');
                }
            }
        } catch (error) {
            console.error('Error saving connection:', error);
            showToast(error.message || 'Failed to save connection', 'error');
        }
    }

    async function saveConnection(connection) {
        try {
            // Convert tls checkbox value
            connection.tls = connection.tls ? 1 : 0;
            connection.cluster = connection.cluster ? 1 : 0;

            const method = currentEditId ? 'PUT' : 'POST';
            const url = currentEditId ? `/api/connections/${currentEditId}` : '/api/connections';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(connection)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to save connection');
            }

            // Reload the connections list
            await loadConnections();

            // Hide the form
            hideConnectionForm();

            return true;
        } catch (error) {
            console.error('Error saving connection:', error);
            showToast(error.message || 'Failed to save connection', 'error');
            return false;
        }
    }

    async function deleteConnection(id) {
        if (!id) {
            showToast('Invalid connection ID', 'error');
            return;
        }

        const connection = connections.find(conn => conn.id === id);
        if (!connection) {
            showToast(`Connection '${id}' not found`, 'error');
            return;
        }

        // Confirm deletion
        if (!confirm(`Are you sure you want to delete the connection "${id}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/connections/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Failed to delete connection ${id}`);
            }

            showToast('Connection deleted successfully', 'success');

            // Reload the connections list
            loadConnections();
        } catch (error) {
            console.error('Error deleting connection:', error);
            showToast(error.message || 'Failed to delete connection', 'error');
        }
    }

    function showToast(message, type = '') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast show';

        if (type) {
            toast.classList.add(type);
        }

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    function initThemeSelector() {
        const themeOptions = document.querySelectorAll('.theme-option');
        const currentTheme = getTheme();

        themeOptions.forEach(option => {
            if (option.dataset.theme === currentTheme) {
                option.classList.add('active');
            }

            option.addEventListener('click', () => {
                const selectedTheme = option.dataset.theme;
                setTheme(selectedTheme);

                themeOptions.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
            });
        });
    }

    async function exportConnections() {
        try {
            const response = await fetch('/api/connections/export');

            if (!response.ok) {
                throw new Error('Failed to export connections');
            }

            const data = await response.json();
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `redis-connections-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast('Connections exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting connections:', error);
            showToast('Failed to export connections', 'error');
        }
    }

    async function importConnections(event) {
        const file = event.target.files[0];

        if (!file) {
            return;
        }

        try {
            const fileContent = await file.text();
            const data = JSON.parse(fileContent);

            if (!data.connections || !Array.isArray(data.connections)) {
                throw new Error('Invalid file format: missing connections array');
            }

            const response = await fetch('/api/connections/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to import connections');
            }

            const result = await response.json();

            await loadConnections();

            showToast(result.message, 'success');

            if (result.results && result.results.errors.length > 0) {
                console.error('Import errors:', result.results.errors);
            }
        } catch (error) {
            console.error('Error importing connections:', error);
            showToast(error.message || 'Failed to import connections', 'error');
        } finally {
            importFileInput.value = '';
        }
    }
});
