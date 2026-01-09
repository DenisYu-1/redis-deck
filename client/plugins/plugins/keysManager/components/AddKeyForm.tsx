import React from 'react';
import styled from 'styled-components';
import type { KeyType, ZSetMember } from '../utils/types';

interface AddKeyFormProps {
    isExpanded: boolean;
    onToggleExpanded: () => void;
    keyName: string;
    onKeyNameChange: (name: string) => void;
    keyType: KeyType;
    onKeyTypeChange: (type: KeyType) => void;
    stringValue: string;
    onStringValueChange: (value: string) => void;
    zsetMembers: ZSetMember[];
    onAddZsetMember: () => void;
    onRemoveZsetMember: (index: number) => void;
    onUpdateZsetMember: (index: number, field: keyof ZSetMember, value: string | number) => void;
    expiry: string;
    onExpiryChange: (expiry: string) => void;
    onSave: () => void;
    onClear: () => void;
}

const AddKeySection = styled.section`
    margin-top: 20px;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: #f9f9f9;
`;

const SectionHeader = styled.div<{ $isExpanded: boolean }>`
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

const ToggleIcon = styled.span<{ $isExpanded: boolean }>`
    transform: ${props => props.$isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'};
    transition: transform 0.2s;
    font-size: 12px;
`;

const FormGroup = styled.div`
    margin-bottom: 1rem;

    label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: bold;
    }
`;

const Input = styled.input`
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
`;

const Select = styled.select`
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
`;

const Textarea = styled.textarea`
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
    min-height: 80px;
    resize: vertical;
`;

const ZSetMembersContainer = styled.div`
    margin-bottom: 1rem;
`;

const ZSetMember = styled.div`
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

const RemoveMemberButton = styled.button<{ $disabled: boolean }>`
    padding: 0.5rem;
    background-color: ${props => props.$disabled ? '#ccc' : '#dc3545'};
    color: white;
    border: none;
    border-radius: 4px;
    cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
    font-size: 14px;
    width: 40px;
`;

const AddMemberButton = styled.button`
    padding: 0.5rem 1rem;
    background-color: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
`;

const FormActions = styled.div`
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

export const AddKeyForm: React.FC<AddKeyFormProps> = ({
    isExpanded,
    onToggleExpanded,
    keyName,
    onKeyNameChange,
    keyType,
    onKeyTypeChange,
    stringValue,
    onStringValueChange,
    zsetMembers,
    onAddZsetMember,
    onRemoveZsetMember,
    onUpdateZsetMember,
    expiry,
    onExpiryChange,
    onSave,
    onClear,
}) => {
    return (
        <AddKeySection className="add-key-section">
            <SectionHeader $isExpanded={isExpanded} onClick={onToggleExpanded}>
                <h2>Add/Update Key</h2>
                <ToggleIcon $isExpanded={isExpanded}>▼</ToggleIcon>
            </SectionHeader>

            {isExpanded && (
                <div>
                    <FormGroup>
                        <label htmlFor="new-key">Key:</label>
                        <Input
                            type="text"
                            id="new-key"
                            value={keyName}
                            onChange={(e) => onKeyNameChange(e.target.value)}
                            placeholder="Enter key name"
                        />
                    </FormGroup>

                    <FormGroup>
                        <label htmlFor="key-type">Type:</label>
                        <Select
                            id="key-type"
                            value={keyType}
                            onChange={(e) =>
                                onKeyTypeChange(
                                    e.target.value as KeyType
                                )
                            }
                        >
                            <option value="string">String</option>
                            <option value="zset">Sorted Set (ZSet)</option>
                            <option value="hash">Hash</option>
                            <option value="list">List</option>
                            <option value="set">Set</option>
                        </Select>
                    </FormGroup>

                    {/* String type fields */}
                    {keyType === 'string' && (
                        <FormGroup>
                            <label htmlFor="new-value">Value:</label>
                            <Textarea
                                id="new-value"
                                value={stringValue}
                                onChange={(e) =>
                                    onStringValueChange(e.target.value)
                                }
                                placeholder="Enter value"
                            />
                        </FormGroup>
                    )}

                    {/* ZSet type fields */}
                    {keyType === 'zset' && (
                        <FormGroup>
                            <label>Members (Score-Value pairs):</label>
                            <ZSetMembersContainer id="zset-members">
                                {zsetMembers.map((member, index) => (
                                    <ZSetMember key={index}>
                                        <input
                                            type="number"
                                            className="zset-score"
                                            value={member.score}
                                            onChange={(e) =>
                                                onUpdateZsetMember(
                                                    index,
                                                    'score',
                                                    parseFloat(
                                                        e.target.value
                                                    ) || 0
                                                )
                                            }
                                            placeholder="Score"
                                            step="any"
                                        />
                                        <input
                                            type="text"
                                            className="zset-value"
                                            value={member.value}
                                            onChange={(e) =>
                                                onUpdateZsetMember(
                                                    index,
                                                    'value',
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Value"
                                        />
                                        <RemoveMemberButton
                                            type="button"
                                            className="remove-member-btn"
                                            onClick={() =>
                                                onRemoveZsetMember(
                                                    index
                                                )
                                            }
                                            $disabled={
                                                zsetMembers.length <= 1
                                            }
                                            title="Remove member"
                                        >
                                            ×
                                        </RemoveMemberButton>
                                    </ZSetMember>
                                ))}
                            </ZSetMembersContainer>
                            <AddMemberButton
                                type="button"
                                id="add-zset-member-btn"
                                onClick={onAddZsetMember}
                            >
                                Add Member
                            </AddMemberButton>
                        </FormGroup>
                    )}

                    {/* Common fields */}
                    <FormGroup>
                        <label htmlFor="expiry">
                            Expiry (seconds, optional):
                        </label>
                        <Input
                            type="number"
                            id="expiry"
                            value={expiry}
                            onChange={(e) => onExpiryChange(e.target.value)}
                            placeholder="Leave empty for no expiry"
                        />
                    </FormGroup>

                    <FormActions>
                        <button id="add-key-btn" onClick={onSave}>
                            Save Key
                        </button>
                        <button type="button" onClick={onClear}>
                            Clear
                        </button>
                    </FormActions>
                </div>
            )}
        </AddKeySection>
    );
};