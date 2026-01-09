import styled from 'styled-components';

export const SearchSection = styled.div`
    margin-bottom: 20px;
`;

export const SearchBar = styled.div`
    display: flex;
    gap: 8px;
    align-items: center;

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
    }
`;