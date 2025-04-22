import { PluginBase } from '../PluginBase.js';
import { ComponentHelper } from '../ComponentHelper.js';
import { saveKey, addToSortedSet } from '../../services/apiService.js';
import { showToast } from '../../utils/domUtils.js';

export default class KeyOperationsPlugin extends PluginBase {
    async init(context) {
        this.context = context;
        await ComponentHelper.injectHTML('/js/plugins/keyOperations/view.html', this.priority);
        this.setupEventListeners();
    }

    setupEventListeners() {
        const addKeyBtn = document.getElementById('add-key-btn');
        const keyTypeSelect = document.getElementById('key-type');
        const addZsetMemberBtn = document.getElementById('add-zset-member-btn');

        if (!addKeyBtn || !keyTypeSelect) {
            console.error('Key operations plugin elements not found');
            return;
        }

        this.showTypeFields('string');

        keyTypeSelect.addEventListener('change', (e) => {
            this.showTypeFields(e.target.value);
        });

        addKeyBtn.addEventListener('click', () => {
            this.handleAddOrUpdateKey();
        });

        if (addZsetMemberBtn) {
            addZsetMemberBtn.addEventListener('click', () => {
                this.addZsetMember();
            });
        }

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-member-btn')) {
                this.removeZsetMember(e.target);
            }
        });
    }

    async handleAddOrUpdateKey() {
        const newKeyInput = document.getElementById('new-key');
        const expiryInput = document.getElementById('expiry');
        const keyTypeSelect = document.getElementById('key-type');

        const key = newKeyInput.value.trim();
        const keyType = keyTypeSelect.value;
        const expiry = expiryInput.value.trim();

        if (!key) {
            showToast('Key is required', 'error');
            return;
        }

        try {
            const environment = this.context.getCurrentEnvironment();

            if (keyType === 'string') {
                const newValueInput = document.getElementById('new-value');
                const value = newValueInput.value.trim();

                if (!value) {
                    showToast('Value is required', 'error');
                    return;
                }

                await saveKey(key, value, expiry, environment);
                newValueInput.value = '';
            } else if (keyType === 'zset') {
                const members = this.getZsetMembers();

                if (members.length === 0) {
                    showToast('At least one member is required for a sorted set', 'error');
                    return;
                }

                await addToSortedSet(key, members, expiry, environment);
                this.clearZsetMembers();
            } else {
                showToast(`Support for ${keyType} keys is not implemented yet`, 'error');
                return;
            }

            showToast(`Key "${key}" saved successfully`, 'success');

            newKeyInput.value = '';
            expiryInput.value = '';

            if (this.context.onOperationComplete) {
                this.context.onOperationComplete();
            }
        } catch (error) {
            showToast(error.message, 'error');
            console.error('Error saving key:', error);
        }
    }

    showTypeFields(keyType) {
        const allTypeFields = document.querySelectorAll('.type-fields');
        allTypeFields.forEach(field => field.classList.add('hidden'));

        const targetField = document.getElementById(`${keyType}-fields`);
        if (targetField) {
            targetField.classList.remove('hidden');
        }
    }

    addZsetMember() {
        const membersContainer = document.getElementById('zset-members');
        const memberDiv = document.createElement('div');
        memberDiv.className = 'zset-member';

        memberDiv.innerHTML = `
            <input type="number" class="zset-score" placeholder="Score" step="any">
            <input type="text" class="zset-value" placeholder="Value">
            <button type="button" class="remove-member-btn secondary-btn" title="Remove member">×</button>
        `;

        membersContainer.appendChild(memberDiv);
    }

    removeZsetMember(button) {
        const memberDiv = button.closest('.zset-member');
        const membersContainer = document.getElementById('zset-members');

        if (membersContainer.children.length > 1) {
            memberDiv.remove();
        } else {
            showToast('At least one member is required', 'error');
        }
    }

    getZsetMembers() {
        const members = [];
        const memberDivs = document.querySelectorAll('.zset-member');

        memberDivs.forEach(memberDiv => {
            const scoreInput = memberDiv.querySelector('.zset-score');
            const valueInput = memberDiv.querySelector('.zset-value');

            const score = scoreInput.value.trim();
            const value = valueInput.value.trim();

            if (score !== '' && value !== '') {
                members.push({
                    score: parseFloat(score),
                    value: value
                });
            }
        });

        return members;
    }

    clearZsetMembers() {
        const membersContainer = document.getElementById('zset-members');
        membersContainer.innerHTML = `
            <div class="zset-member">
                <input type="number" class="zset-score" placeholder="Score" step="any">
                <input type="text" class="zset-value" placeholder="Value">
                <button type="button" class="remove-member-btn secondary-btn" title="Remove member">×</button>
            </div>
        `;
    }

    async destroy() {
    }
}


