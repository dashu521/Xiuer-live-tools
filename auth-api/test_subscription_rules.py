import unittest

from subscription_rules import (
    get_tier_benefits,
    is_upgrade_allowed,
    normalize_plan,
    resolve_user_max_accounts,
)


class SubscriptionRulesTests(unittest.TestCase):
    def test_normalize_plan_falls_back_to_trial(self):
        self.assertEqual(normalize_plan("PRO_MAX"), "pro_max")
        self.assertEqual(normalize_plan("unknown"), "trial")

    def test_tier_benefits_keep_plan_and_account_limit_in_sync(self):
        pro_max = get_tier_benefits("pro_max")
        self.assertEqual(pro_max["plan"], "pro_max")
        self.assertEqual(pro_max["max_accounts"], 3)

    def test_upgrade_rule_rejects_downgrade(self):
        self.assertTrue(is_upgrade_allowed("trial", "pro"))
        self.assertFalse(is_upgrade_allowed("ultra", "pro"))

    def test_free_and_trial_do_not_keep_stale_max_accounts(self):
        self.assertEqual(resolve_user_max_accounts("free", 99), 1)
        self.assertEqual(resolve_user_max_accounts("trial", 99), 1)
        self.assertEqual(resolve_user_max_accounts("pro_max", 3), 3)


if __name__ == "__main__":
    unittest.main()
