#!/bin/bash
set -e

DEST_DIR="apps/docs/content/docs"
mkdir -p "$DEST_DIR"

function process_doc() {
  local src=$1
  local dest="$DEST_DIR/$2"
  local title=$3
  local desc=$4
  
  echo "---" > "$dest"
  echo "title: \"$title\"" >> "$dest"
  echo "description: \"$desc\"" >> "$dest"
  echo "---" >> "$dest"
  echo "" >> "$dest"
  
  # Remove the first heading line if it starts with #
  awk 'NR==1 && /^# / {next} {print}' "$src" >> "$dest"
}

process_doc "README.md" "index.mdx" "Overview" "Perpetual Futures Exchange Backend Reference"
process_doc "docs/ARCHITECTURE.md" "architecture.mdx" "Architecture" "Target backend architecture and design"
process_doc "docs/API.md" "api.mdx" "API Reference" "REST API documentation"
process_doc "docs/WEBSOCKETS.md" "websockets.mdx" "WebSockets" "WebSocket subscriptions and fanout"
process_doc "docs/RECOVERY.md" "recovery.mdx" "Recovery" "Matching engine recovery and snapshots"
process_doc "docs/TESTING.md" "testing.mdx" "Testing" "Testing strategy and instructions"

rm -f "$DEST_DIR/test.mdx"

