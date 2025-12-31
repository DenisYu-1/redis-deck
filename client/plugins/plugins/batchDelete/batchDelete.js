import {PluginBase} from "@/plugins/core/PluginBase";
import {deleteKeysByPattern} from "../../../../public/js/services/apiService";
import {showToast} from "@/utils/toast";
import {ComponentHelper} from "@/plugins/core/ComponentHelper";

export default class BatchDeletePlugin extends PluginBase {
    async init(context) {
        this.context = context;
        await ComponentHelper.injectHTML(
            '/js/plugins/batchDelete/view.html',
            this.priority
        );
        this.setupEventListeners();
    }

    setupEventListeners() {
        const batchDeleteBtn = document.getElementById('batch-delete-btn');
        const deletePattern = document.getElementById('delete-pattern');

        if (!batchDeleteBtn || !deletePattern) {
            console.error('Batch delete plugin elements not found');
            return;
        }

        batchDeleteBtn.addEventListener('click', () => {
            this.handleBatchDelete();
        });

        deletePattern.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                this.handleBatchDelete();
            }
        });
    }

    async handleBatchDelete() {
        const deletePattern = document.getElementById('delete-pattern');
        const pattern = deletePattern.value.trim();

        if (!pattern) {
            showToast('Pattern is required', 'error');
            return;
        }

        if (
            !confirm(
                `Are you sure you want to delete all keys matching the pattern "${pattern}"?`
            )
        ) {
            return;
        }

        try {
            const environment = this.context.getCurrentEnvironment();
            const result = await deleteKeysByPattern(pattern, environment);
            showToast(result.message, 'success');

            deletePattern.value = '';

            if (this.context.onOperationComplete) {
                this.context.onOperationComplete();
            }
        } catch (error) {
            showToast(error.message, 'error');
            console.error('Error deleting keys:', error);
        }
    }

    async destroy() {}
}
