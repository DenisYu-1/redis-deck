import styled from 'styled-components';

export const AddKeySection = styled.section`
    margin-top: 20px;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: #f9f9f9;
`;

export const SectionHeader = styled.div<{ $isExpanded: boolean }>`
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    margin-bottom: ${props => props.$isExpanded ? '1rem' : '0'};

    h2 {
        margin: 0;
        font-size: 18px;
    }
`;

export const ToggleIcon = styled.span<{ $isExpanded: boolean }>`
    transform: ${props => props.$isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'};
    transition: transform 0.2s;
    font-size: 12px;
`;

export const FormGroup = styled.div`
    margin-bottom: 1rem;

    label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: bold;
    }
`;

export const Input = styled.input`
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
`;

export const Select = styled.select`
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
`;

export const Textarea = styled.textarea`
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
    min-height: 80px;
    resize: vertical;
`;

export const ZSetMembersContainer = styled.div`
    margin-bottom: 1rem;
`;

export const ZSetMemberItem = styled.div`
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.5rem;

    input {
        flex: 1;
        padding: 0.5rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 14px;

        &:first-child {
            flex: 1;
        }

        &:nth-child(2) {
            flex: 2;
        }
    }
`;

export const RemoveMemberButton = styled.button<{ $disabled: boolean }>`
    padding: 0.5rem;
    background-color: ${props => props.$disabled ? '#ccc' : '#dc3545'};
    color: white;
    border: none;
    border-radius: 4px;
    cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
    font-size: 14px;
    width: 40px;
`;

export const AddMemberButton = styled.button`
    padding: 0.5rem 1rem;
    background-color: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
`;

export const FormActions = styled.div`
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;

    button {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;

        &:first-child {
            background-color: #007bff;
            color: white;
        }

        &:last-child {
            background-color: #6c757d;
            color: white;
        }
    }
`;