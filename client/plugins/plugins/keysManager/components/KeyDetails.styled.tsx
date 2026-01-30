import styled from 'styled-components';

export const KeyDetailsContainer = styled.div`
    flex: 1;
`;

export const KeyInfo = styled.div`
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

export const ValueActions = styled.div`
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

export const ValueDisplay = styled.pre`
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

export const KeyActions = styled.div`
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #eee;
`;

export const TTLInfo = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 14px;
`;

export const ActionButtons = styled.div`
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