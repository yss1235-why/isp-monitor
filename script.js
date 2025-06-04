// File: script.js (root directory)
// Enhanced ISP Monitor with UptimeRobot Integration

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

// UptimeRobot Integration Class
class UptimeRobotIntegration {
    constructor() {
        this.monitors = new Map();
        this.lastUpdate = null;
    }

    async loadUptimeRobotData() {
        try {
            // Load from synced data (note: data folder is in root)
            const response = await fetch('./data/uptimerobot/summary.json');
            if (response.ok) {
                const data = await response.json();
                return data.monitors || [];
            }
        } catch (error) {
            console.warn('UptimeRobot synced data not available, this is normal on first setup:', error.message);
        }
        return [];
    }

    getStatusClass(status) {
        const upStatuses = ['UP'];
        return upStatuses.includes(status) ? 'up' : 'down';
    }

    getQualityClass(uptime) {
        if (uptime >= 99.5) return 'excellent';
        if (uptime >= 99.0) return 'good';
        if (uptime >= 95.0) return 'fair';
        return 'poor';
    }

    formatLastUpdate(timestamp) {
        if (!timestamp) return 'Never';
        
        const timeDiff = Date.now() - new Date(timestamp).getTime();
        const minutes = Math.floor(timeDiff / (1000 * 60));
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m ago`;
    }

    async displayUptimeRobotData() {
        const monitors = await this.loadUptimeRobotData();
        
        if (monitors.length === 0) {
            this.showUptimeRobotSetupMessage();
            return;
        }

        this.createUptimeRobotSection(monitors);
    }

    showUptimeRobotSetupMessage() {
        // Find the main element to insert the setup message
        const main = document.querySelector('main');
        const rankingsSection = document.querySelector('.rankings');
        
        // Create setup message section
        const setupSection = document.createElement('section');
        setupSection.className = 'uptimerobot-setup';
        setupSection.innerHTML = `
            <div style="background: #fff3cd; border: 2px solid #ffeaa7; border-radius: 12px; padding: 2rem; margin-bottom: 2rem; box-shadow: 0 4px 12px rgba(255, 193, 7, 0.2);">
                <h2 style="color: #856404; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                    🤖 UptimeRobot Integration
                    <span style="font-size: 0.8rem; background: #e3f2fd; color: #1976d2; padding: 0.2rem 0.6rem; border-radius: 12px; font-weight: normal;">Setup Required</span>
                </h2>
                <div style="color: #856404;">
                    <p style="margin-bottom: 1rem;"><strong>UptimeRobot data will appear here once the GitHub Action sync is set up.</strong></p>
                    <p style="margin-bottom: 1rem;">To enable UptimeRobot integration:</p>
                    <ol style="margin-left: 1.5rem; margin-bottom: 1rem;">
                        <li>Add your UptimeRobot API key to GitHub Secrets as <code>UPTIMEROBOT_API_KEY</code></li>
                        <li>Add the UptimeRobot sync workflow to <code>.github/workflows/uptimerobot-sync.yml</code></li>
                        <li>Add the sync script to <code>scripts/sync_uptimerobot.py</code></li>
                        <li>Wait for the first sync to run (within 30 minutes)</li>
                    </ol>
                    <p><strong>Your API Key:</strong> <code>u2969607-0a95611c9802fc89b7c4ba93</code></p>
                </div>
            </div>
        `;
        
        // Insert before rankings section
        main.insertBefore(setupSection, rankingsSection);
    }

    createUptimeRobotSection(monitors) {
        // Remove any existing UptimeRobot sections
        const existingSection = document.querySelector('.uptimerobot-section, .uptimerobot-setup');
        if (existingSection) {
            existingSection.remove();
        }

        // Find the main element to insert the new section
        const main = document.querySelector('main');
        const rankingsSection = document.querySelector('.rankings');
        
        // Create UptimeRobot section
        const uptimeSection = document.createElement('section');
        uptimeSection.className = 'uptimerobot-section';
        uptimeSection.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 2rem; margin-bottom: 2rem; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);">
                <h2 style="margin-bottom: 1.5rem; color: #333; display: flex; align-items: center; gap: 0.5rem;">
                    🤖 UptimeRobot Monitors
                    <span class="external-badge">External Service</span>
                </h2>
                <div class="table-container">
                    <table id="uptimerobot-table">
                        <thead>
                            <tr>
                                <th>Monitor Name</th>
                                <th>URL/IP</th>
                                <th>Status</th>
                                <th>Uptime %</th>
                                <th>Response Time</th>
                                <th>Type</th>
                                <th>Last Updated</th>
                            </tr>
                        </thead>
                        <tbody id="uptimerobot-tbody">
                            <!-- Data will be populated here -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        // Insert before rankings section
        main.insertBefore(uptimeSection, rankingsSection);
        
        // Populate the table
        this.populateUptimeRobotTable(monitors);
    }

    populateUptimeRobotTable(monitors) {
        const tbody = document.getElementById('uptimerobot-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        monitors.forEach(monitor => {
            const row = document.createElement('tr');
            const statusClass = this.getStatusClass(monitor.status);
            const uptimeClass = this.getQualityClass(parseFloat(monitor.uptime_percentage));
            
            // Format last check time
            const lastUpdate = this.formatLastUpdate(monitor.timestamp);
            
            row.innerHTML = `
                <td><strong>${monitor.friendly_name}</strong></td>
                <td><code class="url-code">${monitor.url}</code></td>
                <td><span class="status ${statusClass}">${monitor.status}</span></td>
                <td><span class="quality ${uptimeClass}">${monitor.uptime_percentage}%</span></td>
                <td>${monitor.response_time_ms || 0}ms</td>
                <td>${monitor.type}</td>
                <td><small>${lastUpdate}</small></td>
            `;
            
            tbody.appendChild(row);
        });
    }
}

// Enhanced ISP Monitor Class
class ISPMonitor {
    constructor() {
        this.data = [];
        this.latestData = new Map();
        this.uptimeRobot = new UptimeRobotIntegration();
        this.init();
    }

    async init() {
        // Initialize disclaimer state
        initializeDisclaimer();
        
        await this.loadData();
        this.updateDashboard();
        
        // Initialize UptimeRobot data
        await this.uptimeRobot.displayUptimeRobotData();
        
        // Auto-refresh every 5 minutes
        setInterval(() => {
            this.loadData().then(() => {
                this.updateDashboard();
                this.uptimeRobot.displayUptimeRobotData();
            });
        }, 5 * 60 * 1000);
    }

    async loadData() {
        try {
            // Load ISP monitoring data from root/data directory
            const response = await fetch('./data/logs.csv');
            const csvText = await response.text();
            this.data = this.parseCSV(csvText);
            this.processLatestData();
        } catch (error) {
            console.error('Error loading ISP data:', error);
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
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #666;">No monitoring data available yet. GitHub Actions will start collecting data every 15 minutes.</td></tr>';
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

    calculateUptimeToday(ispName) {
        const today = new Date().toISOString().split('T')[0];
        const todayData = this.data.filter(row => 
            row.isp_name === ispName && 
            row.timestamp.startsWith(today)
        );
        
        if (todayData.length === 0) return '100%';
        
        const upCount = todayData.filter(row => row.status === 'UP').length;
        const uptime = (upCount / todayData.length * 100).toFixed(1);
        return `${uptime}%`;
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
            const uptimeToday = this.calculateUptimeToday(ispName);
            
            row.innerHTML = `
                <td>${index + 1}</td>
                <td><strong>${ispName}</strong><br><small>${data.ip}</small></td>
                <td><span class="status ${data.status.toLowerCase()}">${data.status}</span></td>
                <td><span class="quality ${qualityClass}">${data.quality_score}</span></td>
                <td>${data.avg_latency}ms</td>
                <td>${data.jitter}ms</td>
                <td>${data.packet_loss}%</td>
                <td>${uptimeToday}</td>
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
