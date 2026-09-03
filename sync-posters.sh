#!/usr/bin/env bash
set -euo pipefail

SHEET_CSV_URL="https://docs.google.com/spreadsheets/d/16Doxlbfjy8Pz4djk12eq77FTgk4Cc0zZpmzY3RK4Tc0/gviz/tq?tqx=out:csv&sheet=Sheet1"
POSTERS_DIR="images"
POSTERS_JSON="posters.json"

mkdir -p "$POSTERS_DIR"

csv=$(curl -sL "$SHEET_CSV_URL")

json="["
first=true

while IFS= read -r line; do
  line=$(echo "$line" | tr -d '\r')
  [ -z "$line" ] && continue

  # skip header
  echo "$line" | grep -qi "Name.*Posters" && continue

  # extract name (field 1) and drive link (first field containing drive.google.com)
  name=$(echo "$line" | awk -F'","' '{print $1}' | sed 's/^"//;s/"$//')
  drive_link=$(echo "$line" | sed -n 's|.*\(https://drive.google.com/file/d/[^"]*\).*|\1|p')

  [ -z "$name" ] && continue
  [ -z "$drive_link" ] && continue

  file_id=$(echo "$drive_link" | sed -n 's|.*/d/\([^/]*\).*|\1|p')
  [ -z "$file_id" ] && continue

  slug=$(echo "$name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g;s/--*/-/g;s/^-//;s/-$//')
  filename="${slug}.jpg"
  filepath="${POSTERS_DIR}/${filename}"

  if [ ! -f "$filepath" ]; then
    echo "Downloading: $name -> $filepath"
    curl -sL -o "$filepath" "https://drive.google.com/uc?export=download&id=${file_id}"

    if file "$filepath" | grep -qv "image"; then
      echo "Warning: $filepath is not an image, removing"
      rm -f "$filepath"
      continue
    fi
  fi

  if [ "$first" = true ]; then
    first=false
  else
    json+=","
  fi

  json+="
  {
    \"title\": \"${name}\",
    \"image\": \"${filepath}\",
    \"buyUrl\": \"#\"
  }"

done <<< "$csv"

json+="
]
"

echo "$json" > "$POSTERS_JSON"
echo "Updated $POSTERS_JSON with $(grep -c '"title"' "$POSTERS_JSON") posters"
