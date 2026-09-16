-- 模块后置扩展：组织成员名称。
--
-- 注册创建组织或通过组织邀请码加入时，由本人填写「你在组织中的名称」；
-- 组织侧展示（成员列表、使用记录成员列、成员分布、配额申请）优先显示它，
-- 没有则回退邮箱。管理员可随时修改。不限制重名，靠邮箱区分。
-- 老成员不回填，继续显示邮箱。

ALTER TABLE organization_members
    ADD COLUMN IF NOT EXISTS display_name VARCHAR(50);
