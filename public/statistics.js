import { showToast } from './js/utils/domUtils.js';

let currentEnvironment = null;
let currentTimeRange = 24;
let memoryChart = null;
let keysChart = null;
let hitRateChart = null;
let opsChart = null;
let networkChart = null;
let patternPieChart = null;
let autoRefreshInterval = null;

async function init() {
    await loadEnvironments();
    setupEventListeners();

    if (currentEnvironment) {
        await loadRealtimeStats();
        await loadHistoricalData();
        await loadCommandStats();
        await loadSlowlog();
        startAutoRefresh();
    }
}

async function loadEnvironments() {
    try {
        const response = await fetch('/api/connections');
        const data = await response.json();
        const connections = data.connections || [];

        const select = document.getElementById('environment-select');
        select.innerHTML = '';

        if (connections.length === 0) {
            select.innerHTML = '<option value="">No connections</option>';
            return;
        }

        connections.forEach((conn) => {
            const option = document.createElement('option');
            option.value = conn.id;
            option.textContent = conn.id;
            select.appendChild(option);
        });

        currentEnvironment = connections[0].id;
        select.value = currentEnvironment;
    } catch (error) {
        console.error('Error loading environments:', error);
        showToast('Failed to load connections', 'error');
    }
}

function setupEventListeners() {
    const envSelect = document.getElementById('environment-select');
    envSelect.addEventListener('change', async (e) => {
        currentEnvironment = e.target.value;
        resetAllData();
        await loadRealtimeStats();
        await loadHistoricalData();
        await loadCommandStats();
        await loadSlowlog();
    });

    const refreshBtn = document.getElementById('refresh-stats-btn');
    refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        await loadRealtimeStats();
        await loadHistoricalData();
        await loadCommandStats();
        await loadSlowlog();
        refreshBtn.disabled = false;
    });

    const snapshotBtn = document.getElementById('trigger-snapshot-btn');
    snapshotBtn.addEventListener('click', async () => {
        snapshotBtn.disabled = true;
        await triggerSnapshot();
        snapshotBtn.disabled = false;
    });

    const timeRangeBtns = document.querySelectorAll('.time-range-btn');
    timeRangeBtns.forEach((btn) => {
        btn.addEventListener('click', async () => {
            timeRangeBtns.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            currentTimeRange = parseInt(btn.dataset.hours);
            await loadHistoricalData();
        });
    });

    const analyzeCountsBtn = document.getElementById('analyze-counts-btn');
    analyzeCountsBtn.addEventListener('click', async () => {
        await analyzeMemoryPatterns(true);
    });

    const analyzeMemoryBtn = document.getElementById('analyze-memory-btn');
    analyzeMemoryBtn.addEventListener('click', async () => {
        await analyzeMemoryPatterns(false);
    });
}

async function loadRealtimeStats() {
    try {
        const response = await fetch(
            `/api/stats/realtime?env=${encodeURIComponent(currentEnvironment)}`
        );
        const data = await response.json();

        document.getElementById('metric-memory').textContent =
            data.memory.used_human || '-';

        const maxMemory = data.memory.max || 0;
        const usedMemory = data.memory.used || 0;

        let subtitle = `Peak: ${data.memory.peak_human || 'N/A'}`;
        let percentage = 0;

        if (maxMemory > 0) {
            percentage = (usedMemory / maxMemory) * 100;
            subtitle += ` | Max: ${data.memory.max_human || 'N/A'} (${percentage.toFixed(1)}%)`;

            const progressBar = document.getElementById('memory-progress');
            progressBar.style.width = `${Math.min(percentage, 100)}%`;

            if (percentage > 90) {
                progressBar.style.background =
                    'linear-gradient(90deg, #e74c3c, #c0392b)';
            } else if (percentage > 75) {
                progressBar.style.background =
                    'linear-gradient(90deg, #f39c12, #e67e22)';
            } else {
                progressBar.style.background =
                    'linear-gradient(90deg, #3498db, #2980b9)';
            }
        } else {
            subtitle += ' | Max: Not set';
            document.getElementById('memory-progress').style.width = '0%';
        }

        document.getElementById('metric-memory-subtitle').textContent =
            subtitle;

        let totalKeys = 0;
        if (data.keyspace) {
            for (const db in data.keyspace) {
                const match = data.keyspace[db].match(/keys=(\d+)/);
                if (match) {
                    totalKeys += parseInt(match[1]);
                }
            }
        }

        document.getElementById('metric-keys').textContent =
            totalKeys.toLocaleString();

        const hits = data.stats.keyspace_hits || 0;
        const misses = data.stats.keyspace_misses || 0;
        const total = hits + misses;
        const hitRate = total > 0 ? ((hits / total) * 100).toFixed(2) : 0;
        document.getElementById('metric-hitrate').textContent = `${hitRate}%`;
        document.getElementById('metric-hitrate-subtitle').textContent =
            `${hits.toLocaleString()} hits / ${misses.toLocaleString()} misses`;

        document.getElementById('metric-clients').textContent =
            data.clients.connected || 0;
        document.getElementById('metric-evictions').textContent = (
            data.stats.evicted_keys || 0
        ).toLocaleString();

        const fragRatio = data.memory.fragmentation || 0;
        document.getElementById('metric-fragmentation').textContent =
            fragRatio.toFixed(2);
        document.getElementById('metric-fragmentation-subtitle').textContent =
            fragRatio > 1.5
                ? '⚠️ High fragmentation'
                : fragRatio < 1
                  ? '⚠️ Low ratio (swapping?)'
                  : '✓ Healthy';

        document.getElementById('metric-ops').textContent = (
            data.stats.ops_per_sec || 0
        ).toLocaleString();
        document.getElementById('metric-ops-subtitle').textContent =
            data.stats.ops_per_sec > 1000
                ? 'High load'
                : data.stats.ops_per_sec > 100
                  ? 'Moderate'
                  : 'Low activity';

        const cpuTotal =
            (data.cpu.used_cpu_sys || 0) + (data.cpu.used_cpu_user || 0);
        document.getElementById('metric-cpu').textContent =
            cpuTotal.toFixed(2) + 's';
        document.getElementById('metric-cpu-subtitle').textContent =
            `Sys: ${(data.cpu.used_cpu_sys || 0).toFixed(2)}s | User: ${(data.cpu.used_cpu_user || 0).toFixed(2)}s`;

        const totalNet =
            (data.stats.total_net_input_bytes || 0) +
            (data.stats.total_net_output_bytes || 0);
        const netGB = totalNet / 1024 / 1024 / 1024;
        document.getElementById('metric-network').textContent =
            netGB > 1
                ? netGB.toFixed(2) + ' GB'
                : (totalNet / 1024 / 1024).toFixed(2) + ' MB';
        document.getElementById('metric-network-subtitle').textContent =
            `In: ${((data.stats.total_net_input_bytes || 0) / 1024 / 1024).toFixed(0)}MB | Out: ${((data.stats.total_net_output_bytes || 0) / 1024 / 1024).toFixed(0)}MB`;

        const totalConns = data.stats.total_connections_received || 0;
        const rejectedConns = data.stats.rejected_connections || 0;
        document.getElementById('metric-total-conns').textContent =
            totalConns.toLocaleString();
        document.getElementById('metric-total-conns-subtitle').textContent =
            rejectedConns > 0
                ? `⚠️ ${rejectedConns} rejected`
                : '✓ None rejected';

        const keysWithTTL = data.ttl_stats.keys_with_ttl || 0;
        const keysWithoutTTL = data.ttl_stats.keys_without_ttl || 0;
        const totalKeysForTTL = keysWithTTL + keysWithoutTTL;
        const ttlPercentage =
            totalKeysForTTL > 0
                ? ((keysWithTTL / totalKeysForTTL) * 100).toFixed(1)
                : 0;
        document.getElementById('metric-ttl').textContent =
            keysWithTTL.toLocaleString();
        document.getElementById('metric-ttl-subtitle').textContent =
            `${ttlPercentage}% have TTL | ${keysWithoutTTL.toLocaleString()} without`;
    } catch (error) {
        console.error('Error loading realtime stats:', error);
        showToast('Failed to load realtime statistics', 'error');
    }
}

async function loadHistoricalData() {
    try {
        document
            .getElementById('memory-chart-loading')
            .classList.remove('hidden');
        document
            .getElementById('keys-chart-loading')
            .classList.remove('hidden');
        document
            .getElementById('hitrate-chart-loading')
            .classList.remove('hidden');
        document.getElementById('ops-chart-loading').classList.remove('hidden');
        document
            .getElementById('network-chart-loading')
            .classList.remove('hidden');

        const response = await fetch(
            `/api/stats/history?env=${encodeURIComponent(currentEnvironment)}&hours=${currentTimeRange}`
        );
        const result = await response.json();

        if (!result.data || result.data.length === 0) {
            showToast(
                'No historical data available yet. Data will be collected over time.',
                'warning'
            );
            document.getElementById('memory-chart-loading').textContent =
                'No data available yet';
            document.getElementById('keys-chart-loading').textContent =
                'No data available yet';
            document.getElementById('hitrate-chart-loading').textContent =
                'No data available yet';
            document.getElementById('ops-chart-loading').textContent =
                'No data available yet';
            document.getElementById('network-chart-loading').textContent =
                'No data available yet';
            return;
        }

        renderMemoryChart(result.data);
        renderKeysChart(result.data);
        renderHitRateChart(result.data);
        renderOpsChart(result.data);
        renderNetworkChart(result.data);

        document.getElementById('memory-chart-loading').classList.add('hidden');
        document.getElementById('keys-chart-loading').classList.add('hidden');
        document
            .getElementById('hitrate-chart-loading')
            .classList.add('hidden');
        document.getElementById('ops-chart-loading').classList.add('hidden');
        document
            .getElementById('network-chart-loading')
            .classList.add('hidden');
    } catch (error) {
        console.error('Error loading historical data:', error);
        showToast('Failed to load historical data', 'error');
    }
}

function renderMemoryChart(data) {
    const ctx = document.getElementById('memoryChart');
    const isDarkTheme =
        document.documentElement.classList.contains('dark-theme');

    const labels = data.map((d) => {
        const date = new Date(d.timestamp * 1000);
        if (currentTimeRange <= 24) {
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit'
            });
        }
    });

    const memoryDataMB = data.map((d) =>
        (d.used_memory / 1024 / 1024).toFixed(2)
    );
    const peakDataMB = data.map((d) =>
        (d.used_memory_peak / 1024 / 1024).toFixed(2)
    );

    if (memoryChart) {
        memoryChart.destroy();
    }

    memoryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Used Memory (MB)',
                    data: memoryDataMB,
                    borderColor: 'rgb(52, 152, 219)',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 2,
                    pointHoverRadius: 5
                },
                {
                    label: 'Peak Memory (MB)',
                    data: peakDataMB,
                    borderColor: 'rgb(231, 76, 60)',
                    backgroundColor: 'rgba(231, 76, 60, 0.05)',
                    tension: 0.4,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: {
                        color: isDarkTheme ? '#e0e0e0' : '#333333'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `${context.dataset.label}: ${context.parsed.y} MB`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: isDarkTheme ? '#b0b0b0' : '#555555',
                        callback: function (value) {
                            return value + ' MB';
                        }
                    },
                    grid: {
                        color: isDarkTheme ? '#3a3a3a' : '#e0e0e0'
                    }
                },
                x: {
                    ticks: {
                        color: isDarkTheme ? '#b0b0b0' : '#555555',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        color: isDarkTheme ? '#3a3a3a' : '#e0e0e0'
                    }
                }
            }
        }
    });
}

function renderKeysChart(data) {
    const ctx = document.getElementById('keysChart');
    const isDarkTheme =
        document.documentElement.classList.contains('dark-theme');

    const labels = data.map((d) => {
        const date = new Date(d.timestamp * 1000);
        if (currentTimeRange <= 24) {
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit'
            });
        }
    });

    const keysData = data.map((d) => d.total_keys || 0);

    if (keysChart) {
        keysChart.destroy();
    }

    keysChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Total Keys',
                    data: keysData,
                    borderColor: 'rgb(39, 174, 96)',
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: {
                        color: isDarkTheme ? '#e0e0e0' : '#333333'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: isDarkTheme ? '#b0b0b0' : '#555555',
                        callback: function (value) {
                            return value.toLocaleString();
                        }
                    },
                    grid: {
                        color: isDarkTheme ? '#3a3a3a' : '#e0e0e0'
                    }
                },
                x: {
                    ticks: {
                        color: isDarkTheme ? '#b0b0b0' : '#555555',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        color: isDarkTheme ? '#3a3a3a' : '#e0e0e0'
                    }
                }
            }
        }
    });
}

function renderHitRateChart(data) {
    const ctx = document.getElementById('hitRateChart');
    const isDarkTheme =
        document.documentElement.classList.contains('dark-theme');

    const labels = data.map((d) => {
        const date = new Date(d.timestamp * 1000);
        if (currentTimeRange <= 24) {
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit'
            });
        }
    });

    const hitRateData = data.map((d, index) => {
        if (index === 0) return 0;

        const prevHits = data[index - 1].keyspace_hits || 0;
        const prevMisses = data[index - 1].keyspace_misses || 0;
        const currHits = d.keyspace_hits || 0;
        const currMisses = d.keyspace_misses || 0;

        const deltaHits = currHits - prevHits;
        const deltaMisses = currMisses - prevMisses;
        const deltaTotal = deltaHits + deltaMisses;

        if (deltaTotal === 0) return 0;
        return ((deltaHits / deltaTotal) * 100).toFixed(2);
    });

    if (hitRateChart) {
        hitRateChart.destroy();
    }

    hitRateChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Hit Rate (%)',
                    data: hitRateData,
                    borderColor: 'rgb(155, 89, 182)',
                    backgroundColor: 'rgba(155, 89, 182, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: {
                        color: isDarkTheme ? '#e0e0e0' : '#333333'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Hit Rate: ${context.parsed.y}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: isDarkTheme ? '#b0b0b0' : '#555555',
                        callback: function (value) {
                            return value + '%';
                        }
                    },
                    grid: {
                        color: isDarkTheme ? '#3a3a3a' : '#e0e0e0'
                    }
                },
                x: {
                    ticks: {
                        color: isDarkTheme ? '#b0b0b0' : '#555555',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        color: isDarkTheme ? '#3a3a3a' : '#e0e0e0'
                    }
                }
            }
        }
    });
}

async function triggerSnapshot() {
    try {
        const response = await fetch(
            `/api/stats/snapshot?env=${encodeURIComponent(currentEnvironment)}`,
            { method: 'POST' }
        );

        if (!response.ok) throw new Error('Failed to trigger snapshot');

        showToast('Snapshot created successfully', 'success');
        await loadHistoricalData();
    } catch (error) {
        console.error('Error triggering snapshot:', error);
        showToast('Failed to create snapshot', 'error');
    }
}

function renderOpsChart(data) {
    const ctx = document.getElementById('opsChart');
    const isDarkTheme =
        document.documentElement.classList.contains('dark-theme');

    const labels = data.map((d) => {
        const date = new Date(d.timestamp * 1000);
        if (currentTimeRange <= 24) {
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit'
            });
        }
    });

    const opsData = data.map((d) => d.ops_per_sec || 0);

    if (opsChart) {
        opsChart.destroy();
    }

    opsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Operations/sec',
                    data: opsData,
                    borderColor: 'rgb(241, 196, 15)',
                    backgroundColor: 'rgba(241, 196, 15, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: {
                        color: isDarkTheme ? '#e0e0e0' : '#333333'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: isDarkTheme ? '#b0b0b0' : '#555555',
                        callback: function (value) {
                            return value.toLocaleString();
                        }
                    },
                    grid: {
                        color: isDarkTheme ? '#3a3a3a' : '#e0e0e0'
                    }
                },
                x: {
                    ticks: {
                        color: isDarkTheme ? '#b0b0b0' : '#555555',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        color: isDarkTheme ? '#3a3a3a' : '#e0e0e0'
                    }
                }
            }
        }
    });
}

function renderNetworkChart(data) {
    const ctx = document.getElementById('networkChart');
    const isDarkTheme =
        document.documentElement.classList.contains('dark-theme');

    const labels = data.map((d) => {
        const date = new Date(d.timestamp * 1000);
        if (currentTimeRange <= 24) {
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit'
            });
        }
    });

    const inputDataMB = data.map((d) =>
        ((d.total_net_input_bytes || 0) / 1024 / 1024).toFixed(2)
    );
    const outputDataMB = data.map((d) =>
        ((d.total_net_output_bytes || 0) / 1024 / 1024).toFixed(2)
    );

    if (networkChart) {
        networkChart.destroy();
    }

    networkChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Input (MB)',
                    data: inputDataMB,
                    borderColor: 'rgb(52, 152, 219)',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 2,
                    pointHoverRadius: 5
                },
                {
                    label: 'Output (MB)',
                    data: outputDataMB,
                    borderColor: 'rgb(230, 126, 34)',
                    backgroundColor: 'rgba(230, 126, 34, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: {
                        color: isDarkTheme ? '#e0e0e0' : '#333333'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `${context.dataset.label}: ${context.parsed.y} MB`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: isDarkTheme ? '#b0b0b0' : '#555555',
                        callback: function (value) {
                            return value + ' MB';
                        }
                    },
                    grid: {
                        color: isDarkTheme ? '#3a3a3a' : '#e0e0e0'
                    }
                },
                x: {
                    ticks: {
                        color: isDarkTheme ? '#b0b0b0' : '#555555',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        color: isDarkTheme ? '#3a3a3a' : '#e0e0e0'
                    }
                }
            }
        }
    });
}

async function loadCommandStats() {
    try {
        const response = await fetch(
            `/api/stats/commandstats?env=${encodeURIComponent(currentEnvironment)}`
        );
        const data = await response.json();

        const table = document.getElementById('command-stats-table');
        const timeframeEl = document.getElementById('command-stats-timeframe');

        if (!data.commands || data.commands.length === 0) {
            table.innerHTML =
                '<tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--text-secondary);">No command statistics available</td></tr>';
            timeframeEl.textContent = 'No data';
            return;
        }

        const uptimeDays = parseFloat(data.uptime_days);
        const uptimeHours = (data.uptime_seconds / 3600).toFixed(1);

        let timeframeText = 'Since Redis start: ';
        if (uptimeDays >= 1) {
            timeframeText += `${uptimeDays} days`;
        } else {
            timeframeText += `${uptimeHours} hours`;
        }
        timeframeEl.textContent = timeframeText;

        table.innerHTML = data.commands
            .map((cmd) => {
                const callsPerSec = cmd.calls_per_sec.toFixed(2);
                const rateColor =
                    cmd.calls_per_sec > 100
                        ? 'var(--accent-danger)'
                        : cmd.calls_per_sec > 10
                          ? 'var(--accent-warning)'
                          : 'var(--text-primary)';

                return `
                <tr style="border-bottom: 1px solid var(--border-primary);">
                    <td style="padding: 12px; font-weight: 600; color: var(--text-primary);">${cmd.command.toUpperCase()}</td>
                    <td style="padding: 12px; color: var(--text-primary);">${cmd.calls.toLocaleString()}</td>
                    <td style="padding: 12px; color: ${rateColor}; font-weight: 500;">${callsPerSec}</td>
                    <td style="padding: 12px; color: var(--text-primary);">${(cmd.usec / 1000).toFixed(2)}</td>
                    <td style="padding: 12px; color: var(--text-primary);">${cmd.usec_per_call.toFixed(2)}</td>
                </tr>
            `;
            })
            .join('');
    } catch (error) {
        console.error('Error loading command stats:', error);
        document.getElementById('command-stats-table').innerHTML =
            '<tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--accent-danger);">Failed to load command statistics</td></tr>';
        document.getElementById('command-stats-timeframe').textContent =
            'Error loading';
    }
}

async function loadSlowlog() {
    try {
        const response = await fetch(
            `/api/stats/slowlog?env=${encodeURIComponent(currentEnvironment)}&count=10`
        );
        const data = await response.json();

        const table = document.getElementById('slowlog-table');

        if (!data.slowlog || data.slowlog.length === 0) {
            table.innerHTML =
                '<tr><td colspan="4" style="padding: 20px; text-align: center; color: var(--text-secondary);">No slow queries logged</td></tr>';
            return;
        }

        table.innerHTML = data.slowlog
            .map((entry) => {
                const date = new Date(entry.timestamp * 1000);
                const timeStr = date.toLocaleString();
                const durationMs = (entry.duration_us / 1000).toFixed(2);
                const durationColor =
                    entry.duration_us > 100000
                        ? 'var(--accent-danger)'
                        : entry.duration_us > 10000
                          ? 'var(--accent-warning)'
                          : 'var(--text-primary)';

                return `
                <tr style="border-bottom: 1px solid var(--border-primary);">
                    <td style="padding: 12px; color: var(--text-secondary);">${entry.id}</td>
                    <td style="padding: 12px; color: var(--text-secondary); font-size: 0.9em;">${timeStr}</td>
                    <td style="padding: 12px; color: ${durationColor}; font-weight: 600;">${durationMs}</td>
                    <td style="padding: 12px; font-family: monospace; font-size: 0.9em; color: var(--text-primary); max-width: 500px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${entry.command}</td>
                </tr>
            `;
            })
            .join('');
    } catch (error) {
        console.error('Error loading slowlog:', error);
        document.getElementById('slowlog-table').innerHTML =
            '<tr><td colspan="4" style="padding: 20px; text-align: center; color: var(--accent-danger);">Failed to load slow queries</td></tr>';
    }
}

async function analyzeMemoryPatterns(fastMode = true) {
    try {
        const analyzeCountsBtn = document.getElementById('analyze-counts-btn');
        const analyzeMemoryBtn = document.getElementById('analyze-memory-btn');
        const loadingEl = document.getElementById('pattern-analysis-loading');
        const resultsEl = document.getElementById('pattern-analysis-results');
        const infoEl = document.getElementById('pattern-analysis-info');
        const statusEl = document.getElementById('analysis-status');
        const substatusEl = document.getElementById('analysis-substatus');
        const progressBar = document.getElementById('analysis-progress-bar');

        analyzeCountsBtn.disabled = true;
        analyzeMemoryBtn.disabled = true;
        loadingEl.style.display = 'block';
        resultsEl.style.display = 'none';

        const sampleSizeSelect = document.getElementById('sample-size-select');
        const sampleSize = parseInt(sampleSizeSelect.value);

        statusEl.textContent = fastMode
            ? 'Scanning keys...'
            : 'Scanning keys and calculating memory...';
        substatusEl.textContent = `Analyzing ${sampleSize} keys (${fastMode ? 'count only' : 'with memory usage'})`;
        progressBar.style.width = '20%';

        const startTime = Date.now();

        const response = await fetch(
            `/api/stats/memory-by-pattern?env=${encodeURIComponent(currentEnvironment)}&sample=${sampleSize}&fast=${fastMode}`
        );
        const data = await response.json();

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (!fastMode) {
            progressBar.style.width = '100%';
        }

        if (!data.patterns || data.patterns.length === 0) {
            infoEl.textContent = 'No patterns found';
            loadingEl.style.display = 'none';
            analyzeCountsBtn.disabled = false;
            analyzeMemoryBtn.disabled = false;
            showToast('No key patterns found to analyze', 'warning');
            return;
        }

        const modeText = fastMode ? ' (by count)' : ' (with memory)';
        infoEl.textContent = `Analyzed ${data.sampled_keys.toLocaleString()} of ${data.total_keys.toLocaleString()} keys in ${elapsed}s${modeText}`;

        renderPatternPieChart(data.patterns, fastMode);
        renderPatternSummary(data.patterns, data.total_memory, fastMode);
        renderPatternTable(data.patterns, fastMode);

        loadingEl.style.display = 'none';
        resultsEl.style.display = 'block';
        analyzeCountsBtn.disabled = false;
        analyzeMemoryBtn.disabled = false;

        showToast(`Pattern analysis complete in ${elapsed}s`, 'success');
    } catch (error) {
        console.error('Error analyzing patterns:', error);
        document.getElementById('pattern-analysis-loading').style.display =
            'none';
        document.getElementById('analyze-counts-btn').disabled = false;
        document.getElementById('analyze-memory-btn').disabled = false;
        showToast('Failed to analyze patterns', 'error');
    }
}

function renderPatternPieChart(patterns, fastMode = false) {
    const ctx = document.getElementById('patternPieChart');
    const isDarkTheme =
        document.documentElement.classList.contains('dark-theme');

    const top10 = patterns.slice(0, 10);
    const labels = top10.map((p) => p.pattern);
    const data = fastMode
        ? top10.map((p) => p.count)
        : top10.map((p) => p.total_memory);

    const colors = [
        '#3498db',
        '#e74c3c',
        '#2ecc71',
        '#f39c12',
        '#9b59b6',
        '#1abc9c',
        '#e67e22',
        '#34495e',
        '#16a085',
        '#c0392b'
    ];

    if (patternPieChart) {
        patternPieChart.destroy();
    }

    patternPieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels,
            datasets: [
                {
                    data,
                    backgroundColor: colors,
                    borderColor: isDarkTheme ? '#1a1a1a' : '#ffffff',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: isDarkTheme ? '#e0e0e0' : '#333333',
                        padding: 10,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            if (fastMode) {
                                return `${label}: ${value.toLocaleString()} keys`;
                            } else {
                                const mb = (value / 1024 / 1024).toFixed(2);
                                return `${label}: ${mb} MB`;
                            }
                        }
                    }
                }
            }
        }
    });
}

function renderPatternSummary(patterns, totalMemory, fastMode = false) {
    const summaryEl = document.getElementById('pattern-summary');
    const top5 = patterns.slice(0, 5);

    summaryEl.innerHTML = top5
        .map((pattern, index) => {
            const mb = (pattern.total_memory / 1024 / 1024).toFixed(2);
            const totalCount = top5.reduce((sum, p) => sum + p.count, 0);
            const percentage = fastMode
                ? ((pattern.count / totalCount) * 100).toFixed(1)
                : pattern.percentage;
            const colors = [
                '#3498db',
                '#e74c3c',
                '#2ecc71',
                '#f39c12',
                '#9b59b6'
            ];
            const color = colors[index];

            const valueDisplay = fastMode
                ? `${pattern.count.toLocaleString()} keys`
                : `${mb} MB`;

            return `
            <div style="padding: 12px; background-color: var(--bg-tertiary); border-radius: 6px; border-left: 4px solid ${color};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <span style="font-weight: 600; color: var(--text-primary); font-family: monospace; font-size: 0.95em;">${pattern.pattern}</span>
                    <span style="font-weight: 700; color: ${color};">${percentage}%</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em; color: var(--text-secondary);">
                    <span>${pattern.count.toLocaleString()} keys</span>
                    <span>${valueDisplay}</span>
                </div>
            </div>
        `;
        })
        .join('');
}

function renderPatternTable(patterns, fastMode = false) {
    const tableEl = document.getElementById('pattern-table');

    tableEl.innerHTML = patterns
        .map((pattern) => {
            const totalMB = (pattern.total_memory / 1024 / 1024).toFixed(2);
            const avgKB = (pattern.avg_memory / 1024).toFixed(2);
            const sampleKeys = pattern.sample_keys
                .map(
                    (k) =>
                        `<code style="background: var(--bg-code); padding: 2px 4px; border-radius: 3px; font-size: 0.85em;">${k}</code>`
                )
                .join(' ');

            const memoryDisplay = fastMode
                ? 'N/A (fast mode)'
                : `${totalMB} MB`;
            const avgDisplay = fastMode ? 'N/A' : `${avgKB} KB`;
            const percentageDisplay = pattern.percentage || '-';

            return `
            <tr style="border-bottom: 1px solid var(--border-primary);">
                <td style="padding: 12px; font-family: monospace; font-weight: 600; color: var(--text-primary);">${pattern.pattern}</td>
                <td style="padding: 12px; color: var(--text-primary);">${pattern.count.toLocaleString()}</td>
                <td style="padding: 12px; color: var(--text-primary); font-weight: 600;">${memoryDisplay}</td>
                <td style="padding: 12px; color: var(--text-secondary);">${avgDisplay}</td>
                <td style="padding: 12px; color: var(--accent-primary); font-weight: 600;">${percentageDisplay}%</td>
                <td style="padding: 12px; font-size: 0.85em;">${sampleKeys || 'N/A'}</td>
            </tr>
        `;
        })
        .join('');
}

function resetPatternAnalysis() {
    const resultsEl = document.getElementById('pattern-analysis-results');
    const infoEl = document.getElementById('pattern-analysis-info');

    if (resultsEl) {
        resultsEl.style.display = 'none';
    }

    if (infoEl) {
        infoEl.textContent = 'Not analyzed yet';
    }

    if (patternPieChart) {
        patternPieChart.destroy();
        patternPieChart = null;
    }
}

function resetAllData() {
    document.getElementById('metric-memory').textContent = '-';
    document.getElementById('metric-memory-subtitle').textContent =
        'Loading...';
    document.getElementById('memory-progress').style.width = '0%';

    document.getElementById('metric-keys').textContent = '-';
    document.getElementById('metric-keys-subtitle').textContent =
        'Across all databases';

    document.getElementById('metric-hitrate').textContent = '-';
    document.getElementById('metric-hitrate-subtitle').textContent =
        'Cache effectiveness';

    document.getElementById('metric-clients').textContent = '-';
    document.getElementById('metric-clients-subtitle').textContent =
        'Active connections';

    document.getElementById('metric-evictions').textContent = '-';
    document.getElementById('metric-evictions-subtitle').textContent =
        'Due to memory limit';

    document.getElementById('metric-fragmentation').textContent = '-';
    document.getElementById('metric-fragmentation-subtitle').textContent =
        'RSS/Used ratio';

    document.getElementById('metric-ops').textContent = '-';
    document.getElementById('metric-ops-subtitle').textContent =
        'Current throughput';

    document.getElementById('metric-cpu').textContent = '-';
    document.getElementById('metric-cpu-subtitle').textContent =
        'System + User';

    document.getElementById('metric-network').textContent = '-';
    document.getElementById('metric-network-subtitle').textContent =
        'Total transferred';

    document.getElementById('metric-total-conns').textContent = '-';
    document.getElementById('metric-total-conns-subtitle').textContent =
        'Lifetime received';

    document.getElementById('metric-ttl').textContent = '-';
    document.getElementById('metric-ttl-subtitle').textContent = 'Will expire';

    if (memoryChart) {
        memoryChart.destroy();
        memoryChart = null;
    }
    if (keysChart) {
        keysChart.destroy();
        keysChart = null;
    }
    if (hitRateChart) {
        hitRateChart.destroy();
        hitRateChart = null;
    }
    if (opsChart) {
        opsChart.destroy();
        opsChart = null;
    }
    if (networkChart) {
        networkChart.destroy();
        networkChart = null;
    }

    document.getElementById('memory-chart-loading').classList.remove('hidden');
    document.getElementById('keys-chart-loading').classList.remove('hidden');
    document.getElementById('hitrate-chart-loading').classList.remove('hidden');
    document.getElementById('ops-chart-loading').classList.remove('hidden');
    document.getElementById('network-chart-loading').classList.remove('hidden');

    document.getElementById('command-stats-table').innerHTML =
        '<tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--text-secondary);">Loading...</td></tr>';
    document.getElementById('command-stats-timeframe').textContent =
        'Loading...';

    document.getElementById('slowlog-table').innerHTML =
        '<tr><td colspan="4" style="padding: 20px; text-align: center; color: var(--text-secondary);">Loading...</td></tr>';

    resetPatternAnalysis();
}

function startAutoRefresh() {
    autoRefreshInterval = setInterval(async () => {
        await loadRealtimeStats();
    }, 30000);
}

document.addEventListener('DOMContentLoaded', init);

window.addEventListener('beforeunload', () => {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
});
