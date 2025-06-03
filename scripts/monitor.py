#!/usr/bin/env python3
import subprocess
import json
import csv
import os
import statistics
from datetime import datetime, timezone
import re
import socket
import platform

# ISP Configuration - ADD YOUR ISP IPs HERE
ISP_CONFIG = {
    "BSNL": "117.199.72.1",
    "Google": "8.8.8.8", 
    "Quad9": "9.9.9.9",
    "OpenDNS": "208.67.222.222",
}

def test_connectivity():
    """Test basic internet connectivity"""
    try:
        # Try to resolve a domain name
        socket.gethostbyname('google.com')
        print("✅ Internet connectivity confirmed")
        return True
    except socket.gaierror:
        print("❌ No internet connectivity detected")
        return False

def ping_host(host, count=5):
    """Ping a host and return latency stats with improved error handling"""
    try:
        # Detect OS and use appropriate ping command
        system = platform.system().lower()
        
        if system == "windows":
            cmd = ["ping", "-n", str(count), host]
        else:
            cmd = ["ping", "-c", str(count), "-W", "10", host]  # Added timeout
        
        print(f"  Running: {' '.join(cmd)}")
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        print(f"  Return code: {result.returncode}")
        if result.stderr:
            print(f"  Stderr: {result.stderr.strip()}")
        
        if result.returncode != 0:
            print(f"  Ping failed for {host}")
            return None
            
        # Parse ping output
        latencies = []
        output_lines = result.stdout.split('\n')
        
        for line in output_lines:
            print(f"  Output line: {line}")
            if 'time=' in line:
                match = re.search(r'time=([0-9.]+)', line)
                if match:
                    latencies.append(float(match.group(1)))
        
        if not latencies:
            print(f"  No latency data found in ping output")
            return None
            
        # Calculate statistics
        avg_latency = statistics.mean(latencies)
        jitter = statistics.stdev(latencies) if len(latencies) > 1 else 0
        packet_loss = ((count - len(latencies)) / count) * 100
        
        result_data = {
            'avg_latency': round(avg_latency, 2),
            'jitter': round(jitter, 2),
            'packet_loss': round(packet_loss, 2),
            'status': 'UP'
        }
        
        print(f"  Success: {result_data}")
        return result_data
        
    except subprocess.TimeoutExpired:
        print(f"  Timeout pinging {host}")
        return None
    except Exception as e:
        print(f"  Error pinging {host}: {e}")
        return None

def test_with_curl(host):
    """Fallback test using curl/wget if ping fails"""
    try:
        import time
        start_time = time.time()
        
        # Try HTTP connection test
        cmd = ["curl", "-s", "-m", "10", f"http://{host}", "-o", "/dev/null"]
        result = subprocess.run(cmd, capture_output=True, timeout=15)
        
        end_time = time.time()
        response_time = (end_time - start_time) * 1000  # Convert to ms
        
        if result.returncode == 0:
            return {
                'avg_latency': round(response_time, 2),
                'jitter': 0,
                'packet_loss': 0,
                'status': 'UP'
            }
    except:
        pass
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
    print(f"🚀 Starting ISP monitoring at {datetime.now(timezone.utc)}")
    print(f"🖥️  Platform: {platform.system()} {platform.release()}")
    
    # Test basic connectivity first
    if not test_connectivity():
        print("❌ No internet connectivity - all ISPs will show as DOWN")
        print("This is likely a GitHub Actions network issue")
    
    ensure_directories()
    results = []
    
    for isp_name, ip in ISP_CONFIG.items():
        print(f"\n🔍 Testing {isp_name} ({ip})...")
        
        ping_result = ping_host(ip)
        
        # If ping fails, try curl as fallback
        if not ping_result:
            print(f"  Ping failed, trying HTTP test...")
            ping_result = test_with_curl(ip)
        
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
        print(f"  📊 {isp_name}: {result['status']} - {result['avg_latency']}ms")
    
    # Save results
    save_to_csv(results)
    save_to_json(results)
    
    # Summary
    up_count = len([r for r in results if r['status'] == 'UP'])
    print(f"\n✅ Monitoring complete: {up_count}/{len(results)} ISPs UP")
    
    if up_count == 0:
        print("⚠️  All ISPs DOWN - likely GitHub Actions network issue")
        print("💡 This will usually resolve itself on the next run")

if __name__ == "__main__":
    main()
