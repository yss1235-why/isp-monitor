class ISPMonitor {
    constructor() {
        this.data = [];
        this.latestData = new Map();
        this.init();
    }

    async init() {
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
        }
    }

    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',');
        
        return lines.slice(1).map(line => {
            const values = line.split(',');
            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = values[index]?.trim() || '';
            });
            return row;
        });
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
