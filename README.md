# 📡 ISP Uptime & Quality Monitoring WebApp

Monitor multiple ISPs by pinging their public IPs every 15 minutes using GitHub Actions. Track uptime, latency, jitter, packet loss, and quality scores.

## 🚀 Quick Setup

1. **Fork this repository**
2. **Edit ISP IPs** in `scripts/monitor.py`
3. **Enable GitHub Actions** in your repo settings
4. **Enable GitHub Pages** pointing to `/web` folder
5. **Wait 15 minutes** for first data collection

## 🔧 Configuration

Edit the `ISP_CONFIG` dictionary in `scripts/monitor.py`:

```python
ISP_CONFIG = {
    "Your_ISP_Name": "xxx.xxx.xxx.xxx",
    "Backup_ISP": "yyy.yyy.yyy.yyy"
}
```

## 📊 Dashboard

Access your live dashboard at:
`https://yourusername.github.io/isp-monitor/`

## 📈 Features

- ✅ Automated monitoring every 15 minutes
- 📊 Real-time dashboard with ISP rankings
- 📉 Latency, jitter, and packet loss tracking
- ⏱️ Uptime/downtime history
- 🏆 Quality scoring and ISP comparison

## 🛠️ How It Works

1. GitHub Actions runs `monitor.py` every 15 minutes
2. Script pings all configured ISP IPs
3. Results saved to CSV and JSON files
4. Dashboard reads data and displays live stats

## 📁 Project Structure

```
isp-monitor/
├── .github/workflows/ping.yml    # GitHub Action (runs every 15 mins)
├── data/
│   ├── logs.csv                  # Main CSV log file
│   └── logs/                     # JSON logs directory
├── scripts/monitor.py            # Python monitoring script
├── web/
│   ├── index.html               # Dashboard UI
│   ├── script.js                # JavaScript for dashboard
│   └── style.css                # CSS styling
└── README.md
```

## 🧪 ISP Quality Metrics

| Metric        | Description                       |
| ------------- | --------------------------------- |
| Latency       | Average ping time (ms)            |
| Jitter        | Std deviation of ping (ms)        |
| Packet Loss   | % of failed ping requests         |
| Quality Score | Computed from jitter/latency/loss |

## 🔍 How Downtime Is Calculated

- One check = every 15 minutes
- If no ping response → `DOWN`
- Continuous DOWNs are merged as one event
- Downtime duration = total minutes from first to last DOWN

## 🎯 Setup Instructions

1. Create a new GitHub repository called `isp-monitor`
2. Upload all project files to your repository
3. Edit the `ISP_CONFIG` in `scripts/monitor.py` with your ISP IPs
4. Enable GitHub Actions in repository settings
5. Enable GitHub Pages pointing to the `/web` folder
6. Wait 15 minutes for the first automated run

Your dashboard will be live at: `https://yourusername.github.io/isp-monitor/`

## 🧾 Future Ideas

- Add alerts (email, webhook) for downtime
- Add charts (latency over time)
- Export reports (PDF/CSV)
- Monitor from multiple regions

## 📄 License

MIT License

Made with ❤️ for network monitoring
