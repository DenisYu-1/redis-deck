import React from 'react';
import {
    KeyDetailsContainer,
    KeyInfo,
    ValueActions,
    ValueDisplay,
    KeyActions,
    TTLInfo,
    ActionButtons
} from './KeyDetails.styled';
import { formatValue } from '../utils/valueUtils';
import type { KeyDetails as KeyDetailsType } from '../utils/types';

interface KeyDetailsProps {
    selectedKey: string | null;
    keyDetails: KeyDetailsType | null;
    isLoadingDetails: boolean;
    onViewValue: (value: any, type: string) => void;
    onCopyValue: (value: any) => void;
    onSetTTL: () => void;
    onDelete: () => void;
    onRename: () => void;
    onCopy: () => void;
}

export const KeyDetails: React.FC<KeyDetailsProps> = ({
    selectedKey,
    keyDetails,
    isLoadingDetails,
    onViewValue,
    onCopyValue,
    onSetTTL,
    onDelete,
    onRename,
    onCopy,
}) => {
    return (
        <KeyDetailsContainer className="key-details">
            <h3>Key Details</h3>
            <KeyInfo id="key-info">
                {selectedKey ? (
                    keyDetails ? (
                        <>
                            <p>
                                <strong>Key:</strong> {keyDetails.key}
                            </p>
                            <p>
                                <strong>Type:</strong> {keyDetails.type}
                            </p>
                            <p>
                                <strong>Value:</strong>
                                <ValueActions className="value-actions">
                                    <button
                                        className="value-action-btn"
                                        onClick={() =>
                                            onViewValue(
                                                keyDetails.value,
                                                keyDetails.type
                                            )
                                        }
                                        title="View formatted value"
                                    >
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                            <circle
                                                cx="12"
                                                cy="12"
                                                r="3"
                                            ></circle>
                                        </svg>
                                    </button>
                                    <button
                                        className="value-action-btn"
                                        onClick={() =>
                                            onCopyValue(
                                                keyDetails.value
                                            )
                                        }
                                        title="Copy value"
                                    >
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <rect
                                                x="9"
                                                y="9"
                                                width="13"
                                                height="13"
                                                rx="2"
                                                ry="2"
                                            ></rect>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                        </svg>
                                    </button>
                                </ValueActions>
                            </p>
                            <ValueDisplay>
                                {formatValue(
                                    keyDetails.type,
                                    keyDetails.value
                                )}
                            </ValueDisplay>
                        </>
                    ) : isLoadingDetails ? (
                        <p>Loading...</p>
                    ) : (
                        <p>Error loading key details</p>
                    )
                ) : (
                    <p>Select a key to view details</p>
                )}
            </KeyInfo>
            {selectedKey && keyDetails && (
                <KeyActions id="key-actions">
                    <TTLInfo className="ttl-info">
                        <span>
                            TTL:{' '}
                            <span id="key-ttl">
                                {keyDetails.ttl ?? 'N/A'}
                            </span>
                        </span>
                        <button
                            onClick={onSetTTL}
                            className="secondary-btn"
                        >
                            Set TTL
                        </button>
                    </TTLInfo>
                    <ActionButtons className="action-buttons">
                        <button
                            onClick={onDelete}
                            className="danger-btn"
                        >
                            Delete
                        </button>
                        <button
                            onClick={onRename}
                            className="secondary-btn"
                        >
                            Rename
                        </button>
                        <button
                            onClick={onCopy}
                            className="secondary-btn"
                        >
                            Copy
                        </button>
                    </ActionButtons>
                </KeyActions>
            )}
        </KeyDetailsContainer>
    );
};