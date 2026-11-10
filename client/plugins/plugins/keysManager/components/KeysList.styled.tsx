import styled from 'styled-components';

export const KeysListContainer = styled.div`
    flex: 1;
`;

export const KeysResultsList = styled.div<{ $isLoading: boolean }>`
    opacity: ${(props) => (props.$isLoading ? 0.5 : 1)};
    pointer-events: ${(props) => (props.$isLoading ? 'none' : 'auto')};
`;

export const KeyRow = styled.div`
    padding: 8px 12px;
    cursor: pointer;
    border-bottom: 1px solid #eee;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    box-sizing: border-box;

    &:hover {
        background-color: #f8f9fa;
    }

    &.selected {
        background-color: #e3f2fd;
        font-weight: bold;
    }
`;

export const LoadingItem = styled.div`
    text-align: center;
    padding: 20px;
    color: #666;
`;

export const PaginationControls = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #eee;
`;

export const LoadMoreButton = styled.button`
    padding: 8px 16px;
    background-color: #6c757d;
    color: white;
    border: 1px solid #6c757d;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;

    &:hover:not(:disabled) {
        background-color: #5a6268;
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;
