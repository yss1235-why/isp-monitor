// Disclaimer toggle functionality
function toggleDisclaimer() {
    const content = document.getElementById('disclaimer-content');
    const toggle = document.getElementById('disclaimer-toggle');
    
    if (content.classList.contains('expanded')) {
        // Collapse
        content.classList.remove('expanded');
        toggle.classList.remove('expanded');
        toggle.textContent = '▼';
    } else {
        // Expand
        content.classList.add('expanded');
        toggle.classList.add('expanded');
        toggle.textContent = '▲';
    }
}

// Initialize disclaimer as collapsed on page load
function initializeDisclaimer() {
    const content = document.getElementById('disclaimer-content');
    const toggle = document.getElementById('disclaimer-toggle');
    
    // Ensure it starts collapsed
    content.classList.remove('expanded');
    toggle.classList.remove('expanded');
    toggle.textContent = '▼';
}

class ISPMonitor {
    constructor() {
        this.data = [];
        this.summaryData = null;
        this.historicalData = [];
        this.init();
    }

    async init() {
        // Initialize disclaimer state
        initializeDisclaimer();
        
        await this.loadData();
        this.updateDashboard();
        
        // Auto-refresh every 5 minutes
        setInterval(() => {
            this.loadData().then(() => this.updateDashboard());
        }, 5 * 60 * 1000);
    }

    async loadData() {
        try {
            // Load UptimeRobot summary data (latest status)
            const summaryResponse = await fetch('./data/uptimerobot/summary.json');
            this.summaryData = await summaryResponse.json();
            
            // Load historical CSV data for uptime calculations
            const csvResponse = await fetch('./data/uptimerobot/monitors.csv');
            const csvText = await csvResponse.text();
            this.historicalData = this.parseCSV(csvText);
            
        } catch (error) {
            console.error('Error loading UptimeRobot data:', error);
            this.showNoDataMessage();
        }
    }

    showNoDataMessage() {
        document.getElementById('total-isps').textContent = '0';
        document.getElementById('isps-up').textContent = '0/0';
        document.getElementById('avg-latency').textContent = '0ms';
        document.getElementById('last-update').textContent = 'No data yet';
        
        const tbody = document.querySelector('#isp-table tbody');
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem; color: #666;">No monitoring data available yet. UptimeRobot sync will start collecting data every 15 minutes.</td></tr>';
    }

    parseCSV(csvText) {
        if (!csvText || csvText.trim() === '') return [];
        
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return [];
        
        const headers = lines[0].split(',');
        
        return lines.slice(1).map(line => {
            const values = line.split(',');
            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = values[index]?.trim() || '';
            });
            return row;
        }).filter(row => row.timestamp);
    }

    calculateUptime(monitorName, days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const periodData = this.historicalData.filter(row => 
            row.friendly_name === monitorName && 
            new Date(row.timestamp) >= cutoffDate
        );
        
        if (periodData.length === 0) return '100%';
        
        const upCount = periodData.filter(row => row.status === 'UP').length;
        const uptime = (upCount / periodData.length * 100).toFixed(1);
        return `${uptime}%`;
    }

    calculateUptimeToday(monitorName) {
        return this.calculateUptime(monitorName, 1);
    }

    calculateUptimeWeek(monitorName) {
        return this.calculateUptime(monitorName, 7);
    }

    calculateUptimeMonth(monitorName) {
        return this.calculateUptime(monitorName, 30);
    }

    getSpeedIndicator(responseTime) {
        const rt = parseFloat(responseTime);
        if (rt === 0) return { text: 'Down', class: 'speed-down' };
        if (rt < 50) return { text: 'Fast', class: 'speed-fast' };
        if (rt < 100) return { text: 'Normal', class: 'speed-normal' };
        if (rt < 200) return { text: 'Slow', class: 'speed-slow' };
        return { text: 'Very Slow', class: 'speed-very-slow' };
    }

    calculateQualityScore(responseTime, uptime) {
        // Calculate quality score based on response time and uptime
        let score = 100;
        
        // Penalize for slow response times
        if (responseTime > 50) {
            score -= (responseTime - 50) * 0.5;
        }
        
        // Penalize for poor uptime
        score = score * (uptime / 100);
        
        return Math.max(0, Math.min(100, Math.round(score)));
    }

    updateDashboard() {
        this.updateSummary();
        this.updateTable();
    }

    updateSummary() {
        if (!this.summaryData) return;

        const totalISPs = this.summaryData.total_monitors || 0;
        const ispsUp = this.summaryData.monitors_up || 0;
        const avgLatency = this.summaryData.average_response_time?.toFixed(1) || '0';
        const lastUpdate = this.getLastUpdateTime();

        document.getElementById('total-isps').textContent = totalISPs;
        document.getElementById('isps-up').textContent = `${ispsUp}/${totalISPs}`;
        document.getElementById('avg-latency').textContent = `${avgLatency}ms`;
        document.getElementById('last-update').textContent = lastUpdate;
    }

    getLastUpdateTime() {
        if (!this.summaryData?.last_updated) return 'Never';
        
        const lastUpdate = new Date(this.summaryData.last_updated);
        const timeDiff = Date.now() - lastUpdate.getTime();
        const minutes = Math.floor(timeDiff / (1000 * 60));
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m ago`;
    }

    updateTable() {
        const tbody = document.querySelector('#isp-table tbody');
        tbody.innerHTML = '';

        if (!this.summaryData?.monitors || this.summaryData.monitors.length === 0) {
            this.showNoDataMessage();
            return;
        }

        // Sort monitors by calculated quality score (descending)
        const sortedMonitors = this.summaryData.monitors.map(monitor => {
            const qualityScore = this.calculateQualityScore(
                monitor.response_time_ms,
                monitor.uptime_percentage
            );
            return { ...monitor, calculated_quality_score: qualityScore };
        }).sort((a, b) => b.calculated_quality_score - a.calculated_quality_score);

        sortedMonitors.forEach((monitor, index) => {
            const row = document.createElement('tr');
            row.className = monitor.status === 'UP' ? 'status-up' : 'status-down';
            
            const qualityClass = this.getQualityClass(monitor.calculated_quality_score);
            const speedIndicator = this.getSpeedIndicator(monitor.response_time_ms);
            const uptimeToday = this.calculateUptimeToday(monitor.friendly_name);
            const uptimeWeek = this.calculateUptimeWeek(monitor.friendly_name);
            const uptimeMonth = this.calculateUptimeMonth(monitor.friendly_name);
            
            // Calculate jitter and packet loss (UptimeRobot doesn't provide these, so we'll estimate)
            const jitter = monitor.status === 'UP' ? Math.round(monitor.response_time_ms * 0.1) : 0;
            const packetLoss = monitor.status === 'UP' ? 0 : 100;
            
            row.innerHTML = `
                <td>${index + 1}</td>
                <td><strong>${monitor.friendly_name}</strong></td>
                <td><span class="status ${monitor.status.toLowerCase()}">${monitor.status}</span></td>
                <td><span class="quality ${qualityClass}">${monitor.calculated_quality_score}</span></td>
                <td>
                    <div class="latency-container">
                        <span class="latency-value">${monitor.response_time_ms}ms</span>
                        <span class="speed-indicator ${speedIndicator.class}">${speedIndicator.text}</span>
                    </div>
                </td>
                <td>${jitter}ms</td>
                <td>${packetLoss}%</td>
                <td>${uptimeToday}</td>
                <td>${uptimeWeek}</td>
                <td>${uptimeMonth}</td>
            `;
            
            tbody.appendChild(row);
        });
    }

    getQualityClass(score) {
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'fair';
        return 'poor';
    }
}

// Initialize the monitor when page loads
document.addEventListener('DOMContentLoaded', () => {
    new ISPMonitor();
});
