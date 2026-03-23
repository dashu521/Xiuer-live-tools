import asyncio
import os
import sys
import types
import unittest


os.environ["ALIYUN_ACCESS_KEY_ID"] = "test-ak"
os.environ["ALIYUN_ACCESS_KEY_SECRET"] = "test-sk"
os.environ["ALIYUN_SMS_SIGN_NAME"] = "test-sign"
os.environ["ALIYUN_SMS_TEMPLATE_CODE"] = "test-template"

from sms_service import AliyunDypnsSMSService  # noqa: E402


class SmsServiceTests(unittest.TestCase):
    def test_aliyun_dypns_send_forces_six_digit_code(self):
        captured_request = {}

        class FakeConfig:
            def __init__(self, **kwargs):
                self.kwargs = kwargs

        class FakeRequest:
            def __init__(self, **kwargs):
                captured_request.update(kwargs)

        class FakeClient:
            def __init__(self, config):
                self.config = config

            def send_sms_verify_code_with_options(self, req, runtime):
                return types.SimpleNamespace(body=types.SimpleNamespace(code="OK"))

        fake_openapi_models = types.SimpleNamespace(Config=FakeConfig)
        fake_dypns_models = types.SimpleNamespace(SendSmsVerifyCodeRequest=FakeRequest)
        fake_runtime_models = types.SimpleNamespace(RuntimeOptions=lambda: object())

        fake_openapi_module = types.ModuleType("alibabacloud_tea_openapi")
        fake_openapi_module.models = fake_openapi_models
        fake_dypns_client_module = types.ModuleType("alibabacloud_dypnsapi20170525.client")
        fake_dypns_client_module.Client = FakeClient
        fake_dypns_module = types.ModuleType("alibabacloud_dypnsapi20170525")
        fake_dypns_module.models = fake_dypns_models
        fake_tea_util_module = types.ModuleType("alibabacloud_tea_util")
        fake_tea_util_module.models = fake_runtime_models

        original_modules = {
            name: sys.modules.get(name)
            for name in (
                "alibabacloud_tea_openapi",
                "alibabacloud_dypnsapi20170525.client",
                "alibabacloud_dypnsapi20170525",
                "alibabacloud_tea_util",
            )
        }

        sys.modules["alibabacloud_tea_openapi"] = fake_openapi_module
        sys.modules["alibabacloud_dypnsapi20170525.client"] = fake_dypns_client_module
        sys.modules["alibabacloud_dypnsapi20170525"] = fake_dypns_module
        sys.modules["alibabacloud_tea_util"] = fake_tea_util_module

        try:
            service = AliyunDypnsSMSService()
            success, error = asyncio.run(service.send("13800138000", "123456"))
        finally:
            for name, module in original_modules.items():
                if module is None:
                    sys.modules.pop(name, None)
                else:
                    sys.modules[name] = module

        self.assertTrue(success)
        self.assertIsNone(error)
        self.assertEqual(captured_request["code_length"], 6)
        self.assertEqual(captured_request["code_type"], 1)
        self.assertEqual(captured_request["template_param"], '{"code": "##code##", "min": "5"}')


if __name__ == "__main__":
    unittest.main()
