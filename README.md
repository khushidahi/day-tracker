# Day Tracker 📅

A personal day tracking app that visualizes your day in 5-minute blocks. Create custom time blocks, log accomplishments, and review your history.

## Features

- **5-minute block visualization** - See your entire day at a glance
- **Custom time blocks** - Create named periods (e.g., "Deep work", "Meetings", "Lunch")
- **Color coding** - Assign colors to distinguish different activities
- **Accomplishment logging** - Record what you achieved in each time block
- **Persistent storage** - All data saved locally as JSON files
- **History browser** - Go back to any previous day and review your logs
- **Real-time progress** - See the current time highlighted on today's view

## Quick Start

### Prerequisites
- Node.js (v14 or higher)

### Installation

1. Navigate to the project directory:
   ```bash
   cd day-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open your browser to:
   ```
   http://localhost:3000
   ```

## Usage

### Creating a Time Block
1. Click and drag on the grid to select a time range
2. Enter a name for the block (e.g., "Morning standup")
3. Pick a color
4. Click "Create Block"

### Logging Accomplishments
- Each time block has a text area where you can write what you accomplished
- Notes auto-save as you type

### Viewing History
- Click "History" in the navigation to see all your logged days
- Click on any day to view its details (read-only for past days)

### Keyboard Shortcuts
- `Enter` in the block name field to quickly create a block
- `←` / `→` buttons to navigate between days

## Data Storage

All data is stored in the `data/` folder as JSON files:
- Each day gets its own file: `YYYY-MM-DD.json`
- Files are human-readable and can be backed up easily

Example data structure:
```json
{
  "timeBlocks": [
    {
      "id": 1706612400000,
      "name": "Deep work on RAG system",
      "startBlock": 108,
      "endBlock": 143,
      "color": "#4facfe",
      "accomplishment": "Implemented semantic search improvements",
      "createdAt": "2026-01-30T09:00:00.000Z"
    }
  ],
  "lastModified": "2026-01-30T15:30:00.000Z"
}
```

## Configuration

### Port
By default, the server runs on port 3000. To change it:
```bash
PORT=8080 npm start
```

### Data Directory
Data is stored in `./data/` relative to the project root. You can back up this folder to preserve your history.

## Project Structure

```
day-tracker/
├── server.js          # Express server with API endpoints
├── package.json       # Dependencies and scripts
├── public/
│   └── index.html     # Main application (single-page app)
├── data/              # JSON files for each day (created automatically)
│   ├── 2026-01-30.json
│   └── ...
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/day/:date` | Get data for a specific date |
| POST | `/api/day/:date` | Save data for a specific date |
| GET | `/api/days` | Get list of all days with data |
| DELETE | `/api/day/:date` | Delete a day's data |

