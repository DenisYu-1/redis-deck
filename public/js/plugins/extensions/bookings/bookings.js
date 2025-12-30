import { PluginBase } from '../../PluginBase.js';
import { ComponentHelper } from '../../ComponentHelper.js';
import {
    searchKeys,
    getKeyDetails,
    deleteKey,
    saveKey,
    addToSortedSet
} from '../../../services/apiService.js';
import { showToast } from '../../../utils/domUtils.js';

export default class BookingsPlugin extends PluginBase {
    async init(context) {
        this.context = context;
        await ComponentHelper.injectHTML(
            '/js/plugins/extensions/bookings/view.html',
            this.priority
        );
        this.setupEventListeners();
    }

    setupEventListeners() {
        const addBookingBtn = document.getElementById('add-booking-btn');
        const bookingIdInput = document.getElementById('booking-id');

        if (!addBookingBtn || !bookingIdInput) {
            console.error('Booking plugin elements not found');
            return;
        }

        addBookingBtn.addEventListener('click', () => {
            this.handleAddBooking();
        });

        bookingIdInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                this.handleAddBooking();
            }
        });
    }

    async handleAddBooking() {
        const userIdInput = document.getElementById('booking-id');
        const targetUserId = this.readAndValidateUserId();

        if (!targetUserId) return;

        try {
            const environment = this.context.getCurrentEnvironment();
            const timelinePattern = 'relevant-bookings:timeline:*';
            const allTimelineKeys = await this.fetchAllKeys(
                timelinePattern,
                environment,
                1000
            );

            if (!allTimelineKeys || allTimelineKeys.length === 0) {
                showToast('No relevant timeline bookings found', 'error');
                return;
            }

            let validTimelineKey = null;
            let sourceUserId = null;

            for (const timelineKey of allTimelineKeys) {
                try {
                    const timelineDetails = await getKeyDetails(
                        timelineKey,
                        environment
                    );
                    if (
                        this.hasValidBookingsInTimeframe(
                            timelineDetails,
                            timelineKey
                        )
                    ) {
                        validTimelineKey = timelineKey;
                        const parts = timelineKey.split(':');
                        sourceUserId = parts[parts.length - 1];
                        break;
                    }
                } catch (error) {
                    console.error(
                        `Failed to check timeline ${timelineKey}:`,
                        error
                    );
                    continue;
                }
            }

            if (!validTimelineKey || !sourceUserId) {
                showToast(
                    'No timeline found with bookings in valid timeframe (-14 to +90 days)',
                    'error'
                );
                return;
            }

            const timelineKey = validTimelineKey;

            const timelineDetails = await getKeyDetails(
                timelineKey,
                environment
            );
            if (!timelineDetails || timelineDetails.value === undefined) {
                showToast(
                    'Failed to read timeline content for booking ID extraction',
                    'error'
                );
                return;
            }

            const bookingIds = this.extractBookingIdsFromTimeline(
                timelineDetails.value
            );

            if (!bookingIds.length) {
                showToast(
                    `No booking IDs found in timeline for user ${sourceUserId}`,
                    'error'
                );
                return;
            }

            const dataKeys = bookingIds.map(
                (bookingId) =>
                    `relevant-bookings:data:${sourceUserId}:${bookingId}`
            );

            const newTimelineKey = `relevant-bookings:timeline:${targetUserId}`;

            if (await this.keyExists(newTimelineKey, environment)) {
                await deleteKey(newTimelineKey, environment);
            }

            const timelineTtl =
                typeof timelineDetails.ttl === 'number'
                    ? timelineDetails.ttl
                    : -1;

            let members = [];
            if (timelineDetails.value) {
                try {
                    if (
                        typeof timelineDetails.value === 'string' &&
                        timelineDetails.value.trim().startsWith('[')
                    ) {
                        const parsedValue = JSON.parse(timelineDetails.value);
                        if (Array.isArray(parsedValue)) {
                            members = parsedValue.filter(
                                (item) =>
                                    typeof item === 'object' &&
                                    typeof item.score === 'number' &&
                                    item.value !== undefined
                            );
                        }
                    } else if (Array.isArray(timelineDetails.value)) {
                        members = timelineDetails.value.filter(
                            (item) =>
                                typeof item === 'object' &&
                                typeof item.score === 'number' &&
                                item.value !== undefined
                        );
                    } else {
                        members = [
                            {
                                score: Math.floor(Date.now() / 1000),
                                value: String(timelineDetails.value)
                            }
                        ];
                    }
                } catch {
                    console.error(
                        'Failed to parse timeline value, using as single member:',
                        e
                    );
                    members = [
                        {
                            score: Math.floor(Date.now() / 1000),
                            value: String(timelineDetails.value)
                        }
                    ];
                }
            }

            if (members.length === 0) {
                members = [
                    {
                        score: Math.floor(Date.now() / 1000),
                        value: `timeline-${targetUserId}`
                    }
                ];
            }

            await addToSortedSet(
                newTimelineKey,
                members,
                timelineTtl > 0 ? timelineTtl : undefined,
                environment
            );

            let copiedCount = 0;

            for (let i = 0; i < dataKeys.length; i++) {
                const dataKey = dataKeys[i];
                try {
                    if (!(await this.keyExists(dataKey, environment))) {
                        continue;
                    }

                    const dataDetails = await getKeyDetails(
                        dataKey,
                        environment
                    );
                    if (!dataDetails || dataDetails.value === undefined) {
                        continue;
                    }

                    const dataParts = dataKey.split(':');
                    const bookingId = dataParts[dataParts.length - 1];
                    const newDataKey = `relevant-bookings:data:${targetUserId}:${bookingId}`;

                    if (await this.keyExists(newDataKey, environment)) {
                        await deleteKey(newDataKey, environment);
                    }

                    const dataTtl =
                        typeof dataDetails.ttl === 'number'
                            ? dataDetails.ttl
                            : -1;
                    await saveKey(
                        newDataKey,
                        dataDetails.value,
                        dataTtl > 0 ? dataTtl : undefined,
                        environment
                    );
                    copiedCount += 1;
                } catch (dataKeyError) {
                    console.error(
                        `Error processing data key ${dataKey}:`,
                        dataKeyError
                    );
                }
            }

            if (copiedCount === 0) {
                showToast(
                    `Warning: No booking data keys were copied for ${targetUserId}`,
                    'warning'
                );
            } else {
                showToast(
                    `Successfully added booking for ${targetUserId}. Copied ${copiedCount} booking data key(s).`,
                    'success'
                );
            }

            userIdInput.value = '';
            if (this.context.onOperationComplete) {
                this.context.onOperationComplete();
            }
        } catch (error) {
            showToast(error.message, 'error');
            console.error('Error adding booking:', error);
        }
    }

    readAndValidateUserId() {
        const userIdInput = document.getElementById('booking-id');
        const userId = userIdInput.value.trim();
        if (!userId) {
            showToast('Please enter a user ID', 'error');
            return null;
        }
        if (!/\d/.test(userId)) {
            showToast('User ID must contain at least one number', 'error');
            return null;
        }
        return userId;
    }

    extractBookingIdsFromTimeline(timelineValue) {
        const bookingIds = [];

        if (typeof timelineValue !== 'string') {
            return bookingIds;
        }

        const value = timelineValue.trim();

        const lines = value.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            if (trimmedLine.includes(':')) {
                const parts = trimmedLine.split(':');
                if (parts.length >= 2) {
                    const bookingId = parts[0];
                    if (bookingId && !bookingIds.includes(bookingId)) {
                        bookingIds.push(bookingId);
                    }
                }
            }
        }

        return bookingIds;
    }

    hasValidBookingsInTimeframe(timelineDetails, timelineKey = 'unknown') {
        if (!timelineDetails || timelineDetails.value === undefined) {
            return false;
        }

        const now = Date.now();
        const timeframeStart = this.config.timeframeStart || -14;
        const timeframeEnd = this.config.timeframeEnd || 90;
        const fourteenDaysAgo = now + timeframeStart * 24 * 60 * 60 * 1000;
        const ninetyDaysFromNow = now + timeframeEnd * 24 * 60 * 60 * 1000;

        let timestamps = [];

        try {
            if (typeof timelineDetails.value === 'string') {
                const value = timelineDetails.value.trim();

                const lines = value.split('\n');

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;

                    if (trimmedLine.includes(':')) {
                        const parts = trimmedLine.split(':');
                        const score = parts[parts.length - 1];
                        const scoreNum = parseInt(score, 10);
                        if (
                            !isNaN(scoreNum) &&
                            scoreNum >= 946684800 &&
                            scoreNum <= 4102444800
                        ) {
                            timestamps.push(scoreNum);
                        }
                    } else {
                        const scoreNum = parseInt(trimmedLine, 10);
                        if (
                            !isNaN(scoreNum) &&
                            scoreNum >= 946684800 &&
                            scoreNum <= 4102444800
                        ) {
                            timestamps.push(scoreNum);
                        }
                    }
                }
            } else if (Array.isArray(timelineDetails.value)) {
                timestamps = timelineDetails.value
                    .filter(
                        (item) =>
                            typeof item === 'object' &&
                            typeof item.score === 'number'
                    )
                    .map((item) => item.score);
            }

            const validTimestamps = timestamps.filter((timestamp) => {
                const timestampInMs = timestamp * 1000;
                const isValid =
                    timestampInMs >= fourteenDaysAgo &&
                    timestampInMs <= ninetyDaysFromNow;
                return isValid;
            });

            return validTimestamps.length > 0;
        } catch {
            console.error(
                `Failed to parse timeline value for timeframe check (${timelineKey}):`,
                e
            );
            return false;
        }
    }

    async keyExists(key, environment) {
        try {
            await getKeyDetails(key, environment);
            return true;
        } catch {
            return false;
        }
    }

    async fetchAllKeys(pattern, environment, count = 200) {
        const collected = [];
        let cursor = '0';
        do {
            const result = await searchKeys(
                pattern,
                cursor,
                count,
                environment
            );
            if (result.keys && result.keys.length) {
                collected.push(...result.keys);
            }
            cursor = result.cursor || '0';
        } while (cursor !== '0');
        return collected;
    }

    async destroy() {}
}
