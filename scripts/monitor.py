#!/usr/bin/env python3
import subprocess
import json
import csv
import os
import statistics
from datetime import datetime, timezone
import re
import socket
import time
import urllib.request
import urllib.error

# ISP Configuration with HTTP fallback URLs
ISP_CONFIG = {
    "BSNL": {
        "ip": "117.199.72.1",
        "http_test": "http://117.199.72.1"  # Try HTTP if ping fails
    },
    "Google": {
        "ip": "8.8.8.8",
        "http_test": "https://dns.google"  # Google DNS over HTTPS
    },
    "Cloudflare": {
        "ip": "1.1.1.1", 
        "http_test": "https://1.1.1.1"   # Cloudflare DNS over HTTPS
    },
    "OpenDNS": {
        "ip": "208.67.222.222",
        "http_test": "https://www.opendns.com"
    },
    "Quad9": {
        "ip": "9.9.9.9",
        "http_test": "https://www.quad9.net"
    }
}

def ping_host(host, count=5):
    """Standard ping test"""
    try:
        cmd = ["ping", "-c", str(count), "-W", "10", host]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        if result.returncode != 0:
            return None
            
        latencies = []
        for line in result.stdout.split('\n'):
            if 'time=' in line:
                match = re.search(r'time=([0-9.]+)', line)
                if match:
                    latencies.append(float(match.group(1)))
        
        if not latencies:
            return None
            
        avg_latency = statistics.mean(latencies)
        jitter = statistics.stdev(latencies) if len(latencies) > 1 else 0
        packet_loss = ((count - len(latencies)) / count) * 100
        
        return {
            'avg_latency': round(avg_latency, 2),
            'jitter': round(jitter, 2),
            'packet_loss': round(packet_loss, 2),
            'status': 'UP',
            'method': 'PING'
        }
        
    except Exception as e:
        print(f"  Ping failed: {e}")
        return None

def http_test(url, timeout=10):
    """HTTP connectivity test as fallback"""
    try:
        start_time = time.time()
        
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'ISP-Monitor/1.0')
        
        with urllib.request.urlopen(req, timeout=timeout) as response:
            end_time = time.time()
            response_time = (end_time - start_time) * 1000
            
            if response.status == 200:
                return {
                    'avg_latency': round(response_time, 2),
                    'jitter': 0,  # Can't calculate jitter from single HTTP request
                    'packet_loss': 0,
                    'status': 'UP',
                    'method': 'HTTP'
                }
    
    except urllib.error.URLError as e:
        print(f"  HTTP test failed: {e}")
    except Exception as e:
        print(f"  HTTP test error: {e}")
    
    return None

def test_connectivity(isp_name, config):
    """Test ISP using ping first, then HTTP fallback"""
    ip = config["ip"]
    http_url = config.get("http_test")
    
    print(f"🔍 Testing {isp_name} ({ip})...")
    
    # Try ping first
    result = ping_host(ip)
    if result:
        print(f"  ✅ PING successful: {result['avg_latency']}ms")
        return result
    
    # If ping fails and HTTP test available, try HTTP
    if http_url:
        print(f"  🔄 Ping failed, trying HTTP test: {http_url}")
        result = http_test(http_url)
        if result:
            print(f"  ✅ HTTP successful: {result['avg_latency']}ms")
            return result
    
    print(f"  ❌ All tests failed for {isp_name}")
    return None

def calculate_quality_score(latency, jitter, packet_loss):
    """Calculate ISP quality score (0-100)"""
    if packet_loss >= 100:
        return 0
    
    score = 100
    if latency > 50:
        score -= (latency - 50) * 0.5
    score -= jitter * 2
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
        fieldnames = ['timestamp', 'isp_name', 'ip', 'status', 'avg_latency', 'jitter', 'packet_loss', 'quality_score', 'test_method']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        
        if not file_exists:
            writer.writeheader()
        
        for result in results:
            writer.writerow(result)

def save_to_json(results):
    """Save results to daily JSON file"""
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    json_file = f'data/logs/{today}.json'
    
    if os.path.exists(json_file):
        with open(json_file, 'r') as f:
            data = json.load(f)
    else:
        data = []
    
    data.extend(results)
    
    with open(json_file, 'w') as f:
        json.dump(data, f, indent=2)

def main():
    print(f"🚀 Starting ISP monitoring at {datetime.now(timezone.utc)}")
    
    ensure_directories()
    results = []
    
    for isp_name, config in ISP_CONFIG.items():
        result_data = test_connectivity(isp_name, config)
        
        if result_data:
            quality_score = calculate_quality_score(
                result_data['avg_latency'],
                result_data['jitter'], 
                result_data['packet_loss']
            )
            
            result = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'isp_name': isp_name,
                'ip': config["ip"],
                'status': result_data['status'],
                'avg_latency': result_data['avg_latency'],
                'jitter': result_data['jitter'],
                'packet_loss': result_data['packet_loss'],
                'quality_score': quality_score,
                'test_method': result_data['method']
            }
        else:
            result = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'isp_name': isp_name,
                'ip': config["ip"],
                'status': 'DOWN',
                'avg_latency': 0,
                'jitter': 0,
                'packet_loss': 100,
                'quality_score': 0,
                'test_method': 'FAILED'
            }
        
        results.append(result)
        print(f"  📊 {isp_name}: {result['status']} - {result['avg_latency']}ms")
    
    save_to_csv(results)
    save_to_json(results)
    
    up_count = len([r for r in results if r['status'] == 'UP'])
    print(f"\n✅ Monitoring complete: {up_count}/{len(results)} ISPs UP")

if __name__ == "__main__":
    main()
