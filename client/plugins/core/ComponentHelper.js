export class ComponentHelper {
    static async injectHTML(htmlPath, priority = 0) {
        try {
            const response = await fetch(htmlPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch HTML: ${response.statusText}`);
            }

            const html = await response.text();
            const mainElement = document.querySelector('main');

            if (!mainElement) {
                throw new Error('Main element not found');
            }

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html.trim();
            const section = tempDiv.firstElementChild;

            section.dataset.priority = priority;
            mainElement.appendChild(section);

            return section;
        } catch (error) {
            console.error('Error injecting HTML:', error);
            throw error;
        }
    }
}
