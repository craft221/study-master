"""
Datetime utilities - Python 3.12+ compatible
Replaces deprecated datetime.utcnow() with timezone-aware alternatives
"""
from datetime import datetime, timezone, timedelta
from typing import Optional


def utc_now() -> datetime:
    """
    Get current UTC time as timezone-aware datetime.
    Replacement for deprecated datetime.utcnow()

    Returns:
        datetime: Current UTC time with timezone info
    """
    return datetime.now(timezone.utc)


def utc_today() -> datetime:
    """
    Get today's date at midnight UTC.

    Returns:
        datetime: Today at 00:00:00 UTC
    """
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def utc_date():
    """
    Get today's date in UTC.

    Returns:
        date: Today's date in UTC
    """
    return datetime.now(timezone.utc).date()


def utc_timestamp() -> str:
    """
    Get current UTC time as ISO format string.

    Returns:
        str: ISO format timestamp
    """
    return datetime.now(timezone.utc).isoformat()


def from_timestamp(ts: float) -> datetime:
    """
    Convert Unix timestamp to timezone-aware datetime.

    Args:
        ts: Unix timestamp

    Returns:
        datetime: Timezone-aware datetime
    """
    return datetime.fromtimestamp(ts, tz=timezone.utc)


def days_ago(days: int) -> datetime:
    """
    Get datetime for N days ago.

    Args:
        days: Number of days in the past

    Returns:
        datetime: Timezone-aware datetime
    """
    return datetime.now(timezone.utc) - timedelta(days=days)


def hours_ago(hours: int) -> datetime:
    """
    Get datetime for N hours ago.

    Args:
        hours: Number of hours in the past

    Returns:
        datetime: Timezone-aware datetime
    """
    return datetime.now(timezone.utc) - timedelta(hours=hours)


def is_expired(dt: Optional[datetime], grace_period_seconds: int = 0) -> bool:
    """
    Check if a datetime has passed.

    Args:
        dt: The datetime to check
        grace_period_seconds: Additional seconds to allow

    Returns:
        bool: True if expired
    """
    if dt is None:
        return True

    now = datetime.now(timezone.utc)

    # Make dt timezone-aware if it isn't
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return now > dt + timedelta(seconds=grace_period_seconds)


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Ensure a datetime is timezone-aware (UTC).

    Args:
        dt: Input datetime

    Returns:
        datetime: Timezone-aware datetime or None
    """
    if dt is None:
        return None

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(timezone.utc)


def week_start() -> datetime:
    """
    Get the start of the current week (Monday 00:00 UTC).

    Returns:
        datetime: Start of current week
    """
    now = datetime.now(timezone.utc)
    days_since_monday = now.weekday()
    monday = now - timedelta(days=days_since_monday)
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


def month_start() -> datetime:
    """
    Get the start of the current month (1st at 00:00 UTC).

    Returns:
        datetime: Start of current month
    """
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
