# 任务 1：鉴权依赖定位结果

## 1) 现有 JWT/token 校验

- **校验函数**：`get_current_user`（`auth-api/deps.py`）
- **使用方式**：`user: User = Depends(get_current_user)`
- **内部逻辑**：`HTTPBearer` 取 `Authorization: Bearer <token>`，调用 `decode_access_token(credentials.credentials)` 得到 `user_id`，再 `db.query(User).filter(User.id == user_id).first()`，若不存在或 `user.status != "active"` 则 401。

## 2) Token payload 中用户标识

- **字段名**：`sub`
- **当前含义**：存的是 **user_id**（UUID），不是 username（邮箱/手机）。
- **出处**：`create_access_token(user_id)` 中 `payload = {"sub": user_id, "exp": expire, "type": "access"}`（`deps.py` 第 36 行）。

## 3) “只能查自己”的实现方式

- Token 里**没有** username 字段，只有 `sub` = user_id。
- **做法**：复用 `get_current_user` 得到 `User`，用 **token 对应用户的登录标识** `token_username = user.email or user.phone or user.id` 与查询参数 `username` 比较；相等才允许查，否则 403。
- 无需改 token 结构，先保证“只能查自己”。
