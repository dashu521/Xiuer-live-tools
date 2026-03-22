"""会员档位与礼品卡权益的后端单一规则源。"""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime
import json
from pathlib import Path
from typing import Any, Mapping, Optional

_SHARED_RULES_PATH = Path(__file__).resolve().parent.parent / "shared" / "planRules.data.json"
with _SHARED_RULES_PATH.open("r", encoding="utf-8") as f:
    _RULES = json.load(f)

TRIAL_PLAN = "trial"
LEGACY_FREE_PLAN = "free"
DEFAULT_PLAN = TRIAL_PLAN
EXPIRED_STATUS = "expired"

PAID_PLANS = tuple(_RULES["paidPlans"])
KNOWN_PLANS = tuple(_RULES["validPlans"])
PLAN_LEVELS = {plan: rule["level"] for plan, rule in _RULES["planRules"].items()}
PLAN_MAX_ACCOUNTS = {plan: rule["maxLiveAccounts"] for plan, rule in _RULES["planRules"].items()}
PLAN_CAN_USE_ALL_FEATURES = {
    plan: bool(rule["canUseAllFeatures"]) for plan, rule in _RULES["planRules"].items()
}
MEMBERSHIP_LABELS = _RULES["membershipLabels"]
TIER_BENEFITS = _RULES["tierBenefits"]
LEGACY_MEMBERSHIP_TYPE_TO_TIER = _RULES["legacyMembershipTypeToTier"]


def normalize_plan(plan: Optional[str], default: str = DEFAULT_PLAN) -> str:
    value = (plan or "").strip().lower()
    return value if value in KNOWN_PLANS else default


def normalize_tier(tier: Optional[str], default: str = "pro") -> str:
    value = (tier or "").strip().lower()
    return value if value in TIER_BENEFITS else default


def get_plan_level(plan: Optional[str]) -> int:
    return PLAN_LEVELS.get(normalize_plan(plan), PLAN_LEVELS[DEFAULT_PLAN])


def is_paid_plan(plan: Optional[str]) -> bool:
    return normalize_plan(plan) in PAID_PLANS


def can_use_all_features(plan: Optional[str]) -> bool:
    return bool(PLAN_CAN_USE_ALL_FEATURES.get(normalize_plan(plan), False))


def get_max_accounts(plan: Optional[str], fallback: Optional[int] = None) -> int:
    if fallback is not None:
        return fallback
    return PLAN_MAX_ACCOUNTS.get(normalize_plan(plan), PLAN_MAX_ACCOUNTS[DEFAULT_PLAN])


def resolve_user_max_accounts(plan: Optional[str], stored_value: Optional[int]) -> int:
    normalized_plan = normalize_plan(plan)
    if normalized_plan in (LEGACY_FREE_PLAN, TRIAL_PLAN):
        return PLAN_MAX_ACCOUNTS[normalized_plan]
    return get_max_accounts(normalized_plan, fallback=stored_value)


def resolve_membership_label(status: Optional[str]) -> str:
    normalized_status = (status or "").strip().lower()
    return MEMBERSHIP_LABELS.get(normalized_status, MEMBERSHIP_LABELS[DEFAULT_PLAN])


def build_membership_info(
    status: str,
    expire_at: Optional[datetime] = None,
    membership_type: str = "none",
) -> dict[str, Optional[str]]:
    return {
        "membership_status": status,
        "membership_label": resolve_membership_label(status),
        "membership_expire_at": expire_at.isoformat() if expire_at else None,
        "membership_type": membership_type,
    }


def infer_tier_from_membership_type(membership_type: Optional[str]) -> str:
    value = (membership_type or "").strip().lower()
    return LEGACY_MEMBERSHIP_TYPE_TO_TIER.get(value, "pro")


def get_tier_benefits(
    tier: Optional[str],
    overrides: Optional[Mapping[str, Any]] = None,
) -> dict[str, Any]:
    normalized_tier = normalize_tier(tier)
    benefits = deepcopy(TIER_BENEFITS[normalized_tier])
    if overrides:
        for key, value in overrides.items():
            if value is not None:
                benefits[key] = value
    benefits["plan"] = normalize_plan(benefits.get("plan"), default=normalized_tier)
    benefits["max_accounts"] = get_max_accounts(
        benefits["plan"],
        fallback=benefits.get("max_accounts"),
    )
    return benefits


def is_upgrade_allowed(current_plan: Optional[str], next_plan: Optional[str]) -> bool:
    return get_plan_level(next_plan) >= get_plan_level(current_plan)


def meets_minimum_plan(current_plan: Optional[str], required_plan: Optional[str]) -> bool:
    return get_plan_level(current_plan) >= get_plan_level(required_plan)
