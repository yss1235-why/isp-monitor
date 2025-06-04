// File: script.js (root directory)
// ISP Monitor using GitHub Actions synced UptimeRobot data (every 15 minutes)

// Disclaimer toggle functionality
function toggleDisclaimer() {
    const content = document.getElementById('disclaimer-content');
    const toggle = document.getElementById('disclaimer-toggle');
    
    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        toggle.classList.remove('expanded');
        toggle.textContent = '▼';
    } else {
        content.classList.add('expanded');
        toggle.classList.add('expanded');
        toggle.textContent = '▲';
    }
}

function initializeDisclaimer() {
    const content = document.getElementById('disclaimer-content');
    const toggle = document.getElementById('disclaimer-toggle');
    content.classList.remove('expanded');
    toggle.classList.remove('expanded');
    toggle.textContent = '▼';
}

// Main ISP Monitor Class using synced UptimeRobot data
class ISPMonitor {
    constructor() {
        this.monitors = [];
        this.latestData = new Map();
        this.lastSyncTime = null;
        this.init();
    }

    async init() {
        initializeDisclaimer();
        await this.loadSyncedData();
        this.updateDashboard();
        
        // Auto-refresh every 2 minutes to check for new synced data
        setInterval(() => {
            this.loadSyncedData().then(() => {
                this.updateDashboard();
            });
        }, 2 * 60 * 1000);
    }

    async loadSyncedData() {
        try {
            // Load from GitHub Actions synced data
            const response = await fetch('./data/uptimerobot/summary.json');
            
            if (response.ok) {
                const data = await response.json();
                this.monitors = data.monitors || [];
                this.lastSyncTime = data.last_updated;
                this.processMonitorData();
            } else {
                console.warn('Synced UptimeRobot data not available yet');
                this.showSyncMessage();
            }
        } catch (error) {
            console.warn('Error loading synced data:', error.message);
            this.showSyncMessage();
        }
    }

    processMonitorData() {
        this.latestData.clear();
        
        this.monitors.forEach(monitor => {
            // Transform UptimeRobot monitor to ISP-like data
            const ispData = {
                isp_name: monitor.friendly_name,
                ip: this.extractIPFromUrl(monitor.url),
                status: monitor.status,
                quality_score: this.calculateQualityScore(monitor),
                avg_latency: monitor.response_time_ms || 0,
                jitter: 0, // UptimeRobot doesn't provide jitter
                packet_loss: monitor.status === 'UP' ? 0 : 100,
                uptime_today: monitor.uptime_percentage,
                timestamp: monitor.timestamp,
                url: monitor.url,
                type: monitor.type
            };
            
            this.latestData.set(monitor.friendly_name, ispData);
        });
    }

    extractIPFromUrl(url) {
        try {
            // Remove protocol and extract host
            let cleanUrl = url.replace(/^https?:\/\//, '');
            cleanUrl = cleanUrl.split('/')[0].split(':')[0];
            
            // Check if it's an IP address
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
            return ipRegex.test(cleanUrl) ? cleanUrl : cleanUrl;
        } catch (error) {
            return url;
        }
    }

    calculateQualityScore(monitor) {
        const uptime = monitor.uptime_percentage || 0;
        const responseTime = monitor.response_time_ms || 0;
        
        // Calculate quality based on uptime and response time
        let score = uptime; // Start with uptime percentage
        
        // Penalty for high response time
        if (responseTime > 1000) score -= 20;
        else if (responseTime > 500) score -= 10;
        else if (responseTime > 200) score -= 5;
        
        // Bonus for very low response time
        if (responseTime < 50 && responseTime > 0) score = Math.min(100, score + 5);
        
        return Math.max(0, Math.min(100, Math.round(score)));
    }

    showSyncMessage() {
        document.getElementById('total-isps').textContent = '0';
        document.getElementById('isps-up').textContent = '0/0';
        document.getElementById('avg-latency').textContent = '0ms';
        document.getElementById('last-update').textContent = 'Syncing...';
        
        const tbody = document.querySelector('#isp-table tbody');
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: #666;">
                    <div style="margin-bottom: 1rem;">
                        <strong>🔄 Syncing monitoring data...</strong>
                    </div>
                    <div style="font-size: 0.9rem; line-height: 1.6;">
                        <p>GitHub Actions is fetching the latest monitoring data.</p>
                        <p>This process runs every 15 minutes.</p>
                        <p style="margin-top: 1rem; font-size: 0.8rem; color: #888;">
                            Data will appear here once the first sync completes (max 15 minutes).
                        </p>
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
        if (!this.lastSyncTime) return 'Never';
        
        const timeDiff = Date.now() - new Date(this.lastSyncTime).getTime();
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
            this.showSyncMessage();
            return;
        }

        // Sort by quality score (descending)
        const sortedISPs = Array.from(this.latestData.entries())
            .sort((a, b) => parseFloat(b[1].quality_score) - parseFloat(a[1].quality_score));

        sortedISPs.forEach(([ispName, data], index) => {
            const row = document.createElement('tr');
            row.className = data.status === 'UP' ? 'status-up' : 'status-down';
            
            const qualityClass = this.getQualityClass(parseFloat(data.quality_score));
            
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>
                    <strong>${data.isp_name}</strong><br>
                    <small>${data.ip}</small>
                </td>
                <td><span class="status ${data.status.toLowerCase()}">${data.status}</span></td>
                <td><span class="quality ${qualityClass}">${data.quality_score}</span></td>
                <td>${data.avg_latency}ms</td>
                <td>${data.jitter}ms</td>
                <td>${data.packet_loss}%</td>
                <td>${data.uptime_today}%</td>
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
