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
        this.latestData = new Map();
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
            const response = await fetch('./data/logs.csv');
            const csvText = await response.text();
            this.data = this.parseCSV(csvText);
            this.processLatestData();
        } catch (error) {
            console.error('Error loading data:', error);
            // Show error message in dashboard if no data
            if (this.data.length === 0) {
                this.showNoDataMessage();
            }
        }
    }

    showNoDataMessage() {
        document.getElementById('total-isps').textContent = '0';
        document.getElementById('isps-up').textContent = '0/0';
        document.getElementById('avg-latency').textContent = '0ms';
        document.getElementById('last-update').textContent = 'No data yet';
        
        const tbody = document.querySelector('#isp-table tbody');
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem; color: #666;">No monitoring data available yet. GitHub Actions will start collecting data every 15 minutes.</td></tr>';
    }

    parseCSV(csvText) {
        if (!csvText || csvText.trim() === '') return [];
        
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return []; // Need at least header + 1 data row
        
        const headers = lines[0].split(',');
        
        return lines.slice(1).map(line => {
            const values = line.split(',');
            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = values[index]?.trim() || '';
            });
            return row;
        }).filter(row => row.timestamp); // Filter out empty rows
    }

    processLatestData() {
        // Get latest reading for each ISP
        this.latestData.clear();
        
        this.data.forEach(row => {
            const isp = row.isp_name;
            const timestamp = new Date(row.timestamp);
            
            if (!this.latestData.has(isp) || 
                new Date(this.latestData.get(isp).timestamp) < timestamp) {
                this.latestData.set(isp, row);
            }
        });
    }

    calculateUptime(ispName, days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const periodData = this.data.filter(row => 
            row.isp_name === ispName && 
            new Date(row.timestamp) >= cutoffDate
        );
        
        if (periodData.length === 0) return '100%';
        
        const upCount = periodData.filter(row => row.status === 'UP').length;
        const uptime = (upCount / periodData.length * 100).toFixed(1);
        return `${uptime}%`;
    }

    calculateUptimeToday(ispName) {
        return this.calculateUptime(ispName, 1);
    }

    calculateUptimeWeek(ispName) {
        return this.calculateUptime(ispName, 7);
    }

    calculateUptimeMonth(ispName) {
        return this.calculateUptime(ispName, 30);
    }

    getSpeedIndicator(latency) {
        const lat = parseFloat(latency);
        if (lat === 0) return { text: 'Down', class: 'speed-down' };
        if (lat < 50) return { text: 'Fast', class: 'speed-fast' };
        if (lat < 100) return { text: 'Normal', class: 'speed-normal' };
        if (lat < 200) return { text: 'Slow', class: 'speed-slow' };
        return { text: 'Very Slow', class: 'speed-very-slow' };
    }

    updateDashboard() {
        this.updateSummary();
        this.updateTable();
    }

    updateSummary() {
        const totalISPs = this.latestData.size;
        const ispsUp = Array.from(this.latestData.values())
            .filter(row => row.status === 'UP').length;
        
        const avgLatency = this.calculateAverageLatency();
        const lastUpdate = this.getLastUpdateTime();

        document.getElementById('total-isps').textContent = totalISPs;
        document.getElementById('isps-up').textContent = `${ispsUp}/${totalISPs}`;
        document.getElementById('avg-latency').textContent = `${avgLatency}ms`;
        document.getElementById('last-update').textContent = lastUpdate;
    }

    calculateAverageLatency() {
        const upISPs = Array.from(this.latestData.values())
            .filter(row => row.status === 'UP');
        
        if (upISPs.length === 0) return '0';
        
        const totalLatency = upISPs.reduce((sum, row) => 
            sum + parseFloat(row.avg_latency || 0), 0);
        
        return (totalLatency / upISPs.length).toFixed(1);
    }

    getLastUpdateTime() {
        if (this.data.length === 0) return 'Never';
        
        const latestTimestamp = Math.max(...this.data.map(row => 
            new Date(row.timestamp).getTime()));
        
        const timeDiff = Date.now() - latestTimestamp;
        const minutes = Math.floor(timeDiff / (1000 * 60));
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m ago`;
    }

    updateTable() {
        const tbody = document.querySelector('#isp-table tbody');
        tbody.innerHTML = '';

        if (this.latestData.size === 0) {
            this.showNoDataMessage();
            return;
        }

        // Sort by quality score (descending)
        const sortedISPs = Array.from(this.latestData.entries())
            .sort((a, b) => parseFloat(b[1].quality_score) - parseFloat(a[1].quality_score));

        sortedISPs.forEach(([ispName, data], index) => {
            const row = document.createElement('tr');
            row.className = data.status === 'UP' ? 'status-up' : 'status-down';
            
            const qualityClass = this.getQualityClass(parseFloat(data.quality_score));
            const speedIndicator = this.getSpeedIndicator(data.avg_latency);
            const uptimeToday = this.calculateUptimeToday(ispName);
            const uptimeWeek = this.calculateUptimeWeek(ispName);
            const uptimeMonth = this.calculateUptimeMonth(ispName);
            
            row.innerHTML = `
                <td>${index + 1}</td>
                <td><strong>${ispName}</strong></td>
                <td><span class="status ${data.status.toLowerCase()}">${data.status}</span></td>
                <td><span class="quality ${qualityClass}">${data.quality_score}</span></td>
                <td>
                    <div class="latency-container">
                        <span class="latency-value">${data.avg_latency}ms</span>
                        <span class="speed-indicator ${speedIndicator.class}">${speedIndicator.text}</span>
                    </div>
                </td>
                <td>${data.jitter}ms</td>
                <td>${data.packet_loss}%</td>
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
