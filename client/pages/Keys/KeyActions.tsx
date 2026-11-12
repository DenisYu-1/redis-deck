import { useState } from 'react';
import { FormModal } from '@/components/ui/FormModal';
import {
    addMember,
    copyKey,
    deleteKey,
    renameKey,
    saveKey,
    setTTL
} from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';
import type { KeyDetails } from '@/types';
import { showToast } from '@/utils/toast';
import { parseTtlInput } from './writeInputs';

type Dialog =
    'rename' | 'copy' | 'ttl' | 'delete' | 'edit' | 'field' | 'member';

interface Props {
    keyName: string;
    details: KeyDetails;
    /** undefined: refresh; string: select that key; null: key is gone. */
    onChanged: (next?: string | null) => void;
}

const READ_ONLY_TITLE = 'This connection is read-only';

/** Write controls for the open key: buttons plus the dialog each one opens. */
export function KeyActions({ keyName, details, onChanged }: Props) {
    const env = useAppStore((s) => s.currentEnvironment) ?? '';
    const readOnly = useAppStore(
        (s) => s.connections.find((c) => c.id === env)?.readOnly ?? false
    );
    const [open, setOpen] = useState<Dialog | null>(null);
    const close = () => setOpen(null);

    const btn = (dialog: Dialog, label: string, danger = false) => (
        <button
            type="button"
            className={`btn xs${danger ? ' danger' : ''}`}
            disabled={readOnly}
            title={readOnly ? READ_ONLY_TITLE : undefined}
            onClick={() => setOpen(dialog)}
        >
            {label}
        </button>
    );

    /** Toasts and refreshes after a write; the dialog then closes. */
    const finish = (message: string, ...next: [string | null] | []) => {
        showToast(message, 'success');
        onChanged(...next);
        return undefined;
    };

    return (
        <>
            <div className="dactions">
                {btn('rename', 'Rename')}
                {btn('copy', 'Copy to…')}
                {btn('ttl', 'Set TTL')}
                {details.type === 'string' && btn('edit', 'Edit value')}
                {details.type === 'hash' && btn('field', 'Add field')}
                {details.type === 'zset' && btn('member', 'Add member')}
                {btn('delete', 'Delete', true)}
            </div>
            {open === 'rename' && (
                <FormModal
                    title="Rename key"
                    submitLabel="Rename"
                    onClose={close}
                    fields={[
                        {
                            name: 'name',
                            label: 'New name',
                            initial: keyName,
                            mono: true
                        }
                    ]}
                    onSubmit={async ({ name = '' }) => {
                        if (!name.trim()) return 'Name is required';
                        if (name === keyName) return 'Name is unchanged';
                        await renameKey(keyName, name, env);
                        return finish(`Renamed to ${name}`, name);
                    }}
                />
            )}
            {open === 'copy' && (
                <FormModal
                    title="Copy key"
                    submitLabel="Copy"
                    onClose={close}
                    fields={[
                        {
                            name: 'name',
                            label: 'Copy to name',
                            initial: `${keyName}:copy`,
                            mono: true,
                            hint: 'An existing key with this name is overwritten.'
                        }
                    ]}
                    onSubmit={async ({ name = '' }) => {
                        if (!name.trim()) return 'Name is required';
                        if (name === keyName) return 'Pick a different name';
                        await copyKey(keyName, name, env, env);
                        return finish(`Copied to ${name}`);
                    }}
                />
            )}
            {open === 'ttl' && (
                <FormModal
                    title="Set TTL"
                    submitLabel="Save"
                    onClose={close}
                    fields={[
                        {
                            name: 'ttl',
                            label: 'TTL',
                            initial: details.ttl > 0 ? String(details.ttl) : '',
                            mono: true,
                            hint: 'Seconds, or 5m / 2h / 1d. Blank removes the expiry.'
                        }
                    ]}
                    onSubmit={async ({ ttl = '' }) => {
                        const seconds = parseTtlInput(ttl);
                        if (seconds === null) {
                            return 'Invalid TTL: use seconds, 5m, 2h or 1d';
                        }
                        await setTTL(keyName, seconds, env);
                        return finish(
                            seconds < 0 ? 'Expiry removed' : 'TTL updated'
                        );
                    }}
                />
            )}
            {open === 'delete' && (
                <FormModal
                    title="Delete key"
                    submitLabel="Delete key"
                    danger
                    message={`Delete ${keyName}? This cannot be undone.`}
                    onClose={close}
                    onSubmit={async () => {
                        await deleteKey(keyName, env);
                        return finish('Key deleted', null);
                    }}
                />
            )}
            {open === 'edit' && (
                <FormModal
                    title="Edit value"
                    submitLabel="Save"
                    onClose={close}
                    fields={[
                        {
                            name: 'value',
                            label: 'Value',
                            initial: String(details.value ?? ''),
                            multiline: true,
                            mono: true
                        }
                    ]}
                    onSubmit={async ({ value = '' }) => {
                        // SET drops the TTL, so hand the current one back.
                        const ttl = details.ttl > 0 ? details.ttl : null;
                        await saveKey(keyName, value, ttl, env, 'string');
                        return finish('Value saved');
                    }}
                />
            )}
            {open === 'field' && (
                <FormModal
                    title="Add hash field"
                    submitLabel="Add"
                    onClose={close}
                    fields={[
                        { name: 'field', label: 'Field', mono: true },
                        { name: 'value', label: 'Value', mono: true }
                    ]}
                    onSubmit={async ({ field = '', value = '' }) => {
                        if (!field) return 'Field is required';
                        await addMember(keyName, { field, value }, env);
                        return finish(`Set field ${field}`);
                    }}
                />
            )}
            {open === 'member' && (
                <FormModal
                    title="Add sorted-set member"
                    submitLabel="Add"
                    onClose={close}
                    fields={[
                        { name: 'member', label: 'Member', mono: true },
                        { name: 'score', label: 'Score', mono: true }
                    ]}
                    onSubmit={async ({ member = '', score = '' }) => {
                        if (!member) return 'Member is required';
                        if (
                            score.trim() === '' ||
                            !Number.isFinite(Number(score))
                        ) {
                            return 'Score must be a number';
                        }
                        await addMember(
                            keyName,
                            { member, score: Number(score) },
                            env
                        );
                        return finish(`Added ${member}`);
                    }}
                />
            )}
        </>
    );
}
