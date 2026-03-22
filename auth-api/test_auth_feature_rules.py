import unittest

from auth_feature_rules import (
    build_feature_access,
    get_auth_feature_rule,
    get_required_plan,
    is_auth_feature,
    requires_authentication,
)


class AuthFeatureRulesTests(unittest.TestCase):
    def test_known_feature_rule(self):
        self.assertTrue(is_auth_feature("auto_reply"))
        self.assertTrue(requires_authentication("auto_reply"))
        self.assertEqual(get_required_plan("auto_reply"), "trial")
        self.assertTrue(requires_authentication("live_control"))
        self.assertEqual(get_required_plan("live_control"), "trial")

    def test_unknown_feature_uses_safe_default(self):
        self.assertFalse(is_auth_feature("unknown_feature"))
        self.assertFalse(requires_authentication("unknown_feature"))
        self.assertEqual(get_required_plan("unknown_feature"), "trial")
        self.assertEqual(
            get_auth_feature_rule("unknown_feature"),
            {"requiresAuth": False, "requiredPlan": "trial"},
        )

    def test_build_feature_access_uses_plan_thresholds(self):
        feature_access = build_feature_access("trial")
        self.assertTrue(feature_access["auto_reply"]["can_access"])
        self.assertFalse(feature_access["ai_chat"]["can_access"])
        self.assertEqual(feature_access["ai_chat"]["required_plan"], "pro")


if __name__ == "__main__":
    unittest.main()
