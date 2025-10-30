#!/usr/bin/env python3
"""
Download all audio recordings from PostgreSQL database
"""

import psycopg2
from dotenv import load_dotenv
import os
from datetime import datetime

# Load environment variables
load_dotenv()

def download_all_recordings():
    """Download all recordings from PostgreSQL to local files"""

    # Create downloads directory
    download_dir = 'downloads'
    os.makedirs(download_dir, exist_ok=True)

    # Connect to database
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    cur = conn.cursor()

    # Get all recordings
    print("Fetching recordings from database...")
    cur.execute("""
        SELECT id, prompt, audio, created_at
        FROM recordings
        ORDER BY created_at DESC
    """)

    recordings = cur.fetchall()

    if not recordings:
        print("No recordings found in database.")
        cur.close()
        conn.close()
        return

    print(f"\nFound {len(recordings)} recording(s)")
    print("=" * 70)

    # Download each recording
    csv_data = []
    csv_data.append("ID,Prompt,Filename,Date")

    for row in recordings:
        record_id = row[0]
        prompt = row[1]
        audio_bytes = bytes(row[2])  # Convert memoryview to bytes
        created_at = row[3]

        # Create safe filename
        safe_prompt = ''.join(c for c in prompt[:50] if c.isalnum() or c in ' -_').strip().replace(' ', '_')
        timestamp = created_at.strftime('%Y%m%d_%H%M%S')
        filename = f"{record_id}_{safe_prompt}_{timestamp}.webm"
        filepath = os.path.join(download_dir, filename)

        # Save audio file
        with open(filepath, 'wb') as f:
            f.write(audio_bytes)

        # Add to CSV data
        csv_data.append(f'{record_id},"{prompt}",{filename},{created_at}')

        # Print progress
        size_kb = len(audio_bytes) / 1024
        print(f"✓ Downloaded: {filename} ({size_kb:.1f} KB)")
        print(f"  Prompt: {prompt}")
        print(f"  Date: {created_at}")
        print()

    # Save CSV file
    csv_file = os.path.join(download_dir, 'recordings.csv')
    with open(csv_file, 'w') as f:
        f.write('\n'.join(csv_data))

    print("=" * 70)
    print(f"✓ All recordings downloaded to: {download_dir}/")
    print(f"✓ Index file created: {csv_file}")

    cur.close()
    conn.close()

def show_database_stats():
    """Show statistics about recordings in database"""
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    cur = conn.cursor()

    # Count total recordings
    cur.execute("SELECT COUNT(*) FROM recordings")
    total = cur.fetchone()[0]

    # Get total audio size
    cur.execute("SELECT SUM(LENGTH(audio)) FROM recordings")
    total_size = cur.fetchone()[0] or 0
    total_size_mb = total_size / (1024 * 1024)

    # Get date range
    cur.execute("""
        SELECT MIN(created_at), MAX(created_at)
        FROM recordings
    """)
    date_range = cur.fetchone()

    print("\nDatabase Statistics")
    print("=" * 70)
    print(f"Total recordings: {total}")
    print(f"Total size: {total_size_mb:.2f} MB")
    if date_range[0]:
        print(f"Date range: {date_range[0]} to {date_range[1]}")
    print("=" * 70)

    cur.close()
    conn.close()

if __name__ == '__main__':
    try:
        show_database_stats()
        print()
        download_all_recordings()
        print("\n✓ Download complete! Check the 'downloads/' folder.")
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
