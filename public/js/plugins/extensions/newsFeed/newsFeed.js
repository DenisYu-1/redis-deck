import { PluginBase } from '../../PluginBase.js';
import { ComponentHelper } from '../../ComponentHelper.js';
import {
    addToSortedSet,
    getKeyDetails,
    keyExists
} from '../../../services/apiService.js';
import { parseZsetValue } from '../../../utils/dataFormatter.js';
import { showToast } from '../../../utils/domUtils.js';
import { search } from '../../../components/keyList.js';

export default class NewsFeedPlugin extends PluginBase {
    async init(context) {
        this.context = context;
        await ComponentHelper.injectHTML(
            '/js/plugins/extensions/newsFeed/view.html',
            this.priority
        );
        this.renderSearchButton();
        this.setupEventListeners();
    }

    renderSearchButton() {
        const section = document.querySelector('.news-feed-section');
        if (!section) {
            console.error('News feed section not found');
            return;
        }

        // Create search button container
        const searchContainer = document.createElement('div');
        searchContainer.className = 'search-container';
        searchContainer.style.marginBottom = '20px';

        const searchButton = document.createElement('button');
        searchButton.id = 'news-feed-search-btn';
        searchButton.textContent = 'Find (ssoId)';
        searchButton.className = 'secondary-btn';
        searchButton.addEventListener('click', () => {
            const searchPatternInput =
                document.getElementById('search-pattern');
            searchPatternInput.value = 'news-feed:*';
            search(this.context.getCurrentEnvironment());
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        searchContainer.appendChild(searchButton);
        section.insertBefore(searchContainer, section.firstChild);
    }

    setupEventListeners() {
        const submitBtn = document.getElementById('news-feed-submit');
        const userIdInput = document.getElementById('news-feed-user-id');
        const conversationInput = document.getElementById(
            'news-feed-conversation-key'
        );

        if (!submitBtn || !userIdInput || !conversationInput) {
            console.error('News feed plugin elements not found');
            return;
        }

        submitBtn.addEventListener('click', () => {
            this.handleSubmit();
        });

        [userIdInput, conversationInput].forEach((input) => {
            input.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    this.handleSubmit();
                }
            });
        });
    }

    async handleSubmit() {
        const userId = this.readUserId();
        const conversationKey = this.readConversationKey();

        if (userId === null || conversationKey === null) {
            return;
        }

        const environment = this.context.getCurrentEnvironment();
        const key = `news-feed:${userId}`;
        const newsId = conversationKey;

        try {
            const exists = await keyExists(key, environment);

            if (exists) {
                const details = await getKeyDetails(key, environment);
                if (details.type !== 'zset') {
                    showToast(`Key ${key} must be a sorted set`, 'error');
                    return;
                }

                const members = this.parseMembers(details.value);

                if (this.hasNewsId(members, newsId)) {
                    showToast(
                        'News item already exists for this conversation',
                        'info'
                    );
                    return;
                }
            }

            // Always add just the new member - ZADD will create the key if it doesn't exist
            const member = this.buildMember(userId, conversationKey);

            const result = await addToSortedSet(
                key,
                [member],
                undefined,
                environment
            );

            if (!result.success) {
                throw new Error(
                    'Failed to add member to sorted set - key was not created'
                );
            }

            showToast(
                `News feed chat link added for user ${userId}`,
                'success'
            );
            this.clearInputs();

            if (this.context.onOperationComplete) {
                this.context.onOperationComplete();
            }
        } catch (error) {
            showToast(error.message || 'Failed to add news feed item', 'error');
            console.error('Error adding news feed item:', error);
        }
    }

    readUserId() {
        const input = document.getElementById('news-feed-user-id');
        const value = input?.value.trim();

        if (!value) {
            showToast('User ID is required', 'error');
            return null;
        }

        if (!/^\d+$/.test(value)) {
            showToast('User ID must be a number', 'error');
            return null;
        }

        return parseInt(value, 10);
    }

    readConversationKey() {
        const input = document.getElementById('news-feed-conversation-key');
        const value = input?.value.trim();
        const uuidRegex =
            /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

        if (!value) {
            showToast('Conversation key is required', 'error');
            return null;
        }

        if (!uuidRegex.test(value)) {
            showToast('Conversation key must be a valid UUID', 'error');
            return null;
        }

        return value;
    }

    parseMembers(rawValue) {
        if (Array.isArray(rawValue)) {
            return rawValue
                .map((item) => ({
                    value:
                        typeof item.value === 'string'
                            ? item.value
                            : JSON.stringify(item.value ?? ''),
                    score:
                        typeof item.score === 'number'
                            ? item.score
                            : parseFloat(item.score)
                }))
                .filter((item) => item.value);
        }

        if (typeof rawValue === 'string') {
            return parseZsetValue(rawValue);
        }

        return [];
    }

    hasNewsId(members, newsId) {
        return members.some((member) => {
            try {
                const parsed =
                    typeof member.value === 'string'
                        ? JSON.parse(member.value)
                        : member.value;
                return parsed?.news_id === newsId;
            } catch {
                return false;
            }
        });
    }

    buildMember(userId, conversationKey) {
        const payload = {
            subline: 'Reise Community Chat',
            product: 'gencom',
            news_id: conversationKey,
            content: 'Some link to "Chat conversation".',
            image_url:
                'https://cdn1.urlaub.check24.de/size=800c600/source=aHR0cHM6Ly9pLmdpYXRhbWVkaWEuY29tL3MucGhwP3VpZD0xNzg4NDkmc291cmNlPXhtbCZzaXplPTgwMCZjaWQ9MjQxNTAmaWlkPTEzMDgwNTA0Mg==!aef5bf/picture.jpg',
            target_url: `https://community.check24.de/chats?action=openChat&chatId=${conversationKey}`,
            user_id: userId,
            created_at: '2025-10-06T13:23:03+00:00',
            is_read: false,
            type: 'chat',
            referenceId: '1e400ace-2def-4356-8a80-be689ab9929e'
        };

        return {
            score: Math.floor(Date.now() / 1000),
            value: JSON.stringify(payload)
        };
    }

    clearInputs() {
        const userIdInput = document.getElementById('news-feed-user-id');
        const conversationInput = document.getElementById(
            'news-feed-conversation-key'
        );

        if (userIdInput) {
            userIdInput.value = '';
        }

        if (conversationInput) {
            conversationInput.value = '';
        }
    }

    async destroy() {}
}
