#!/bin/bash
# 强制只用密码、关闭密钥，看是否有密码提示
# 若仍无反应，等 20 秒后按 Ctrl+C，把终端里所有输出发给我

ssh -o PubkeyAuthentication=no -o PreferredAuthentications=password -o KbdInteractiveAuthentication=no -v root@121.41.179.197
