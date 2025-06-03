#!/usr/bin/env python3
import subprocess
import json
import csv
import os
import statistics
from datetime import datetime, timezone
import re

# ISP Configuration - ADD YOUR ISP IPs HERE
ISP_CONFIG = {
    "BSNL Fibre": "117.199.72.1",
    "Google": "8.8.8.8", 
    "Quad9": "9.9.9.9",
    "OpenDNS": "208.67.222.222",
    # Add your actual ISP public IPs here
    # "Your_ISP_Name": "xxx.xxx.xxx.xxx"
}

def ping_host(host, count=5):
    """Ping a host and return latency stats"""
    try:
        cmd = ["ping", "-c", str(count), host]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            return None
            
        # Parse ping output
        latencies = []
        for line in result.stdout.split('\n'):
            if 'time=' in line:
                match = re.search(r'time=([0-9.]+)', line)
                if match:
                    latencies.append(float(match.group(1)))
        
        if not latencies:
            return None
            
        # Calculate statistics
        avg_latency = statistics.mean(latencies)
        jitter = statistics.stdev(latencies) if len(latencies) > 1 else 0
        packet_loss = ((count - len(latencies)) / count) * 100
        
        return {
            'avg_latency': round(avg_latency, 2),
            'jitter': round(jitter, 2),
            'packet_loss': round(packet_loss, 2),
            'status': 'UP'
        }
        
    except Exception as e:
        print(f"Error pinging {host}: {e}")
        return None

def calculate_quality_score(latency, jitter, packet_loss):
    """Calculate ISP quality score (0-100)"""
    if packet_loss >= 100:
        return 0
    
    # Base score starts at 100
    score = 100
    
    # Deduct for latency (higher is worse)
    if latency > 50:
        score -= (latency - 50) * 0.5
    
    # Deduct for jitter (higher is worse)
    score -= jitter * 2
    
    # Deduct for packet loss (heavily penalized)
    score -= packet_loss * 10
    
    return max(0, min(100, round(score, 1)))

def ensure_directories():
    """Create necessary directories"""
    os.makedirs('data', exist_ok=True)
    os.makedirs('data/logs', exist_ok=True)

def save_to_csv(results):
    """Save results to CSV file"""
    csv_file = 'data/logs.csv'
    file_exists = os.path.exists(csv_file)
    
    with open(csv_file, 'a', newline='') as f:
        fieldnames = ['timestamp', 'isp_name', 'ip', 'status', 'avg_latency', 'jitter', 'packet_loss', 'quality_score']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        
        if not file_exists:
            writer.writeheader()
        
        for result in results:
            writer.writerow(result)

def save_to_json(results):
    """Save results to daily JSON file"""
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    json_file = f'data/logs/{today}.json'
    
    # Load existing data or create new
    if os.path.exists(json_file):
        with open(json_file, 'r') as f:
            data = json.load(f)
    else:
        data = []
    
    # Add new results
    data.extend(results)
    
    # Save updated data
    with open(json_file, 'w') as f:
        json.dump(data, f, indent=2)

def main():
    print(f"Starting ISP monitoring at {datetime.now(timezone.utc)}")
    
    ensure_directories()
    results = []
    
    for isp_name, ip in ISP_CONFIG.items():
        print(f"Pinging {isp_name} ({ip})...")
        
        ping_result = ping_host(ip)
        
        if ping_result:
            quality_score = calculate_quality_score(
                ping_result['avg_latency'],
                ping_result['jitter'], 
                ping_result['packet_loss']
            )
            
            result = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'isp_name': isp_name,
                'ip': ip,
                'status': ping_result['status'],
                'avg_latency': ping_result['avg_latency'],
                'jitter': ping_result['jitter'],
                'packet_loss': ping_result['packet_loss'],
                'quality_score': quality_score
            }
        else:
            result = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'isp_name': isp_name,
                'ip': ip,
                'status': 'DOWN',
                'avg_latency': 0,
                'jitter': 0,
                'packet_loss': 100,
                'quality_score': 0
            }
        
        results.append(result)
        print(f"  {isp_name}: {result['status']} - {result['avg_latency']}ms")
    
    # Save results
    save_to_csv(results)
    save_to_json(results)
    
    print(f"Monitoring complete. {len(results)} ISPs checked.")

if __name__ == "__main__":
    main()
