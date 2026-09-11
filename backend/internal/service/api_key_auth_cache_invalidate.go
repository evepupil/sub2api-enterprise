package service

import "context"

// InvalidateAuthCacheByKey 清除指定 API Key 的认证缓存
func (s *APIKeyService) InvalidateAuthCacheByKey(ctx context.Context, key string) {
	if key == "" {
		return
	}
	cacheKey := s.authCacheKey(key)
	s.deleteAuthCache(ctx, cacheKey)
}

// InvalidateAuthCacheByUserID 清除用户相关的 API Key 认证缓存。
//
// 该账号是组织创建者时，连同全体成员的缓存一起清：成员的鉴权快照里带着组织付款账号
// 的余额，付款账号一充值或停用，成员那边必须立刻看到最新情况。
func (s *APIKeyService) InvalidateAuthCacheByUserID(ctx context.Context, userID int64) {
	if userID <= 0 {
		return
	}
	s.invalidateAuthCacheForUser(ctx, userID)

	if s.organizationGroups == nil {
		return
	}
	memberIDs, err := s.organizationGroups.MemberUserIDsOfOwnedOrganization(ctx, userID)
	if err != nil {
		return
	}
	for _, memberID := range memberIDs {
		s.invalidateAuthCacheForUser(ctx, memberID)
	}
}

func (s *APIKeyService) invalidateAuthCacheForUser(ctx context.Context, userID int64) {
	keys, err := s.apiKeyRepo.ListKeysByUserID(ctx, userID)
	if err != nil {
		return
	}
	s.deleteAuthCacheByKeys(ctx, keys)
}

// InvalidateAuthCacheByGroupID 清除分组相关的 API Key 认证缓存
func (s *APIKeyService) InvalidateAuthCacheByGroupID(ctx context.Context, groupID int64) {
	if groupID <= 0 {
		return
	}
	keys, err := s.apiKeyRepo.ListKeysByGroupID(ctx, groupID)
	if err != nil {
		return
	}
	s.deleteAuthCacheByKeys(ctx, keys)
}

func (s *APIKeyService) deleteAuthCacheByKeys(ctx context.Context, keys []string) {
	if len(keys) == 0 {
		return
	}
	for _, key := range keys {
		if key == "" {
			continue
		}
		s.deleteAuthCache(ctx, s.authCacheKey(key))
	}
}
