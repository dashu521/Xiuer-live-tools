"""
数据库迁移脚本：合并重复手机号用户
问题：同一个手机号可能创建了多个用户（密码注册和短信登录各一个）
解决：保留最早创建的用户，合并数据
"""

import sqlite3
import sys
from datetime import datetime

DB_PATH = '/Users/xiuer/TRAE-CN/tasi-live-supertool/auth-api/data/users.db'


def find_duplicate_phone_users(conn):
    """查找有重复手机号的用户"""
    cursor = conn.cursor()
    cursor.execute('''
        SELECT phone, COUNT(*) as count, GROUP_CONCAT(id) as user_ids
        FROM users
        WHERE phone IS NOT NULL AND phone != ''
        GROUP BY phone
        HAVING count > 1
    ''')
    return cursor.fetchall()


def merge_user_data(conn, keep_user_id, merge_user_ids):
    """合并用户数据"""
    cursor = conn.cursor()
    
    for merge_id in merge_user_ids:
        if merge_id == keep_user_id:
            continue
            
        print(f"  合并用户 {merge_id} -> {keep_user_id}")
        
        # 更新 trials 表
        cursor.execute('''
            UPDATE trials SET username = ?
            WHERE username = ?
        ''', (keep_user_id, merge_id))
        
        # 更新 gift_card_redemptions 表
        cursor.execute('''
            UPDATE gift_card_redemptions SET user_id = ?
            WHERE user_id = ?
        ''', (keep_user_id, merge_id))
        
        # 更新 refresh_tokens 表
        cursor.execute('''
            UPDATE refresh_tokens SET user_id = ?
            WHERE user_id = ?
        ''', (keep_user_id, merge_id))
        
        # 删除重复用户
        cursor.execute('DELETE FROM users WHERE id = ?', (merge_id,))
        
        print(f"  已删除重复用户: {merge_id}")


def migrate():
    """执行迁移"""
    print("=" * 60)
    print("合并重复手机号用户")
    print("=" * 60)
    print(f"数据库: {DB_PATH}")
    print()
    
    conn = sqlite3.connect(DB_PATH)
    
    # 查找重复用户
    duplicates = find_duplicate_phone_users(conn)
    
    if not duplicates:
        print("未发现重复手机号用户")
        conn.close()
        return
    
    print(f"发现 {len(duplicates)} 个重复手机号:")
    print()
    
    for phone, count, user_ids in duplicates:
        print(f"手机号: {phone}")
        print(f"  重复用户数: {count}")
        
        user_id_list = user_ids.split(',')
        
        # 查询这些用户的详细信息
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, username, email, created_at, last_login_at, plan
            FROM users
            WHERE id IN ({})
            ORDER BY created_at ASC
        '''.format(','.join(['?' for _ in user_id_list])), user_id_list)
        
        users = cursor.fetchall()
        
        print(f"  用户列表:")
        for i, (uid, username, email, created_at, last_login_at, plan) in enumerate(users):
            print(f"    {i+1}. ID: {uid}")
            print(f"       Username: {username}")
            print(f"       Email: {email}")
            print(f"       Created: {created_at}")
            print(f"       Last Login: {last_login_at}")
            print(f"       Plan: {plan}")
        
        # 保留最早创建的用户
        keep_user_id = users[0][0]
        merge_user_ids = [u[0] for u in users[1:]]
        
        print(f"  保留用户: {keep_user_id}")
        print(f"  合并用户: {merge_user_ids}")
        
        # 执行合并
        merge_user_data(conn, keep_user_id, merge_user_ids)
        
        print()
    
    conn.commit()
    conn.close()
    
    print("=" * 60)
    print("迁移完成")
    print("=" * 60)


if __name__ == "__main__":
    migrate()
