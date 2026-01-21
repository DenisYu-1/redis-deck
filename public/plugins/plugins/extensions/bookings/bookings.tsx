import React, { useState } from 'react';
import type { PluginComponentProps } from '../../../client/plugins/types';

const BookingsPlugin: React.FC<PluginComponentProps> = ({ context, emit, on }) => {
    const [bookingId, setBookingId] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    const handleAddBooking = () => {
        if (!bookingId.trim()) {
            emit({
                type: 'toast:show',
                payload: { message: 'Please enter a booking ID', type: 'error' },
                source: 'bookings'
            });
            return;
        }

        emit({
            type: 'toast:show',
            payload: {
                message: `Booking functionality is under development. ID: ${bookingId}`,
                type: 'info'
            },
            source: 'bookings'
        });

        setBookingId('');
    };

    return (
        <div className="bookings-plugin" style={{
            margin: '1rem 0',
            padding: '1rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: '#f0f8ff'
        }}>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    marginBottom: isExpanded ? '1rem' : '0'
                }}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <h4 style={{ margin: '0', color: '#2e5c8a' }}>Booking Manager</h4>
                <span style={{
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                    fontSize: '12px'
                }}>
                    ▼
                </span>
            </div>

            {isExpanded && (
                <div>
                    <p style={{ color: '#666', margin: '0 0 0.5rem 0', fontSize: '14px' }}>
                        Manage Redis-based booking operations:
                    </p>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="Enter booking ID"
                            value={bookingId}
                            onChange={(e) => setBookingId(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handleAddBooking();
                                }
                            }}
                            style={{
                                flex: 1,
                                padding: '0.5rem',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                fontSize: '14px'
                            }}
                        />
                        <button
                            onClick={handleAddBooking}
                            disabled={!bookingId.trim()}
                            style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: bookingId.trim() ? '#28a745' : '#ccc',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: bookingId.trim() ? 'pointer' : 'not-allowed',
                                fontSize: '14px'
                            }}
                        >
                            Add Booking
                        </button>
                    </div>

                    <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '4px' }}>
                        <small style={{ color: '#856404' }}>
                            <strong>Note:</strong> This plugin is currently under development.
                            Full booking management functionality will be available soon.
                        </small>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookingsPlugin;
