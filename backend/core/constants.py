from enum import Enum

class PlanType(str, Enum):
    TRIAL = "trial"
    PREMIUM = "premium"
    VITALICIO = "vitalicio"
    CANCELED = "canceled"

class AccessStatus(str, Enum):
    ACTIVE = "active"
    RESTRICTED = "restricted" # Read-only
    BLOCKED = "blocked"       # No login

class SaaSJobStatus(str, Enum):
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    STALE = "stale"

class SaaSAnnouncementType(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    SUCCESS = "success"
