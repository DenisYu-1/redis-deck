import { PluginBase } from '../../PluginBase.js';
import { ComponentHelper } from '../../ComponentHelper.js';
import { search } from '../../../components/keyList.js';

export default class CustomSearchesPlugin extends PluginBase {
    constructor(config) {
        super(config);

        this.searches = [
            {
                id: 'command-locks-btn',
                text: 'Commands locks',
                pattern: 'command-lock*'
            },
            {
                id: 'tipp-chats-lock-btn',
                text: 'TippChatsLock',
                pattern: 'command-lock_core:tippspiel:cache-conversations'
            },
            {
                id: 'queues-btn',
                text: 'Queues',
                pattern: 'c24-test-community-*'
            },
            {
                id: 'queues-prod-btn',
                text: 'Queues (prod)',
                pattern: 'c24-prod-community-*'
            },
            {
                id: 'sso-activities-btn',
                text: 'Sso Activities(userId)',
                pattern: 'sso_activities:user:*'
            }
        ];
    }

    async init(context) {
        this.context = context;
        await ComponentHelper.injectHTML(
            '/js/plugins/extensions/customSearches/view.html',
            this.priority
        );
        this.renderButtons();
    }

    renderButtons() {
        const buttonContainer = document.querySelector(
            '.custom-searches-section .button-container'
        );
        if (!buttonContainer) {
            console.error('Custom searches button container not found');
            return;
        }

        this.searches.forEach((searchConfig) => {
            const button = document.createElement('button');
            button.id = searchConfig.id;
            button.textContent = searchConfig.text;
            button.className = 'secondary-btn';
            button.addEventListener('click', () => {
                const searchPatternInput =
                    document.getElementById('search-pattern');
                searchPatternInput.value = searchConfig.pattern;
                search(this.context.getCurrentEnvironment());
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            buttonContainer.appendChild(button);
        });
    }

    async destroy() {
        const buttonContainer = document.querySelector(
            '.custom-searches-section .button-container'
        );
        if (buttonContainer) {
            buttonContainer.innerHTML = '';
        }
    }
}
