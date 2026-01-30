import styled from 'styled-components';

export const SearchSection = styled.div`
    margin-bottom: 20px;
    position: relative;
`;

export const SearchBar = styled.div`
    display: flex;
    gap: 8px;
    align-items: center;
    position: relative;

    input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 14px;
    }

    button {
        padding: 8px 16px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background-color: #f8f9fa;
        cursor: pointer;
        font-size: 14px;

        &:hover:not(:disabled) {
            background-color: #e9ecef;
        }

        &:disabled {
            background-color: #6c757d;
            color: white;
            opacity: 1;
            cursor: not-allowed;
        }

        &.secondary-btn {
            background-color: #6c757d;
            color: white;
            border-color: #6c757d;

            &:hover:not(:disabled) {
                background-color: #5a6268;
            }
        }

        &.search-btn {
            background-color: #f8f9fa;
            color: #333;
            border: 1px solid #ccc;

            &:hover:not(:disabled) {
                background-color: #e9ecef;
            }
        }
    }
`;

export const HistoryButton = styled.button`
    padding: 8px 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background-color: #f8f9fa;
    color: #333;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    min-width: 36px;

    &:hover {
        background-color: #e9ecef;
    }
`;

export const HistoryPopup = styled.div`
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    min-width: 200px;
    max-width: 400px;
    max-height: 300px;
    overflow-y: auto;
`;

export const HistoryList = styled.ul`
    list-style: none;
    margin: 0;
    padding: 4px 0;
`;

export const HistoryItem = styled.li`
    padding: 8px 12px;
    cursor: pointer;
    font-size: 14px;
    word-break: break-word;

    &:hover {
        background-color: #f8f9fa;
    }

    &:active {
        background-color: #e9ecef;
    }
`;

export const EmptyState = styled.div`
    padding: 16px 12px;
    text-align: center;
    color: #6c757d;
    font-size: 14px;
`;
