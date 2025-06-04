#!/usr/bin/env python3
# File: scripts/sync_uptimerobot.py
# UptimeRobot Data Sync Script - Runs every 15 minutes via GitHub Actions
# Uses UPTIMEROBOT_API_KEY environment secret

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
        """Create necessary directories"""
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
                print(f"❌ UptimeRobot API Error: {error_msg}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Request error: {e}")
            return None
        except json.JSONDecodeError as e:
            print(f"❌ JSON decode error: {e}")
            return None
    
    def fetch_monitors(self):
        """Fetch all monitors from UptimeRobot API"""
        try:
            url = f"{self.base_url}getMonitors"
            data = {
                'api_key': self.api_key,
                'format': 'json',
                'logs': '1',
                'log_limit': '10',
                'response_times': '1',
                'response_times_limit': '5',
                'all_time_uptime_ratio': '1',
                'custom_uptime_ratios': '1-7-30'
            }
            
            print("📡 Fetching monitors from UptimeRobot API...")
            response = requests.post(url, data=data, timeout=60)
            response.raise_for_status()
            
            result = response.json()
            
            if result.get('stat') == 'ok':
                monitors = result.get('monitors', [])
                print(f"✅ Successfully fetched {len(monitors)} monitors")
                return monitors
            else:
                error_msg = result.get('error', {}).get('message', 'Unknown error')
                print(f"❌ UptimeRobot API Error: {error_msg}")
                return []
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Request error: {e}")
            return []
        except json.JSONDecodeError as e:
            print(f"❌ JSON decode error: {e}")
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
    
    def get_response_time(self, monitor):
        """Get the latest response time"""
        # Try response_times array first
        if monitor.get('response_times') and len(monitor['response_times']) > 0:
            return monitor['response_times'][-1].get('value', 0)
        
        # Fallback to average_response_time
        return monitor.get('average_response_time', 0)
    
    def get_uptime_percentage(self, monitor):
        """Get uptime percentage (prefer recent data)"""
        # Try 1-day ratio first (most recent)
        if monitor.get('custom_uptime_ratios') and len(monitor['custom_uptime_ratios']) > 0:
            return float(monitor['custom_uptime_ratios'][0])
        
        # Fallback to all-time ratio
        if monitor.get('all_time_uptime_ratio'):
            return float(monitor['all_time_uptime_ratio'])
        
        # Final fallback based on current status
        return 100.0 if monitor.get('status') == 2 else 0.0
    
    def process_monitor_data(self, monitors, account_info):
        """Process monitor data into standardized format"""
        processed_data = []
        timestamp = datetime.now(timezone.utc).isoformat()
        
        print(f"📊 Processing {len(monitors)} monitors...")
        
        for monitor in monitors:
            # Get uptime percentage
            uptime_percentage = self.get_uptime_percentage(monitor)
            
            # Get response time
            response_time = self.get_response_time(monitor)
            
            processed_monitor = {
                'timestamp': timestamp,
                'monitor_id': monitor.get('id'),
                'friendly_name': monitor.get('friendly_name', ''),
                'url': monitor.get('url', ''),
                'type': self.get_monitor_type(monitor.get('type')),
                'status': self.get_status_text(monitor.get('status')),
                'uptime_percentage': round(uptime_percentage, 2),
                'response_time_ms': int(response_time) if response_time else 0,
                'create_datetime': monitor.get('create_datetime', ''),
                'monitor_interval': account_info.get('monitor_interval', 5)
            }
            
            processed_data.append(processed_monitor)
            
            # Status emoji for logging
            status_emoji = "✅" if processed_monitor['status'] == 'UP' else "❌"
            print(f"  {status_emoji} {processed_monitor['friendly_name']}: {processed_monitor['status']} ({processed_monitor['uptime_percentage']}% uptime)")
            
        return processed_data
    
    def save_to_csv(self, data):
        """Save processed data to CSV file"""
        csv_file = 'data/uptimerobot/monitors.csv'
        file_exists = os.path.exists(csv_file)
        
        fieldnames = [
            'timestamp', 'monitor_id', 'friendly_name', 'url', 'type', 
            'status', 'uptime_percentage', 'response_time_ms', 
            'create_datetime', 'monitor_interval'
        ]
        
        with open(csv_file, 'a', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            
            if not file_exists:
                writer.writeheader()
            
            for row in data:
                writer.writerow(row)
        
        print(f"💾 Saved data to {csv_file}")
    
    def save_to_json(self, data):
        """Save processed data to daily JSON file"""
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        json_file = f'data/uptimerobot/{today}.json'
        
        # Load existing data for today
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
        
        print(f"💾 Saved daily data to {json_file}")
    
    def create_summary_json(self, data):
        """Create summary JSON for dashboard consumption"""
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
            monitors_up = len([m for m in data if m['status'] == 'UP'])
            monitors_down = len([m for m in data if m['status'] in ['DOWN', 'SEEMS_DOWN', 'PAUSED']])
            avg_uptime = sum(m['uptime_percentage'] for m in data) / len(data)
            
            # Calculate average response time for UP monitors only
            up_monitors = [m for m in data if m['status'] == 'UP' and m['response_time_ms'] > 0]
            avg_response = sum(m['response_time_ms'] for m in up_monitors) / len(up_monitors) if up_monitors else 0
            
            summary = {
                'last_updated': datetime.now(timezone.utc).isoformat(),
                'total_monitors': len(data),
                'monitors_up': monitors_up,
                'monitors_down': monitors_down,
                'average_uptime': round(avg_uptime, 2),
                'average_response_time': round(avg_response, 2),
                'monitors': data
            }
        
        with open('data/uptimerobot/summary.json', 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        print(f"💾 Created summary.json for dashboard")
    
    def sync_data(self):
        """Main sync function"""
        print("🚀 Starting UptimeRobot sync...")
        print(f"⏰ Time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
        print(f"🔑 API Key: {self.api_key[:10]}...")
        
        self.ensure_directories()
        
        # Verify API key
        print("\n🔐 Verifying API key...")
        account_info = self.fetch_account_details()
        if not account_info:
            print("❌ Failed to verify API key")
            return False
        
        print(f"✅ API key verified!")
        print(f"📧 Account: {account_info.get('email', 'Unknown')}")
        print(f"📊 Monitor limit: {account_info.get('monitor_limit', 'Unknown')}")
        print(f"⏱️  Check interval: {account_info.get('monitor_interval', 'Unknown')} minutes")
        
        # Small delay to respect rate limits
        time.sleep(2)
        
        # Fetch monitors
        monitors = self.fetch_monitors()
        
        if not monitors:
            print("⚠️  No monitors found. Creating empty summary.")
            self.create_summary_json([])
            return True
        
        # Process and save data
        processed_data = self.process_monitor_data(monitors, account_info)
        
        print(f"\n💾 Saving data...")
        self.save_to_csv(processed_data)
        self.save_to_json(processed_data)
        self.create_summary_json(processed_data)
        
        # Final summary
        up_count = len([m for m in processed_data if m['status'] == 'UP'])
        down_count = len([m for m in processed_data if m['status'] in ['DOWN', 'SEEMS_DOWN']])
        paused_count = len([m for m in processed_data if m['status'] == 'PAUSED'])
        
        print(f"\n✅ Sync complete!")
        print(f"📈 Summary: {up_count} UP | {down_count} DOWN | {paused_count} PAUSED")
        print(f"📁 Files updated in data/uptimerobot/")
        
        return True

def main():
    """Main function"""
    print("=" * 60)
    print("🤖 UptimeRobot Data Sync - Every 15 Minutes")
    print("=" * 60)
    
    # Get API key from environment
    api_key = os.environ.get('UPTIMEROBOT_API_KEY')
    
    if not api_key:
        print("❌ Error: UPTIMEROBOT_API_KEY environment variable not set")
        print("Please add your UptimeRobot API key to GitHub repository secrets")
        return False
    
    # Validate API key format
    if not (api_key.startswith('ur-') or api_key.startswith('u') or api_key.startswith('m')):
        print("⚠️  Warning: API key format may be incorrect")
        print("Expected format: starts with 'ur-', 'u', or 'm'")
        print(f"Received: {api_key[:10]}...")
    
    # Create syncer and run
    syncer = UptimeRobotSync(api_key)
    success = syncer.sync_data()
    
    if success:
        print("\n🎉 Sync completed successfully!")
    else:
        print("\n❌ Sync failed. Check logs above for details.")
    
    return success

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
