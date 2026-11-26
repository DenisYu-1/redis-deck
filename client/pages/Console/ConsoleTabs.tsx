import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { FormModal } from '@/components/ui/FormModal';
import { CloseIcon, PlusIcon } from '@/components/ui/Icons';
import { Modal } from '@/components/ui/Modal';
import { showToast } from '@/utils/toast';
import type { ConsoleTab, useConsoleTabs } from './useConsoleTabs';
import './consoleTabs.css';

export function ConsoleTabs({
    tabs,
    active,
    select,
    add,
    close,
    rename
}: ReturnType<typeof useConsoleTabs>) {
    const [closing, setClosing] = useState<ConsoleTab | null>(null);

    const [renaming, setRenaming] = useState<ConsoleTab | null>(null);

    const requestClose = (tab: ConsoleTab) => {
        if (tabs.length === 1) showToast('Keep at least one console', 'info');
        else if (tab.script.trim()) setClosing(tab);
        else close(tab.id);
    };

    return (
        <div className="ctabs">
            <div className="ctablist" role="tablist" aria-label="Consoles">
                {tabs.map((tab) => (
                    <div
                        key={tab.id}
                        className={tab.id === active.id ? 'ctab on' : 'ctab'}
                        role="presentation"
                    >
                        <button
                            type="button"
                            className="ctabbtn"
                            role="tab"
                            aria-selected={tab.id === active.id}
                            title="Double-click or F2 to rename"
                            onClick={() => select(tab.id)}
                            onDoubleClick={() => setRenaming(tab)}
                            onKeyDown={(e) => {
                                if (e.key === 'F2') setRenaming(tab);
                            }}
                        >
                            {tab.name}
                        </button>
                        <button
                            type="button"
                            className="xb"
                            aria-label={`Close ${tab.name}`}
                            title="Close"
                            onClick={() => requestClose(tab)}
                        >
                            <CloseIcon />
                        </button>
                    </div>
                ))}
            </div>
            <button
                type="button"
                className="ctnew"
                aria-label="New console"
                title="New console"
                onClick={add}
            >
                <PlusIcon />
            </button>
            {/* in the body, so dialogs do not take the header's text style */}
            {renaming &&
                createPortal(
                    <FormModal
                        title="Rename console"
                        submitLabel="Rename"
                        fields={[
                            {
                                name: 'name',
                                label: 'Name',
                                initial: renaming.name,
                                mono: true
                            }
                        ]}
                        onClose={() => setRenaming(null)}
                        onSubmit={({ name = '' }) => {
                            if (!name.trim()) {
                                return Promise.resolve('Enter a name');
                            }
                            rename(renaming.id, name.trim());
                            return Promise.resolve(undefined);
                        }}
                    />,
                    document.body
                )}
            {closing &&
                createPortal(
                    <Modal
                        title={`Close ${closing.name}?`}
                        onClose={() => setClosing(null)}
                        footer={
                            <>
                                <Button onClick={() => setClosing(null)}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={() => {
                                        close(closing.id);
                                        setClosing(null);
                                    }}
                                >
                                    Close
                                </Button>
                            </>
                        }
                    >
                        <p className="sm mu">Its commands are discarded.</p>
                    </Modal>,
                    document.body
                )}
        </div>
    );
}
