import React from 'react';
import {
    AddKeySection,
    SectionHeader,
    ToggleIcon,
    FormGroup,
    Input,
    Select,
    Textarea,
    ZSetMembersContainer,
    ZSetMemberItem,
    RemoveMemberButton,
    AddMemberButton,
    ParseMembersButton,
    ZSetPasteActions,
    FormActions
} from './AddKeyForm.styled';
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
    zsetRawValue: string;
    onAddZsetMember: () => void;
    onRemoveZsetMember: (index: number) => void;
    onUpdateZsetMember: (
        index: number,
        field: keyof ZSetMember,
        value: string | number
    ) => void;
    onZsetRawValueChange: (value: string) => void;
    onParseZsetRawValue: () => void;
    expiry: string;
    onExpiryChange: (expiry: string) => void;
    onSave: () => void;
    onClear: () => void;
}

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
    zsetRawValue,
    onAddZsetMember,
    onRemoveZsetMember,
    onUpdateZsetMember,
    onZsetRawValueChange,
    onParseZsetRawValue,
    expiry,
    onExpiryChange,
    onSave,
    onClear
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
                                onKeyTypeChange(e.target.value as KeyType)
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
                            <Textarea
                                id="zset-raw-value"
                                value={zsetRawValue}
                                onChange={(e) =>
                                    onZsetRawValueChange(e.target.value)
                                }
                                placeholder="Paste zset value copied from the UI"
                            />
                            <ZSetPasteActions>
                                <ParseMembersButton
                                    type="button"
                                    onClick={onParseZsetRawValue}
                                >
                                    Parse Pasted Value
                                </ParseMembersButton>
                            </ZSetPasteActions>
                            <ZSetMembersContainer id="zset-members">
                                {zsetMembers.map((member, index) => (
                                    <ZSetMemberItem key={index}>
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
                                                onRemoveZsetMember(index)
                                            }
                                            $disabled={zsetMembers.length <= 1}
                                            title="Remove member"
                                        >
                                            ×
                                        </RemoveMemberButton>
                                    </ZSetMemberItem>
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
