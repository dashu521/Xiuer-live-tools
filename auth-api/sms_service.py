"""短信验证码服务 - 支持 dev / 阿里云国内短信(aliyun) / 阿里云短信认证(aliyun_dypns，个人免签)"""
import json
import logging
import os
import random
import string
from typing import Optional

logger = logging.getLogger(__name__)

SMS_CODE_EXPIRE_SECONDS = 300
SMS_CODE_RESEND_COOLDOWN = 60


def generate_sms_code(length: int = 6) -> str:
    return ''.join(random.choices(string.digits, k=length))


def mask_phone(phone: str) -> str:
    return f"{phone[:3]}****{phone[-4:]}"


class SMSService:
    def __init__(self):
        self.mode = os.getenv("SMS_MODE", "dev")
        self.enabled = False

    async def send(self, phone: str, code: str) -> tuple[bool, Optional[str]]:
        raise NotImplementedError

    def verify(self, phone: str, code: str) -> tuple[bool, Optional[str]]:
        """核验验证码。仅 aliyun_dypns 由阿里云核验；其他模式由业务层查库核验，此处返回 not_supported。"""
        return False, "not_supported"


class DevSMSService(SMSService):
    """开发/测试模式 - 不真正发送短信"""
    def __init__(self):
        super().__init__()
        self.mode = "dev"
        self.enabled = True
        logger.info("[SMS] Dev mode enabled - will not send real SMS")

    async def send(self, phone: str, code: str) -> tuple[bool, Optional[str]]:
        # [SECURITY] 验证码仅记录哈希值，不记录明文
        import hashlib
        code_hash = hashlib.sha256(code.encode()).hexdigest()[:8]
        logger.info(f"[SMS][DEV] phone={mask_phone(phone)} code_hash={code_hash} (masked for security)")
        return True, None


class AliyunSMSService(SMSService):
    """阿里云国内短信（需自备签名+模板）"""
    def __init__(self):
        super().__init__()
        self.mode = "aliyun"
        self.access_key_id = os.getenv("ALIYUN_ACCESS_KEY_ID", "")
        self.access_key_secret = os.getenv("ALIYUN_ACCESS_KEY_SECRET", "")
        self.sign_name = os.getenv("ALIYUN_SMS_SIGN_NAME", "")
        self.template_code = os.getenv("ALIYUN_SMS_TEMPLATE_CODE", "")

        if self.access_key_id and self.access_key_secret and self.sign_name and self.template_code:
            self.enabled = True
            logger.info("[SMS] Aliyun (Dysmsapi) mode enabled")
        else:
            self.enabled = False
            logger.warning("[SMS] Aliyun config incomplete, falling back to dev mode")

    async def send(self, phone: str, code: str) -> tuple[bool, Optional[str]]:
        if not self.enabled:
            return False, "SMS service not configured"

        try:
            from aliyunsdkcore.client import AcsClient
            from aliyunsdkcore.request import CommonRequest

            client = AcsClient(self.access_key_id, self.access_key_secret, 'cn-hangzhou')
            request = CommonRequest()
            request.set_accept_format('json')
            request.set_domain('dysmsapi.aliyuncs.com')
            request.set_method('POST')
            request.set_protocol_type('https')
            request.set_version('2017-05-25')
            request.set_action_name('SendSms')
            request.add_query_param('PhoneNumbers', phone)
            request.add_query_param('SignName', self.sign_name)
            request.add_query_param('TemplateCode', self.template_code)
            request.add_query_param('TemplateParam', f'{{"code":"{code}"}}')

            response = client.do_action_with_exception(request)
            result = json.loads(response)
            if result.get('Code') == 'OK':
                logger.info(f"[SMS] Aliyun send success: {mask_phone(phone)}")
                return True, None
            error_msg = result.get('Message', '发送失败')
            logger.error(f"[SMS] Aliyun send failed: {error_msg}")
            return False, error_msg
        except Exception as e:
            logger.exception(f"[SMS] Aliyun send exception: {e}")
            return False, str(e)


class AliyunDypnsSMSService(SMSService):
    """阿里云短信认证服务（号码认证 Dypnsapi）- 免企业资质，使用控制台赠送的签名与模板"""
    def __init__(self):
        super().__init__()
        self.mode = "aliyun_dypns"
        self.access_key_id = os.getenv("ALIYUN_ACCESS_KEY_ID", "")
        self.access_key_secret = os.getenv("ALIYUN_ACCESS_KEY_SECRET", "")
        self.sign_name = os.getenv("ALIYUN_SMS_SIGN_NAME", "")
        self.template_code = os.getenv("ALIYUN_SMS_TEMPLATE_CODE", "")

        if self.access_key_id and self.access_key_secret:
            self.enabled = True
            if self.sign_name and self.template_code:
                logger.info("[SMS] Aliyun 短信认证(Dypnsapi) mode enabled")
            else:
                logger.warning(
                    "[SMS] 短信认证已开启但未配置 ALIYUN_SMS_SIGN_NAME / ALIYUN_SMS_TEMPLATE_CODE，"
                    "请在 号码认证控制台-赠送签名/赠送模板 中获取并配置"
                )
        else:
            self.enabled = False
            logger.warning("[SMS] 短信认证需要 ALIYUN_ACCESS_KEY_ID 与 ALIYUN_ACCESS_KEY_SECRET")

    async def send(self, phone: str, code: str) -> tuple[bool, Optional[str]]:
        if not self.enabled:
            return False, "SMS service not configured"
        if not self.sign_name or not self.template_code:
            return False, "请在控制台配置赠送签名与模板：ALIYUN_SMS_SIGN_NAME、ALIYUN_SMS_TEMPLATE_CODE"

        try:
            try:
                from alibabacloud_tea_openapi import models as open_api_models
                from alibabacloud_dypnsapi20170525.client import Client
                from alibabacloud_dypnsapi20170525 import models as dypns_models
            except ImportError as ie:
                logger.exception("[SMS] 短信认证 SDK 未安装或版本不兼容: %s", ie)
                return False, "短信认证 SDK 未安装，请重建镜像并确认 requirements.txt 含 alibabacloud_dypnsapi20170525"

            config = open_api_models.Config(
                access_key_id=self.access_key_id,
                access_key_secret=self.access_key_secret,
                endpoint="dypnsapi.aliyuncs.com",
            )
            client = Client(config)
            # 使用 ##code## 由阿里云生成验证码，min 为有效期分钟数
            template_param = json.dumps({"code": "##code##", "min": "5"})
            # 【修复】只传必要字段，与控制台保持一致
            req = dypns_models.SendSmsVerifyCodeRequest(
                phone_number=phone,
                sign_name=self.sign_name,
                template_code=self.template_code,
                template_param=template_param,
                # 移除可选参数：code_length, valid_time, interval
                # 让阿里云使用默认值
            )
            # 使用空的 RuntimeOptions 对象而不是 None
            from alibabacloud_tea_util import models as util_models
            runtime = util_models.RuntimeOptions()
            resp = client.send_sms_verify_code_with_options(req, runtime)
            body = getattr(resp, 'body', None)
            if body and getattr(body, 'code', None) == 'OK':
                logger.info(f"[SMS] 短信认证发送成功: {mask_phone(phone)}")
                return True, None
            msg = (getattr(body, 'message', None) if body else None) or '发送失败'
            logger.error(f"[SMS] 短信认证发送失败: {msg}")
            return False, msg
        except Exception as e:
            logger.exception(f"[SMS] 短信认证发送异常: {e}")
            return False, str(e)

    def verify(self, phone: str, code: str) -> tuple[bool, Optional[str]]:
        if not self.enabled:
            return False, "SMS service not configured"
        try:
            try:
                from alibabacloud_tea_openapi import models as open_api_models
                from alibabacloud_dypnsapi20170525.client import Client
                from alibabacloud_dypnsapi20170525 import models as dypns_models
            except ImportError as ie:
                logger.exception("[SMS] 短信认证 SDK 未安装或版本不兼容: %s", ie)
                return False, "短信认证 SDK 未安装，请重建镜像"

            config = open_api_models.Config(
                access_key_id=self.access_key_id,
                access_key_secret=self.access_key_secret,
                endpoint="dypnsapi.aliyuncs.com",
            )
            client = Client(config)
            req = dypns_models.CheckSmsVerifyCodeRequest(
                phone_number=phone,
                verify_code=code,
            )
            # 使用空的 RuntimeOptions 对象而不是 None
            from alibabacloud_tea_util import models as util_models
            runtime = util_models.RuntimeOptions()
            resp = client.check_sms_verify_code_with_options(req, runtime)
            body = getattr(resp, 'body', None)
            if not body:
                return False, "核验无响应"
            if getattr(body, 'code', None) != 'OK':
                return False, getattr(body, 'message', None) or "核验失败"
            model = getattr(body, 'model', None)
            if model and getattr(model, 'verify_result', None) == 'PASS':
                return True, None
            return False, "验证码错误或已过期"
        except Exception as e:
            logger.exception(f"[SMS] 短信认证核验异常: {e}")
            return False, str(e)


def get_sms_service() -> SMSService:
    mode = os.getenv("SMS_MODE", "dev").strip().lower()

    if mode == "aliyun_dypns":
        service = AliyunDypnsSMSService()
        if service.enabled:
            return service
        logger.warning("[SMS] aliyun_dypns 配置不完整，使用 dev 模式")

    if mode == "aliyun":
        service = AliyunSMSService()
        if service.enabled:
            return service
        logger.warning("[SMS] Aliyun mode requested but config incomplete, using dev mode")

    return DevSMSService()
