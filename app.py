import os
import random
import base64
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, render_template, request, jsonify, g
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['DATABASE_URL'] = os.getenv('DATABASE_URL')
app.config['PROMPTS_FILE'] = 'prompts.txt'

def load_prompts():
    """Load prompts from prompts.txt file"""
    try:
        with open(app.config['PROMPTS_FILE'], 'r', encoding='utf-8') as f:
            prompts = [line.strip() for line in f if line.strip()]
        return prompts
    except FileNotFoundError:
        return ["Please create a prompts.txt file with your prompts"]

def get_db():
    """Get database connection"""
    if 'db' not in g:
        g.db = psycopg2.connect(
            app.config['DATABASE_URL'],
            cursor_factory=RealDictCursor
        )
    return g.db

@app.teardown_appcontext
def close_connection(exception):
    """Close database connection"""
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    """Initialize database with schema"""
    conn = psycopg2.connect(app.config['DATABASE_URL'])
    cur = conn.cursor()

    cur.execute('''
        CREATE TABLE IF NOT EXISTS recordings (
            id SERIAL PRIMARY KEY,
            prompt TEXT NOT NULL,
            audio BYTEA NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.commit()
    cur.close()
    conn.close()
    print("Database initialized successfully!")

@app.route('/')
def index():
    """Main recording interface"""
    return render_template('index.html')

@app.route('/complete')
def complete():
    """Completion page"""
    return render_template('complete.html')

@app.route('/api/prompt', methods=['GET'])
def get_prompt():
    """Get a random prompt from the text file"""
    prompts = load_prompts()

    if prompts:
        prompt_text = random.choice(prompts)
        return jsonify({
            'text': prompt_text
        })
    else:
        return jsonify({'error': 'No prompts available'}), 404

@app.route('/api/save-recording', methods=['POST'])
def save_recording():
    """Save an audio recording"""
    try:
        data = request.get_json()

        prompt_text = data.get('prompt_text', 'unknown')
        audio_data = data.get('audio_data')

        if not audio_data:
            return jsonify({'error': 'Missing audio data'}), 400

        audio_bytes = base64.b64decode(audio_data.split(',')[1])

        db = get_db()
        cur = db.cursor()
        cur.execute(
            'INSERT INTO recordings (prompt, audio) VALUES (%s, %s)',
            (prompt_text, psycopg2.Binary(audio_bytes))
        )
        db.commit()
        cur.close()

        return jsonify({
            'success': True,
            'message': 'Recording saved successfully'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get recording statistics"""
    db = get_db()
    cur = db.cursor()
    cur.execute('SELECT COUNT(*) as count FROM recordings')
    result = cur.fetchone()
    cur.close()

    return jsonify({
        'total_recordings': result['count']
    })

if __name__ == '__main__':
    try:
        init_db()
    except Exception as e:
        print(f"Database initialization error: {e}")

    app.run(debug=True, host='0.0.0.0', port=8000)
