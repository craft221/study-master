#!/bin/bash
# ==================== STUDY MASTER BACKUP SCRIPT ====================
# Enterprise-grade backup solution with:
# - Full and incremental backups
# - S3/GCS upload
# - Encryption
# - Retention policies
# - Notifications

set -euo pipefail

# ==================== CONFIGURATION ====================
BACKUP_DIR="${BACKUP_DIR:-/backups}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-studymaster}"
POSTGRES_USER="${POSTGRES_USER:-studymaster}"
PGPASSWORD="${POSTGRES_PASSWORD:-}"

# S3 Configuration
S3_BUCKET="${S3_BUCKET:-}"
S3_REGION="${S3_REGION:-us-east-1}"

# Retention (in days)
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-7}"
BACKUP_KEEP_WEEKS="${BACKUP_KEEP_WEEKS:-4}"
BACKUP_KEEP_MONTHS="${BACKUP_KEEP_MONTHS:-6}"

# Encryption
ENCRYPTION_KEY="${ENCRYPTION_KEY:-}"

# Notifications
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
EMAIL_RECIPIENT="${EMAIL_RECIPIENT:-}"

# ==================== FUNCTIONS ====================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    log "ERROR: $1"
    send_notification "error" "$1"
    exit 1
}

send_notification() {
    local status="$1"
    local message="$2"

    if [[ -n "$SLACK_WEBHOOK" ]]; then
        local color="good"
        [[ "$status" == "error" ]] && color="danger"

        curl -s -X POST "$SLACK_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"Study Master Backup - ${status^^}\",
                    \"text\": \"$message\",
                    \"ts\": $(date +%s)
                }]
            }" || true
    fi
}

create_backup() {
    local backup_type="$1"  # full, daily, weekly, monthly
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="studymaster_${backup_type}_${timestamp}"
    local backup_file="${BACKUP_DIR}/${backup_name}.sql.gz"

    log "Starting $backup_type backup..."

    # Create backup directory
    mkdir -p "$BACKUP_DIR"

    # PostgreSQL dump
    export PGPASSWORD
    if ! pg_dump \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        --format=custom \
        --compress=9 \
        --verbose \
        -f "${BACKUP_DIR}/${backup_name}.dump" 2>&1; then
        error "PostgreSQL backup failed"
    fi

    # Also create SQL format for portability
    pg_dump \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        --format=plain \
        | gzip > "$backup_file"

    # Encrypt if key is provided
    if [[ -n "$ENCRYPTION_KEY" ]]; then
        log "Encrypting backup..."
        openssl enc -aes-256-cbc -salt -pbkdf2 \
            -in "$backup_file" \
            -out "${backup_file}.enc" \
            -pass "pass:$ENCRYPTION_KEY"
        rm "$backup_file"
        backup_file="${backup_file}.enc"
    fi

    # Get backup size
    local size=$(du -h "$backup_file" | cut -f1)
    log "Backup created: $backup_file ($size)"

    # Upload to S3 if configured
    if [[ -n "$S3_BUCKET" ]]; then
        upload_to_s3 "$backup_file" "$backup_type"
        upload_to_s3 "${BACKUP_DIR}/${backup_name}.dump" "$backup_type"
    fi

    echo "$backup_file"
}

upload_to_s3() {
    local file="$1"
    local backup_type="$2"
    local s3_path="s3://${S3_BUCKET}/backups/${backup_type}/$(basename $file)"

    log "Uploading to S3: $s3_path"

    if aws s3 cp "$file" "$s3_path" \
        --region "$S3_REGION" \
        --storage-class STANDARD_IA; then
        log "Upload successful"
    else
        error "S3 upload failed"
    fi
}

cleanup_old_backups() {
    log "Cleaning up old backups..."

    # Local cleanup
    find "$BACKUP_DIR" -name "studymaster_daily_*" -mtime +$BACKUP_KEEP_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "studymaster_weekly_*" -mtime +$((BACKUP_KEEP_WEEKS * 7)) -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "studymaster_monthly_*" -mtime +$((BACKUP_KEEP_MONTHS * 30)) -delete 2>/dev/null || true

    # S3 cleanup (if configured)
    if [[ -n "$S3_BUCKET" ]]; then
        aws s3 ls "s3://${S3_BUCKET}/backups/daily/" \
            --region "$S3_REGION" | \
            while read -r line; do
                createDate=$(echo "$line" | awk '{print $1" "$2}')
                createDate=$(date -d "$createDate" +%s)
                olderThan=$(date -d "-${BACKUP_KEEP_DAYS} days" +%s)
                if [[ $createDate -lt $olderThan ]]; then
                    fileName=$(echo "$line" | awk '{print $4}')
                    if [[ -n "$fileName" ]]; then
                        aws s3 rm "s3://${S3_BUCKET}/backups/daily/$fileName" \
                            --region "$S3_REGION"
                    fi
                fi
            done
    fi

    log "Cleanup completed"
}

backup_redis() {
    local redis_host="${REDIS_HOST:-redis}"
    local redis_port="${REDIS_PORT:-6379}"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${BACKUP_DIR}/redis_${timestamp}.rdb"

    log "Backing up Redis..."

    # Trigger Redis BGSAVE
    redis-cli -h "$redis_host" -p "$redis_port" BGSAVE

    # Wait for save to complete
    while [ "$(redis-cli -h "$redis_host" -p "$redis_port" LASTSAVE)" == "$(redis-cli -h "$redis_host" -p "$redis_port" LASTSAVE)" ]; do
        sleep 1
    done

    # Copy RDB file
    if [[ -f "/data/dump.rdb" ]]; then
        cp /data/dump.rdb "$backup_file"
        gzip "$backup_file"
        log "Redis backup created: ${backup_file}.gz"
    fi
}

backup_uploads() {
    local uploads_dir="${UPLOADS_DIR:-/app/uploads}"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${BACKUP_DIR}/uploads_${timestamp}.tar.gz"

    if [[ -d "$uploads_dir" ]]; then
        log "Backing up uploads..."
        tar -czf "$backup_file" -C "$(dirname $uploads_dir)" "$(basename $uploads_dir)"
        log "Uploads backup created: $backup_file"

        if [[ -n "$S3_BUCKET" ]]; then
            upload_to_s3 "$backup_file" "uploads"
        fi
    fi
}

verify_backup() {
    local backup_file="$1"

    log "Verifying backup integrity..."

    if [[ "$backup_file" == *.enc ]]; then
        # Decrypt to temporary file
        local temp_file=$(mktemp)
        openssl enc -aes-256-cbc -d -pbkdf2 \
            -in "$backup_file" \
            -out "$temp_file" \
            -pass "pass:$ENCRYPTION_KEY"
        backup_file="$temp_file"
    fi

    if [[ "$backup_file" == *.gz ]]; then
        if gzip -t "$backup_file" 2>/dev/null; then
            log "Backup verification passed"
            return 0
        else
            error "Backup verification failed - corrupted archive"
        fi
    elif [[ "$backup_file" == *.dump ]]; then
        if pg_restore --list "$backup_file" >/dev/null 2>&1; then
            log "Backup verification passed"
            return 0
        else
            error "Backup verification failed - invalid dump"
        fi
    fi
}

# ==================== MAIN ====================

main() {
    local backup_type="${1:-daily}"

    log "===== Study Master Backup Started ====="
    log "Backup type: $backup_type"

    # Determine backup type based on day
    if [[ "$backup_type" == "auto" ]]; then
        day_of_week=$(date +%u)
        day_of_month=$(date +%d)

        if [[ "$day_of_month" == "01" ]]; then
            backup_type="monthly"
        elif [[ "$day_of_week" == "7" ]]; then
            backup_type="weekly"
        else
            backup_type="daily"
        fi
    fi

    # Create database backup
    backup_file=$(create_backup "$backup_type")

    # Verify backup
    verify_backup "$backup_file"

    # Backup Redis
    backup_redis || log "Redis backup skipped"

    # Backup uploads (weekly)
    if [[ "$backup_type" == "weekly" || "$backup_type" == "monthly" ]]; then
        backup_uploads || log "Uploads backup skipped"
    fi

    # Cleanup old backups
    cleanup_old_backups

    # Send success notification
    local size=$(du -h "$backup_file" | cut -f1)
    send_notification "success" "Backup completed successfully. Type: $backup_type, Size: $size"

    log "===== Backup Completed Successfully ====="
}

# Run main function
main "$@"
