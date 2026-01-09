import React from 'react';
import styled from 'styled-components';
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

const KeyDetailsContainer = styled.div`
    flex: 1;
`;

const KeyInfo = styled.div`
    margin-bottom: 16px;

    p {
        margin: 8px 0;
        font-size: 14px;
    }

    strong {
        display: inline-block;
        min-width: 60px;
    }
`;

const ValueActions = styled.div`
    display: inline-flex;
    gap: 4px;
    margin-left: 8px;

    button {
        padding: 4px;
        background: none;
        border: 1px solid #ccc;
        border-radius: 3px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
            background-color: #f8f9fa;
        }

        svg {
            width: 16px;
            height: 16px;
        }
    }
`;

const ValueDisplay = styled.pre`
    background-color: #f8f9fa;
    padding: 12px;
    border-radius: 4px;
    border: 1px solid #e9ecef;
    font-family: monospace;
    font-size: 13px;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 300px;
    overflow-y: auto;
`;

const KeyActions = styled.div`
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #eee;
`;

const TTLInfo = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 14px;
`;

const ActionButtons = styled.div`
    display: flex;
    gap: 8px;

    button {
        padding: 8px 16px;
        border: 1px solid #ccc;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;

        &.danger-btn {
            background-color: #dc3545;
            color: white;
            border-color: #dc3545;

            &:hover {
                background-color: #c82333;
            }
        }

        &.secondary-btn {
            background-color: #6c757d;
            color: white;
            border-color: #6c757d;

            &:hover {
                background-color: #5a6268;
            }
        }
    }
`;

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