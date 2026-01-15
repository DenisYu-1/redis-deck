import React, { useRef, useEffect } from 'react';
import type { ValueModalData } from '../../utils/types';

// Import the JSON viewer web component
import '@alenaksu/json-viewer';

// Declare the json-viewer custom element for TypeScript
declare global {
    namespace JSX {
        interface IntrinsicElements {
            'json-viewer': any;
        }
    }
}

interface ValueViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    valueModalData: ValueModalData | null;
    onTabChange: (tab: string) => void;
}

export const ValueViewerModal: React.FC<ValueViewerModalProps> = ({
    isOpen,
    onClose,
    valueModalData,
    onTabChange,
}) => {
    const jsonViewerRef = useRef<any>(null);

    useEffect(() => {
        if (
            jsonViewerRef.current &&
            valueModalData?.jsonData &&
            valueModalData.activeTab === 'tree'
        ) {
            jsonViewerRef.current.data = valueModalData.jsonData;
            // Expand all nodes after a short delay
            setTimeout(() => {
                if (jsonViewerRef.current?.expandAll) {
                    jsonViewerRef.current.expandAll();
                }
            }, 100);
        }
    }, [valueModalData]);

    if (!isOpen || !valueModalData) return null;

    return (
        <div className="modal" onClick={onClose}>
            <div
                className="modal-content value-viewer-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <span
                    className="close-modal"
                    onClick={onClose}
                >
                    &times;
                </span>
                <h3>View Value</h3>

                <div className="value-tabs">
                    <button
                        className={`value-tab-btn ${valueModalData.activeTab === 'formatted' ? 'active' : ''}`}
                        onClick={() => onTabChange('formatted')}
                        data-tab="formatted"
                    >
                        Formatted
                    </button>
                    <button
                        className={`value-tab-btn ${valueModalData.activeTab === 'tree' ? 'active' : ''}`}
                        onClick={() => onTabChange('tree')}
                        data-tab="tree"
                        style={{
                            display: valueModalData.hasJson
                                ? 'inline-block'
                                : 'none'
                        }}
                    >
                        Tree View
                    </button>
                </div>

                <div className="value-viewer-container">
                    <pre
                        className={`value-viewer-raw value-tab-content ${valueModalData.activeTab === 'formatted' ? 'active' : ''}`}
                        data-content="formatted"
                    >
                        {valueModalData.formatted}
                    </pre>
                    <json-viewer
                        ref={jsonViewerRef}
                        className={`value-tab-content ${valueModalData.activeTab === 'tree' ? 'active' : ''}`}
                        data-content="tree"
                        style={{
                            display:
                                valueModalData.activeTab === 'tree'
                                    ? 'block'
                                    : 'none'
                        }}
                    />
                </div>
            </div>
        </div>
    );
};