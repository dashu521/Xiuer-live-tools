"""跨语言共享的功能权限规则包装。"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from subscription_rules import meets_minimum_plan, normalize_plan

_SHARED_RULES_PATH = Path(__file__).resolve().parent.parent / "shared" / "authFeatureRules.data.json"
with _SHARED_RULES_PATH.open("r", encoding="utf-8") as f:
    AUTH_FEATURE_RULES: dict[str, dict[str, Any]] = json.load(f)

DEFAULT_AUTH_FEATURE_RULE = {
    "requiresAuth": False,
    "requiredPlan": "free",
}


def is_auth_feature(feature: str) -> bool:
    return feature in AUTH_FEATURE_RULES


def get_auth_feature_rule(feature: str) -> dict[str, Any]:
    return AUTH_FEATURE_RULES.get(feature, DEFAULT_AUTH_FEATURE_RULE)


def requires_authentication(feature: str) -> bool:
    return bool(get_auth_feature_rule(feature)["requiresAuth"])


def get_required_plan(feature: str) -> str:
    return str(get_auth_feature_rule(feature)["requiredPlan"])


def build_feature_access(plan: str, is_authenticated: bool = True) -> dict[str, dict[str, Any]]:
    normalized_plan = normalize_plan(plan)
    feature_access: dict[str, dict[str, Any]] = {}

    for feature, rule in AUTH_FEATURE_RULES.items():
        requires_auth = bool(rule["requiresAuth"])
        required_plan = str(rule["requiredPlan"])
        can_access = (not requires_auth or is_authenticated) and meets_minimum_plan(
            normalized_plan,
            required_plan,
        )
        feature_access[feature] = {
            "requires_auth": requires_auth,
            "required_plan": required_plan,
            "can_access": can_access,
        }

    return feature_access
