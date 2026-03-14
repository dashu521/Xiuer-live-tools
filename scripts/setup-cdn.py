#!/usr/bin/env python3
"""
阿里云 CDN 配置脚本
使用阿里云 SDK 配置 xiuer.work CDN
"""

import os
import sys
import json
import time
import hmac
import hashlib
import base64
import urllib.parse
import urllib.request
from datetime import datetime

# 阿里云 AccessKey
ACCESS_KEY_ID = os.environ.get('ALIYUN_ACCESS_KEY_ID', '')
ACCESS_KEY_SECRET = os.environ.get('ALIYUN_ACCESS_KEY_SECRET', '')

# CDN 配置
DOMAIN_NAME = 'xiuer.work'
ORIGIN_DOMAIN = 'xiuer-work-website.oss-cn-hangzhou.aliyuncs.com'

def sign(params, access_key_secret):
    """生成阿里云 API 签名"""
    # 按参数名排序
    sorted_params = sorted(params.items())
    
    # 构造待签名字符串
    canonical_query = '&'.join([f"{k}={urllib.parse.quote(str(v), safe='')}" for k, v in sorted_params])
    
    # 构造 StringToSign
    string_to_sign = f"GET&%2F&{urllib.parse.quote(canonical_query, safe='')}"
    
    # 计算签名
    key = f"{access_key_secret}&"
    signature = base64.b64encode(hmac.new(key.encode(), string_to_sign.encode(), hashlib.sha1).digest()).decode()
    
    return signature

def call_cdn_api(action, params=None):
    """调用阿里云 CDN API"""
    if params is None:
        params = {}
    
    # 公共参数
    params['Action'] = action
    params['Format'] = 'JSON'
    params['Version'] = '2018-05-10'
    params['AccessKeyId'] = ACCESS_KEY_ID
    params['SignatureMethod'] = 'HMAC-SHA1'
    params['Timestamp'] = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    params['SignatureVersion'] = '1.0'
    params['SignatureNonce'] = str(int(time.time() * 1000))
    
    # 生成签名
    params['Signature'] = sign(params, ACCESS_KEY_SECRET)
    
    # 构造请求 URL
    query_string = '&'.join([f"{k}={urllib.parse.quote(str(v), safe='')}" for k, v in sorted(params.items())])
    url = f"https://cdn.aliyuncs.com/?{query_string}"
    
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        return {'error': str(e)}

def check_domain_exists():
    """检查域名是否已添加"""
    result = call_cdn_api('DescribeUserDomains')
    if 'error' in result:
        print(f"❌ 查询失败: {result['error']}")
        return False
    
    domains = result.get('Domains', {}).get('PageData', [])
    for domain in domains:
        if domain.get('DomainName') == DOMAIN_NAME:
            print(f"✅ 域名 {DOMAIN_NAME} 已存在")
            return True
    
    print(f"ℹ️ 域名 {DOMAIN_NAME} 未添加")
    return False

def add_domain():
    """添加 CDN 加速域名"""
    print(f"\n📝 正在添加 CDN 域名: {DOMAIN_NAME}")
    
    params = {
        'DomainName': DOMAIN_NAME,
        'CdnType': 'web',
        'Sources': json.dumps([{
            'content': ORIGIN_DOMAIN,
            'type': 'oss',
            'port': 443,
            'priority': '20'
        }]),
        'Scope': 'domestic'
    }
    
    result = call_cdn_api('AddCdnDomain', params)
    
    if 'error' in result:
        print(f"❌ 添加失败: {result['error']}")
        return False
    
    if 'Code' in result and result['Code'] != 'Success':
        print(f"❌ 添加失败: {result.get('Message', 'Unknown error')}")
        return False
    
    print(f"✅ 域名添加成功")
    return True

def get_domain_info():
    """获取域名信息"""
    params = {'DomainName': DOMAIN_NAME}
    result = call_cdn_api('DescribeCdnDomainDetail', params)
    
    if 'error' in result:
        print(f"❌ 查询失败: {result['error']}")
        return None
    
    return result.get('GetDomainDetailModel', {})

def main():
    print("=" * 60)
    print("  xiuer.work CDN 配置")
    print("=" * 60)
    
    if not ACCESS_KEY_ID or not ACCESS_KEY_SECRET:
        print("❌ 请先设置环境变量 ALIYUN_ACCESS_KEY_ID 和 ALIYUN_ACCESS_KEY_SECRET")
        sys.exit(1)
    
    print(f"\n📋 配置信息:")
    print(f"  域名: {DOMAIN_NAME}")
    print(f"  源站: {ORIGIN_DOMAIN}")
    
    # 检查域名是否已存在
    if check_domain_exists():
        print("\n✅ CDN 域名已配置")
    else:
        # 添加域名
        if add_domain():
            print("\n⏳ 等待域名配置生效...")
            time.sleep(5)
            
            # 获取域名信息
            info = get_domain_info()
            if info:
                cname = info.get('Cname', '')
                print(f"\n📌 CNAME 地址: {cname}")
                print(f"\n⚠️  请在域名解析控制台添加 CNAME 记录:")
                print(f"  主机记录: @")
                print(f"  记录类型: CNAME")
                print(f"  记录值: {cname}")
        else:
            print("\n❌ CDN 配置失败")
            sys.exit(1)
    
    print("\n" + "=" * 60)
    print("  下一步操作")
    print("=" * 60)
    print("\n1. 在阿里云域名解析控制台添加 CNAME 记录")
    print("2. 在阿里云 CDN 控制台配置 HTTPS 证书")
    print("3. 等待 DNS 生效（5-10分钟）")
    print("4. 验证访问 https://xiuer.work/")

if __name__ == '__main__':
    main()
