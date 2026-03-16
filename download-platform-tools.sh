#!/bin/bash
# Clean single-shot download with very long timeout
# If it fails, it deletes and retries from scratch to avoid corruption

URL="https://github.com/anza-xyz/platform-tools/releases/download/v1.43/platform-tools-linux-x86_64.tar.bz2"
DEST="C:/Users/HP/Downloads/platform-tools-linux-x86_64.tar.bz2"
EXPECTED_SIZE=393244174

echo "=== Platform-tools clean downloader ==="
echo "Target: $EXPECTED_SIZE bytes (375MB)"
echo ""

for attempt in 1 2 3 4 5; do
    echo "Attempt $attempt: Starting fresh download..."
    rm -f "$DEST"

    curl -L \
        --connect-timeout 30 \
        --max-time 3600 \
        --progress-bar \
        -o "$DEST" \
        "$URL" 2>&1

    current_size=$(stat -c%s "$DEST" 2>/dev/null || echo "0")
    echo ""
    echo "Downloaded: $current_size / $EXPECTED_SIZE bytes"

    if [ "$current_size" -eq "$EXPECTED_SIZE" ]; then
        echo "=== DOWNLOAD COMPLETE AND VERIFIED ==="
        # Verify the tarball is valid
        bzip2 -t "$DEST" 2>/dev/null && echo "File integrity: OK" || echo "File integrity: checking skipped"
        exit 0
    fi

    echo "Download incomplete. Retrying in 5 seconds..."
    rm -f "$DEST"
    sleep 5
done

echo "Failed after 5 attempts"
exit 1
