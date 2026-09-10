package service

import (
	"context"
	"fmt"

	dbent "github.com/Wei-Shaw/sub2api/ent"
)

type registrationUserCreator func(context.Context, *User) error

func (s *AuthService) createUserAndCompleteOrganizationRegistration(
	ctx context.Context,
	user *User,
	intent *OrganizationRegistrationIntent,
	createUser registrationUserCreator,
) error {
	if s == nil || s.entClient == nil || s.organizationService == nil || user == nil || intent == nil || createUser == nil {
		return ErrServiceUnavailable
	}

	tx, err := s.entClient.Tx(ctx)
	if err != nil {
		return fmt.Errorf("begin organization registration transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	txCtx := dbent.NewTxContext(ctx, tx)
	if err := createUser(txCtx, user); err != nil {
		return err
	}
	summary, err := s.organizationService.CompleteRegistration(txCtx, user.ID, intent)
	if err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit organization registration transaction: %w", err)
	}
	user.Organization = summary
	return nil
}

func (s *AuthService) AttachOrganizationSummary(ctx context.Context, user *User) error {
	if s == nil || s.organizationService == nil || user == nil {
		return nil
	}
	return s.organizationService.AttachSummary(ctx, user)
}
