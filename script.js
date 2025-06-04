// File: script.js (root directory)
// ISP Monitor displaying UptimeRobot data in original table format

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

// Main ISP Monitor Class - Using UptimeRobot Data
class ISPMonitor {
    constructor() {
        this.uptimeRobotData = [];
        this.latestData = new Map();
        this.init();
    }

    async init() {
        // Initialize disclaimer state
        initializeDisclaimer();
        
        await this.loadUptimeRobotData();
        this.updateDashboard();
        
        // Auto-refresh every 5 minutes
        setInterval(() => {
            this.loadUptimeRobotData().then(() => {
                this.updateDashboard();
            });
        }, 5 * 60 * 1000);
    }

    async loadUptimeRobotData() {
        try {
            const response = await fetch('./data/uptimerobot/summary.json');
            if (response.ok) {
                const data = await response.json();
                this.uptimeRobotData = data.monitors || [];
                this.processUptimeRobotData();
            } else {
                this.showNoDataMessage();
            }
        } catch (error) {
            console.error('Error loading UptimeRobot data:', error);
            this.showNoDataMessage();
        }
    }

    processUptimeRobotData() {
        // Convert UptimeRobot data to ISP table format
        this.latestData.clear();
        
        this.uptimeRobotData.forEach(monitor => {
            // Convert UptimeRobot monitor to ISP-like data structure
            const ispData = {
                isp_name: monitor.friendly_name,
                ip: this.extractIPFromUrl(monitor.url),
                status: monitor.status,
                quality_score: this.calculateQualityFromUptime(monitor.uptime_percentage),
                avg_latency: monitor.response_time_ms || 0,
                jitter: 0, // UptimeRobot doesn't provide jitter
                packet_loss: monitor.status === 'UP' ? 0 : 100,
                uptime_percentage: monitor.uptime_percentage,
                timestamp: monitor.timestamp,
                url: monitor.url,
                type: monitor.type
            };
            
            this.latestData.set(monitor.friendly_name, ispData);
        });
    }

    extractIPFromUrl(url) {
        // Try to extract IP or return domain
        try {
            // Remove protocol
            let cleanUrl = url.replace(/^https?:\/\//, '');
            // Remove path
            cleanUrl = cleanUrl.split('/')[0];
            // Remove port
            cleanUrl = cleanUrl.split(':')[0];
            
            // Check if it's an IP address
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (ipRegex.test(cleanUrl)) {
                return cleanUrl;
            }
            
            // If not IP, return the domain
            return cleanUrl;
        } catch (error) {
            return url;
        }
    }

    calculateQualityFromUptime(uptimePercent) {
        // Convert uptime percentage to quality score (0-100)
        if (uptimePercent >= 99.9) return 100;
        if (uptimePercent >= 99.5) return 95;
        if (uptimePercent >= 99.0) return 90;
        if (uptimePercent >= 98.0) return 80;
        if (uptimePercent >= 95.0) return 70;
        if (uptimePercent >= 90.0) return 60;
        if (uptimePercent >= 80.0) return 50;
        if (uptimePercent >= 70.0) return 40;
        if (uptimePercent >= 50.0) return 30;
        return Math.max(0, Math.round(uptimePercent));
    }

    showNoDataMessage() {
        document.getElementById('total-isps').textContent = '0';
        document.getElementById('isps-up').textContent = '0/0';
        document.getElementById('avg-latency').textContent = '0ms';
        document.getElementById('last-update').textContent = 'No data yet';
        
        const tbody = document.querySelector('#isp-table tbody');
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: #666;">
                    <div style="margin-bottom: 1rem;">
                        <strong>UptimeRobot data not available yet</strong>
                    </div>
                    <div style="font-size: 0.9rem; line-height: 1.6;">
                        <p>To display your UptimeRobot monitors:</p>
                        <ol style="text-align: left; display: inline-block; margin-top: 0.5rem;">
                            <li>Add API key to GitHub Secrets: <code>UPTIMEROBOT_API_KEY</code></li>
                            <li>Add the sync workflow and script files</li>
                            <li>Wait for first sync (within 30 minutes)</li>
                        </ol>
                        <p style="margin-top: 1rem;"><strong>Your API Key:</strong> <code>u2969607-0a95611c9802fc89b7c4ba93</code></p>
                    </div>
                </td>
            </tr>
        `;
    }

    updateDashboard() {
        this.updateSummary();
        this.updateTable();
    }

    updateSummary() {
        const totalMonitors = this.latestData.size;
        const monitorsUp = Array.from(this.latestData.values())
            .filter(row => row.status === 'UP').length;
        
        const avgLatency = this.calculateAverageLatency();
        const lastUpdate = this.getLastUpdateTime();

        document.getElementById('total-isps').textContent = totalMonitors;
        document.getElementById('isps-up').textContent = `${monitorsUp}/${totalMonitors}`;
        document.getElementById('avg-latency').textContent = `${avgLatency}ms`;
        document.getElementById('last-update').textContent = lastUpdate;
    }

    calculateAverageLatency() {
        const upMonitors = Array.from(this.latestData.values())
            .filter(row => row.status === 'UP');
        
        if (upMonitors.length === 0) return '0';
        
        const totalLatency = upMonitors.reduce((sum, row) => 
            sum + parseFloat(row.avg_latency || 0), 0);
        
        return (totalLatency / upMonitors.length).toFixed(1);
    }

    getLastUpdateTime() {
        if (this.uptimeRobotData.length === 0) return 'Never';
        
        // Use the timestamp from UptimeRobot data
        const latestTimestamp = Math.max(...this.uptimeRobotData.map(monitor => 
            new Date(monitor.timestamp).getTime()));
        
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
        const sortedMonitors = Array.from(this.latestData.entries())
            .sort((a, b) => parseFloat(b[1].quality_score) - parseFloat(a[1].quality_score));

        sortedMonitors.forEach(([monitorName, data], index) => {
            const row = document.createElement('tr');
            row.className = data.status === 'UP' ? 'status-up' : 'status-down';
            
            const qualityClass = this.getQualityClass(parseFloat(data.quality_score));
            
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>
                    <strong>${data.isp_name}</strong><br>
                    <small>${data.ip}</small><br>
                    <small style="color: #888;">${data.type}</small>
                </td>
                <td><span class="status ${data.status.toLowerCase()}">${data.status}</span></td>
                <td><span class="quality ${qualityClass}">${data.quality_score}</span></td>
                <td>${data.avg_latency}ms</td>
                <td>${data.jitter}ms</td>
                <td>${data.packet_loss}%</td>
                <td>${data.uptime_percentage}%</td>
            `;
            
            tbody.appendChild(row);
        });
    }

    getQualityClass(score) {
        if (score >= 95) return 'excellent';
        if (score >= 80) return 'good';
        if (score >= 60) return 'fair';
        return 'poor';
    }
}

// Initialize the monitor when page loads
document.addEventListener('DOMContentLoaded', () => {
    new ISPMonitor();
});
