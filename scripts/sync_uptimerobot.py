#!/usr/bin/env python3
# File: scripts/sync_uptimerobot.py
# UptimeRobot Data Sync Script for ISP Monitoring Integration
# Fetches monitor data from UptimeRobot API and saves to local files
# Compatible with free tier (1 request/minute rate limit)

import requests
import json
import csv
import os
import time
from datetime import datetime, timezone

class UptimeRobotSync:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.uptimerobot.com/v2/'
        
    def ensure_directories(self):
        """Create necessary directories (data/uptimerobot/)"""
        os.makedirs('data/uptimerobot', exist_ok=True)
        
    def fetch_account_details(self):
        """Fetch account information to verify API key"""
        try:
            url = f"{self.base_url}getAccountDetails"
            data = {
                'api_key': self.api_key,
                'format': 'json'
            }
            
            response = requests.post(url, data=data, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            
            if result.get('stat') == 'ok':
                return result.get('account', {})
            else:
                error_msg = result.get('error', {}).get('message', 'Unknown error')
                print(f"UptimeRobot API Error: {error_msg}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"Request error: {e}")
            return None
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            return None
    
    def fetch_monitors(self):
        """Fetch all monitors from UptimeRobot API"""
        try:
            url = f"{self.base_url}getMonitors"
            data = {
                'api_key': self.api_key,
                'format': 'json',
                'logs': '1',
                'log_limit': '20',
                'response_times': '1',
                'response_times_limit': '10',
                'all_time_uptime_ratio': '1',
                'custom_uptime_ratios': '1-7-30'
            }
            
            print("Fetching monitors from UptimeRobot API...")
            response = requests.post(url, data=data, timeout=60)
            response.raise_for_status()
            
            result = response.json()
            
            if result.get('stat') == 'ok':
                monitors = result.get('monitors', [])
                print(f"Successfully fetched {len(monitors)} monitors")
                return monitors
            else:
                error_msg = result.get('error', {}).get('message', 'Unknown error')
                print(f"UptimeRobot API Error: {error_msg}")
                return []
                
        except requests.exceptions.RequestException as e:
            print(f"Request error: {e}")
            return []
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            return []
    
    def get_status_text(self, status):
        """Convert status code to text"""
        status_map = {
            0: 'PAUSED',
            1: 'NOT_CHECKED_YET', 
            2: 'UP',
            8: 'SEEMS_DOWN',
            9: 'DOWN'
        }
        return status_map.get(status, 'UNKNOWN')
    
    def get_monitor_type(self, type_code):
        """Convert monitor type code to text"""
        type_map = {
            1: 'HTTP(s)',
            2: 'Keyword',
            3: 'Ping',
            4: 'Port',
            5: 'Heartbeat'
        }
        return type_map.get(type_code, 'Unknown')
    
    def calculate_response_time(self, monitor):
        """Get the latest response time"""
        # Try to get from average_response_time first
        if monitor.get('average_response_time'):
            return monitor.get('average_response_time')
        
        # Fallback to latest response time from response_times array
        response_times = monitor.get('response_times', [])
        if response_times:
            return response_times[-1].get('value', 0)
        
        return 0
    
    def process_monitor_data(self, monitors, account_info):
        """Process monitor data into standardized format"""
        processed_data = []
        timestamp = datetime.now(timezone.utc).isoformat()
        
        print(f"Processing {len(monitors)} monitors...")
        
        for monitor in monitors:
            # Get uptime percentage (prefer all-time, fallback to custom ratios)
            uptime_percentage = monitor.get('all_time_uptime_ratio', 0)
            if uptime_percentage == 0 and monitor.get('custom_uptime_ratios'):
                # Use 30-day ratio if available
                custom_ratios = monitor.get('custom_uptime_ratios', [])
                if len(custom_ratios) >= 3:
                    uptime_percentage = custom_ratios[2]  # 30-day ratio
                elif len(custom_ratios) >= 2:
                    uptime_percentage = custom_ratios[1]  # 7-day ratio
                elif len(custom_ratios) >= 1:
                    uptime_percentage = custom_ratios[0]  # 1-day ratio
            
            # Get response time
            response_time = self.calculate_response_time(monitor)
            
            processed_monitor = {
                'timestamp': timestamp,
                'monitor_id': monitor.get('id'),
                'friendly_name': monitor.get('friendly_name', ''),
                'url': monitor.get('url', ''),
                'type': self.get_monitor_type(monitor.get('type')),
                'status': self.get_status_text(monitor.get('status')),
                'uptime_percentage': float(uptime_percentage) if uptime_percentage else 0.0,
                'response_time_ms': int(response_time) if response_time else 0,
                'create_datetime': monitor.get('create_datetime', ''),
                'monitor_interval': account_info.get('monitor_interval', 5),
                'keyword_type': monitor.get('keyword_type', ''),
                'keyword_value': monitor.get('keyword_value', ''),
                'ssl_info': json.dumps(monitor.get('ssl', {})) if monitor.get('ssl') else ''
            }
            
            processed_data.append(processed_monitor)
            print(f"  ✓ {processed_monitor['friendly_name']}: {processed_monitor['status']} ({processed_monitor['uptime_percentage']}%)")
            
        return processed_data
    
    def save_to_csv(self, data):
        """Save processed data to CSV file in data/uptimerobot/monitors.csv"""
        csv_file = 'data/uptimerobot/monitors.csv'
        file_exists = os.path.exists(csv_file)
        
        fieldnames = [
            'timestamp', 'monitor_id', 'friendly_name', 'url', 'type', 
            'status', 'uptime_percentage', 'response_time_ms', 
            'create_datetime', 'monitor_interval', 'keyword_type', 
            'keyword_value', 'ssl_info'
        ]
        
        with open(csv_file, 'a', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            
            if not file_exists:
                writer.writeheader()
            
            for row in data:
                writer.writerow(row)
        
        print(f"✓ Saved data to {csv_file}")
    
    def save_to_json(self, data):
        """Save processed data to daily JSON file in data/uptimerobot/YYYY-MM-DD.json"""
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        json_file = f'data/uptimerobot/{today}.json'
        
        # Load existing data
        if os.path.exists(json_file):
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    existing_data = json.load(f)
            except (json.JSONDecodeError, IOError):
                existing_data = []
        else:
            existing_data = []
        
        # Add new data
        existing_data.extend(data)
        
        # Save updated data
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(existing_data, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Saved data to {json_file}")
    
    def create_summary_json(self, data):
        """Create a summary JSON for easy consumption by JavaScript in data/uptimerobot/summary.json"""
        if not data:
            summary = {
                'last_updated': datetime.now(timezone.utc).isoformat(),
                'total_monitors': 0,
                'monitors_up': 0,
                'monitors_down': 0,
                'average_uptime': 0,
                'average_response_time': 0,
                'monitors': []
            }
        else:
            summary = {
                'last_updated': datetime.now(timezone.utc).isoformat(),
                'total_monitors': len(data),
                'monitors_up': len([m for m in data if m['status'] == 'UP']),
                'monitors_down': len([m for m in data if m['status'] in ['DOWN', 'SEEMS_DOWN']]),
                'average_uptime': round(sum(m['uptime_percentage'] for m in data) / len(data), 2),
                'average_response_time': round(sum(m['response_time_ms'] for m in data) / len(data), 2),
                'monitors': data
            }
        
        with open('data/uptimerobot/summary.json', 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Created summary.json")
    
    def sync_data(self):
        """Main sync function"""
        print(f"🚀 Starting UptimeRobot sync at {datetime.now(timezone.utc)}")
        print(f"API Key: {self.api_key[:10]}...")
        
        self.ensure_directories()
        
        # First, verify API key with account details
        print("\n📊 Verifying API key...")
        account_info = self.fetch_account_details()
        if not account_info:
            print("❌ Failed to verify API key. Please check your UPTIMEROBOT_API_KEY secret.")
            return False
        
        print(f"✅ API key valid! Account: {account_info.get('email', 'Unknown')}")
        print(f"📈 Monitor limit: {account_info.get('monitor_limit', 'Unknown')}")
        print(f"⏱️ Check interval: {account_info.get('monitor_interval', 'Unknown')} minutes")
        
        # Respect rate limit (1 request/minute for free tier)
        print("\n⏳ Waiting 5 seconds between API calls (rate limit respect)...")
        time.sleep(5)
        
        # Fetch monitors
        monitors = self.fetch_monitors()
        
        if not monitors:
            print("⚠️ No monitors found or API error. Creating empty summary.")
            self.create_summary_json([])
            return True
        
        print(f"\n📋 Processing monitor data...")
        processed_data = self.process_monitor_data(monitors, account_info)
        
        # Save data in multiple formats
        print(f"\n💾 Saving data...")
        self.save_to_csv(processed_data)
        self.save_to_json(processed_data)
        self.create_summary_json(processed_data)
        
        # Print final summary
        up_count = len([m for m in processed_data if m['status'] == 'UP'])
        down_count = len([m for m in processed_data if m['status'] in ['DOWN', 'SEEMS_DOWN']])
        paused_count = len([m for m in processed_data if m['status'] == 'PAUSED'])
        
        print(f"\n✅ UptimeRobot sync complete!")
        print(f"📊 Summary: {up_count} UP, {down_count} DOWN, {paused_count} PAUSED")
        print(f"📁 Files created in data/uptimerobot/")
        
        return True

def main():
    """Main function"""
    print("=" * 60)
    print("🤖 UptimeRobot Data Sync for GitHub ISP Monitor")
    print("=" * 60)
    
    # Get API key from environment
    api_key = os.environ.get('UPTIMEROBOT_API_KEY')
    
    if not api_key:
        print("❌ Error: UPTIMEROBOT_API_KEY environment variable not set")
        print("Please add your UptimeRobot API key to GitHub Secrets")
        print("Your API Key: u2969607-0a95611c9802fc89b7c4ba93")
        return False
    
    # Validate API key format
    if not (api_key.startswith('ur-') or api_key.startswith('u') or api_key.startswith('m')):
        print("❌ Error: Invalid UptimeRobot API key format")
        print("API key should start with 'ur-', 'u', or 'm'")
        print(f"Received: {api_key[:10]}...")
        return False
    
    # Create syncer and run
    syncer = UptimeRobotSync(api_key)
    success = syncer.sync_data()
    
    if success:
        print("\n🎉 Sync completed successfully!")
    else:
        print("\n❌ Sync failed. Check the logs above for details.")
    
    return success

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
