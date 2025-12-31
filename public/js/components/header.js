import { loadEnvironments, getKeyCount } from '../services/apiService.js';
import {
    saveEnvironmentToStorage,
    loadEnvironmentFromStorage
} from './environment.js';

export class HeaderComponent {
    constructor(options = {}) {
        this.headerElement = null;
        this.currentEnvironment = null;
        this.environmentReady = false;
        this.environmentReadyPromise = null;
        this.options = {
            showBackButton: false,
            showStatsButton: true,
            showSettingsButton: true,
            backButtonUrl: '/',
            backButtonText: '↩️',
            backButtonTitle: 'Back to Dashboard',
            ...options
        };
    }

    createHeader() {
        const header = document.createElement('header');

        // Logo container
        const logoContainer = document.createElement('div');
        logoContainer.className = 'logo-container';

        const svg = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'svg'
        );
        svg.setAttribute('class', 'logo');
        svg.setAttribute('viewBox', '0 0 465 100');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        const defs = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'defs'
        );
        const style = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'style'
        );
        style.textContent = `
            .primary-red { fill: #dc382d; }
            .dark-accent { fill: #1a1a1a; }
            .light-red { fill: #e85d52; }
        `;
        defs.appendChild(style);

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', 'translate(215, 50)');

        const innerG = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'g'
        );
        innerG.setAttribute('transform', 'translate(-215, -40)');

        // Rectangles and lines for logo design
        const rect1 = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'rect'
        );
        rect1.setAttribute('x', '20');
        rect1.setAttribute('y', '20');
        rect1.setAttribute('width', '100');
        rect1.setAttribute('height', '70');
        rect1.setAttribute('rx', '4');
        rect1.setAttribute('class', 'dark-accent');
        rect1.setAttribute('opacity', '0.3');

        const rect2 = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'rect'
        );
        rect2.setAttribute('x', '10');
        rect2.setAttribute('y', '10');
        rect2.setAttribute('width', '100');
        rect2.setAttribute('height', '70');
        rect2.setAttribute('rx', '4');
        rect2.setAttribute('class', 'primary-red');
        rect2.setAttribute('opacity', '0.7');

        const logoG = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'g'
        );
        const logoRect = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'rect'
        );
        logoRect.setAttribute('x', '0');
        logoRect.setAttribute('y', '0');
        logoRect.setAttribute('width', '100');
        logoRect.setAttribute('height', '70');
        logoRect.setAttribute('rx', '4');
        logoRect.setAttribute('class', 'primary-red');

        // Lines
        const lines = [
            { x1: '35', y1: '8', x2: '35', y2: '62' },
            { x1: '65', y1: '8', x2: '65', y2: '62' },
            { x1: '8', y1: '35', x2: '92', y2: '35' }
        ];

        lines.forEach((lineData) => {
            const line = document.createElementNS(
                'http://www.w3.org/2000/svg',
                'line'
            );
            line.setAttribute('x1', lineData.x1);
            line.setAttribute('y1', lineData.y1);
            line.setAttribute('x2', lineData.x2);
            line.setAttribute('y2', lineData.y2);
            line.setAttribute('stroke', '#FAFAFA');
            line.setAttribute('stroke-width', '2');
            logoG.appendChild(line);
        });

        // Circles
        const circles = [
            { cx: '20', cy: '20' },
            { cx: '50', cy: '20' },
            { cx: '80', cy: '20' },
            { cx: '20', cy: '50' },
            { cx: '50', cy: '50' },
            { cx: '80', cy: '50' }
        ];

        circles.forEach((circleData) => {
            const circle = document.createElementNS(
                'http://www.w3.org/2000/svg',
                'circle'
            );
            circle.setAttribute('cx', circleData.cx);
            circle.setAttribute('cy', circleData.cy);
            circle.setAttribute('r', '4');
            circle.setAttribute('fill', '#FAFAFA');
            logoG.appendChild(circle);
        });

        // Text elements
        const redisText = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'text'
        );
        redisText.setAttribute('x', '-90');
        redisText.setAttribute('y', '11');
        redisText.setAttribute('dominant-baseline', 'middle');
        redisText.setAttribute(
            'font-family',
            "'Inter', 'Helvetica Neue', Arial, sans-serif"
        );
        redisText.setAttribute('font-size', '68');
        redisText.setAttribute('font-weight', '700');
        redisText.setAttribute('class', 'primary-red');
        redisText.setAttribute('letter-spacing', '-2');
        redisText.textContent = 'Redis';

        const deckText = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'text'
        );
        deckText.setAttribute('x', '85');
        deckText.setAttribute('y', '11');
        deckText.setAttribute('dominant-baseline', 'middle');
        deckText.setAttribute(
            'font-family',
            "'Inter', 'Helvetica Neue', Arial, sans-serif"
        );
        deckText.setAttribute('font-size', '68');
        deckText.setAttribute('font-weight', '700');
        deckText.setAttribute('class', 'dark-accent');
        deckText.setAttribute('letter-spacing', '-2');
        deckText.textContent = 'Deck';

        // Assemble SVG
        logoG.appendChild(logoRect);
        innerG.appendChild(rect1);
        innerG.appendChild(rect2);
        innerG.appendChild(logoG);
        g.appendChild(innerG);
        g.appendChild(redisText);
        g.appendChild(deckText);
        svg.appendChild(defs);
        svg.appendChild(g);
        logoContainer.appendChild(svg);

        // Connection info
        const connectionInfo = document.createElement('div');
        connectionInfo.className = 'connection-info';

        const envSelector = document.createElement('div');
        envSelector.className = 'environment-selector';

        const label = document.createElement('label');
        label.setAttribute('for', 'environment-select');
        label.textContent = 'Environment:';

        const select = document.createElement('select');
        select.id = 'environment-select';

        envSelector.appendChild(label);
        envSelector.appendChild(select);

        const totalKeysSpan = document.createElement('span');
        totalKeysSpan.id = 'total-keys-count';
        totalKeysSpan.className = 'total-keys';
        totalKeysSpan.textContent = 'Total Keys: Loading...';

        connectionInfo.appendChild(envSelector);
        connectionInfo.appendChild(totalKeysSpan);

        // Redis info buttons
        const redisInfoButton = document.createElement('div');
        redisInfoButton.className = 'redis-info-button';

        if (this.options.showBackButton) {
            const backLink = document.createElement('a');
            backLink.href = this.options.backButtonUrl;
            backLink.className = 'secondary-btn';
            backLink.title = this.options.backButtonTitle;
            backLink.textContent = this.options.backButtonText;
            redisInfoButton.appendChild(backLink);
        }

        if (this.options.showStatsButton) {
            const statsLink = document.createElement('a');
            statsLink.href = '/statistics.html';
            statsLink.className = 'secondary-btn';
            statsLink.title = 'Statistics';
            statsLink.textContent = '📊';
            redisInfoButton.appendChild(statsLink);
        }

        if (this.options.showSettingsButton) {
            const settingsLink = document.createElement('a');
            settingsLink.href = '/settings.html';
            settingsLink.className = 'secondary-btn';
            settingsLink.title = 'Settings';
            settingsLink.textContent = '⚙️';
            redisInfoButton.appendChild(settingsLink);
        }

        // Assemble header
        header.appendChild(logoContainer);
        header.appendChild(connectionInfo);
        header.appendChild(redisInfoButton);

        this.headerElement = header;
        return header;
    }

    render(container) {
        if (!this.headerElement) {
            this.createHeader();
        }
        container.appendChild(this.headerElement);

        // Initialize environment functionality after rendering
        this.initializeEnvironmentHandling();
    }

    async initializeEnvironmentHandling() {
        if (this.environmentReadyPromise) {
            return this.environmentReadyPromise;
        }

        this.environmentReadyPromise = this.loadEnvironments().then(() => {
            this.setupEnvironmentEventListeners();
            this.environmentReady = true;
        });

        return this.environmentReadyPromise;
    }

    async loadEnvironments() {
        try {
            const connections = await loadEnvironments();
            this.populateEnvironmentSelector(connections);
        } catch (error) {
            console.error('Error loading environments in header:', error);
            const select = this.headerElement.querySelector(
                '#environment-select'
            );
            if (select) {
                select.innerHTML =
                    '<option value="">Error loading connections</option>';
            }
        }
    }

    populateEnvironmentSelector(connections) {
        const select = this.headerElement.querySelector('#environment-select');
        if (!select) return;

        // Clear existing options
        select.innerHTML = '';

        if (!connections || connections.length === 0) {
            select.innerHTML = '<option value="">No connections</option>';
            return;
        }

        // Add connection options
        connections.forEach((conn) => {
            const option = document.createElement('option');
            option.value = conn.id;
            option.textContent = conn.id;
            select.appendChild(option);
        });

        // Set the selected environment from localStorage or default to first
        const savedEnvironment = loadEnvironmentFromStorage();
        if (
            savedEnvironment &&
            connections.some((conn) => conn.id === savedEnvironment)
        ) {
            this.currentEnvironment = savedEnvironment;
            select.value = savedEnvironment;
        } else if (connections.length > 0) {
            this.currentEnvironment = connections[0].id;
            select.value = this.currentEnvironment;
            saveEnvironmentToStorage(this.currentEnvironment);
        }

        // Update total keys count for initial environment
        this.updateTotalKeysCount(this.currentEnvironment);
    }

    setupEnvironmentEventListeners() {
        const select = this.headerElement.querySelector('#environment-select');
        if (!select) return;

        select.addEventListener('change', async (e) => {
            const newEnvironment = e.target.value;
            this.currentEnvironment = newEnvironment;
            saveEnvironmentToStorage(newEnvironment);

            // Update total keys count
            await this.updateTotalKeysCount(newEnvironment);
        });
    }

    async updateTotalKeysCount(environment) {
        const totalKeysElement =
            this.headerElement.querySelector('#total-keys-count');
        if (!totalKeysElement) return;

        if (!environment) {
            totalKeysElement.textContent = 'Total Keys: N/A';
            return;
        }

        try {
            totalKeysElement.textContent = 'Total Keys: Loading...';
            const data = await getKeyCount(environment);
            totalKeysElement.textContent = `Total Keys: ${data.count.toLocaleString()}`;
        } catch (error) {
            totalKeysElement.textContent = 'Total Keys: Error';
            console.error('Error getting key count in header:', error);
        }
    }

    async getCurrentEnvironment() {
        // Wait for environments to be loaded if not ready
        if (!this.environmentReady) {
            await this.initializeEnvironmentHandling();
        }
        return this.currentEnvironment;
    }
}
