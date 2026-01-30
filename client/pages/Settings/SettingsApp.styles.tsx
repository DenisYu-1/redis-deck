import styled from 'styled-components';

// Layout Components
export const ConnectionsManager = styled.main`
    margin-top: 30px;
`;

export const SettingsSection = styled.section`
    background-color: var(--bg-secondary);
    border-radius: 6px;
    box-shadow: var(--shadow-sm);
    padding: 20px;
    margin-bottom: 20px;
`;

export const SettingItem = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    &:last-child {
        margin-bottom: 0;
    }
`;

export const SettingInfo = styled.div`
    flex: 1;
    margin-right: 20px;

    label {
        display: block;
        font-size: 16px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 5px;
    }

    .description {
        font-size: 14px;
        color: var(--text-secondary);
        margin: 0;
    }
`;

export const SettingControl = styled.div`
    flex-shrink: 0;
`;

// Theme Components
export const ThemeSelector = styled.div`
    display: flex;
    gap: 10px;
`;

export const ThemeOption = styled.button<{ $active?: boolean }>`
    padding: 10px 16px;
    border: 2px solid var(--border-secondary);
    border-radius: 6px;
    background-color: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;

    &:hover {
        border-color: var(--accent-primary);
        background-color: var(--bg-hover);
        color: var(--text-primary);
    }

    ${({ $active }) =>
        $active &&
        `
        border-color: var(--accent-primary);
        background-color: var(--bg-active);
        color: var(--accent-primary);
        font-weight: 600;
    `}
`;

// Connection List Components
export const ConnectionsList = styled.section`
    background-color: var(--bg-secondary);
    border-radius: 6px;
    box-shadow: var(--shadow-sm);
    padding: 20px;
    margin-bottom: 20px;
`;

export const ConnectionCard = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    margin-bottom: 10px;
    background-color: var(--bg-tertiary);
    transition: all 0.2s ease;

    &:hover {
        border-color: var(--accent-primary);
        background-color: var(--bg-hover);
    }

    &:last-child {
        margin-bottom: 0;
    }
`;

export const ConnectionDetails = styled.div`
    flex: 1;

    strong {
        display: block;
        font-size: 16px;
        color: var(--text-primary);
        margin-bottom: 4px;
    }

    div {
        font-size: 0.9em;
        color: var(--text-secondary);
    }
`;

export const ConnectionActions = styled.div`
    display: flex;
    gap: 8px;
`;

// Button Components
export const AddConnectionButton = styled.button`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background-color: var(--button-primary);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-top: 15px;

    &:hover {
        background-color: var(--button-primary-hover);
    }
`;

export const SecondaryButton = styled.button`
    padding: 8px 16px;
    background-color: var(--button-secondary);
    color: var(--button-secondary-text);
    border: 1px solid var(--button-secondary-border);
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
        background-color: var(--button-secondary-hover);
        border-color: var(--button-secondary-border-hover);
    }
`;

export const DangerButton = styled.button`
    padding: 8px 16px;
    background-color: var(--button-danger);
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
        background-color: var(--button-danger-hover);
    }
`;

// Form Components
export const StyledConnectionForm = styled.section`
    background-color: var(--bg-secondary);
    border-radius: 6px;
    box-shadow: var(--shadow-sm);
    padding: 20px;
    margin-top: 20px;
`;

export const EditModeHeader = styled.div`
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid var(--border-primary);

    h3 {
        margin: 0;
        font-size: 18px;
        color: var(--text-heading);
    }
`;

export const FormRow = styled.div`
    display: flex;
    gap: 15px;
    margin-bottom: 15px;

    &:last-child {
        margin-bottom: 0;
    }

    @media (max-width: 768px) {
        flex-direction: column;
        gap: 0;
    }
`;

export const FormGroup = styled.div`
    flex: 1;

    label {
        display: block;
        margin-bottom: 5px;
        font-size: 14px;
        color: var(--text-secondary);
    }

    input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--border-secondary);
        border-radius: 4px;
        font-size: 14px;
        background-color: var(--bg-input);
        color: var(--text-primary);

        &:focus {
            outline: none;
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
        }
    }
`;

export const CheckboxGroup = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 15px;

    input[type='checkbox'] {
        width: 16px;
        height: 16px;
        accent-color: var(--accent-primary);
    }

    label {
        font-size: 14px;
        color: var(--text-primary);
        cursor: pointer;
    }
`;

export const FormActions = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid var(--border-tertiary);
`;
