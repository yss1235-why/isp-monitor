// File: script.js (root directory)
// Clean ISP Monitor using UptimeRobot API data (no branding)

// UptimeRobot API key (hardcoded)
const UPTIMEROBOT_API_KEY = "u2969607-0a95611c9802fc89b7c4ba93";

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

// Main ISP Monitor Class using UptimeRobot data
class ISPMonitor {
    constructor() {
        this.monitors = [];
        this.latestData = new Map();
        this.init();
    }

    async init() {
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
            const formData = new FormData();
            formData.append('api_key', UPTIMEROBOT_API_KEY);
            formData.append('format', 'json');
            formData.append('all_time_uptime_ratio', '1');
            formData.append('custom_uptime_ratios', '1-7-30');
            formData.append('response_times', '1');
            formData.append('response_times_limit', '5');

            const response = await fetch('https://api.uptimerobot.com/v2/getMonitors', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (data.stat === 'ok') {
                this.monitors = data.monitors || [];
                this.processMonitorData();
            } else {
                console.error('UptimeRobot API Error:', data.error?.message);
                this.showNoDataMessage();
            }
        } catch (error) {
            console.error('Error fetching UptimeRobot data:', error);
            this.showNoDataMessage();
        }
    }

    processMonitorData() {
        this.latestData.clear();
        
        this.monitors.forEach(monitor => {
            // Transform UptimeRobot monitor to ISP-like data
            const ispData = {
                isp_name: monitor.friendly_name,
                ip: this.extractIPFromUrl(monitor.url),
                status: this.getStatusText(monitor.status),
                quality_score: this.calculateQualityScore(monitor),
                avg_latency: this.getLatestResponseTime(monitor),
                jitter: 0, // UptimeRobot doesn't provide jitter
                packet_loss: monitor.status === 2 ? 0 : 100, // 2 = UP
                uptime_today: this.getUptimePercentage(monitor),
                timestamp: new Date().toISOString(),
                url: monitor.url,
                type: this.getMonitorType(monitor.type)
            };
            
            this.latestData.set(monitor.friendly_name, ispData);
        });
    }

    extractIPFromUrl(url) {
        try {
            // Remove protocol
            let cleanUrl = url.replace(/^https?:\/\//, '');
            // Remove path and port
            cleanUrl = cleanUrl.split('/')[0].split(':')[0];
            
            // Check if it's an IP address
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
            return ipRegex.test(cleanUrl) ? cleanUrl : cleanUrl;
        } catch (error) {
            return url;
        }
    }

    getStatusText(status) {
        // UptimeRobot status: 0=paused, 1=not checked, 2=up, 8=seems down, 9=down
        return status === 2 ? 'UP' : 'DOWN';
    }

    getMonitorType(type) {
        const types = { 1: 'HTTP(s)', 2: 'Keyword', 3: 'Ping', 4: 'Port', 5: 'Heartbeat' };
        return types[type] || 'Unknown';
    }

    getLatestResponseTime(monitor) {
        if (monitor.response_times && monitor.response_times.length > 0) {
            return monitor.response_times[monitor.response_times.length - 1].value || 0;
        }
        return monitor.average_response_time || 0;
    }

    getUptimePercentage(monitor) {
        // Try different uptime ratios
        if (monitor.all_time_uptime_ratio) {
            return parseFloat(monitor.all_time_uptime_ratio);
        }
        if (monitor.custom_uptime_ratios && monitor.custom_uptime_ratios.length > 0) {
            return parseFloat(monitor.custom_uptime_ratios[0]); // 1-day ratio
        }
        return monitor.status === 2 ? 100 : 0;
    }

    calculateQualityScore(monitor) {
        const uptime = this.getUptimePercentage(monitor);
        const responseTime = this.getLatestResponseTime(monitor);
        
        // Calculate quality based on uptime and response time
        let score = uptime; // Start with uptime percentage
        
        // Penalty for high response time
        if (responseTime > 1000) score -= 20;
        else if (responseTime > 500) score -= 10;
        else if (responseTime > 200) score -= 5;
        
        // Bonus for very low response time
        if (responseTime < 50) score = Math.min(100, score + 5);
        
        return Math.max(0, Math.min(100, Math.round(score)));
    }

    showNoDataMessage() {
        document.getElementById('total-isps').textContent = '0';
        document.getElementById('isps-up').textContent = '0/0';
        document.getElementById('avg-latency').textContent = '0ms';
        document.getElementById('last-update').textContent = 'No data';
        
        const tbody = document.querySelector('#isp-table tbody');
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: #666;">
                    No monitoring data available. Please check your network connection and try again.
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
        const lastUpdate = 'Just now';

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
