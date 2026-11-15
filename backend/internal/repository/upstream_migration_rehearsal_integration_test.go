//go:build integration

package repository

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	_ "github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

const upgradeRehearsalDatabaseName = "sub2api_upgrade_rehearsal"

type upgradeRehearsalTableDigest struct {
	Rows   int
	SHA256 string
}

type upgradeRehearsalSnapshot struct {
	Users                   upgradeRehearsalTableDigest
	APIKeys                 upgradeRehearsalTableDigest
	Organizations           upgradeRehearsalTableDigest
	OrganizationMembers     upgradeRehearsalTableDigest
	OrganizationAllowed     upgradeRehearsalTableDigest
	OrganizationQuotaEvents upgradeRehearsalTableDigest
	RegistrationSettings    upgradeRehearsalTableDigest
}

var upgradeRehearsalSnapshotQueries = []struct {
	name  string
	query string
}{
	{
		name: "users",
		query: `SELECT id::text, status, balance::text, COALESCE(frozen_balance, 0)::text
			FROM users ORDER BY id`,
	},
	{
		name: "api_keys",
		query: `SELECT id::text, (deleted_at IS NOT NULL), status, quota::text, quota_used::text,
				rate_limit_5h::text, usage_5h::text, window_5h_start::text,
				rate_limit_1d::text, usage_1d::text, window_1d_start::text,
				rate_limit_7d::text, usage_7d::text, window_7d_start::text
			FROM api_keys ORDER BY id`,
	},
	{
		name: "organizations",
		query: `SELECT id::text, name, owner_user_id::text, status, restrict_public_groups,
				quota_request_mode, quota_request_min::text, quota_request_max::text,
				default_quota_enabled, default_quota_amount::text, default_quota_period_days
			FROM organizations ORDER BY id`,
	},
	{
		name: "organization_members",
		query: `SELECT id::text, organization_id::text, user_id::text, display_name,
				spending_limit::text, spending_used::text, spending_frozen::text,
				quota_amount::text, quota_period_days, quota_start_at::text,
				quota_cycle_start::text, quota_cycle_bonus::text
			FROM organization_members ORDER BY id`,
	},
	{
		name: "organization_allowed_groups",
		query: `SELECT organization_id::text, group_id::text
			FROM organization_allowed_groups ORDER BY organization_id, group_id`,
	},
	{
		name: "organization_quota_requests",
		query: `SELECT id::text, organization_id::text, user_id::text, amount::text, reason, status,
				grant_source, granted_amount::text, snapshot_mode, snapshot_limit::text,
				snapshot_used::text, reviewer_user_id::text, reviewed_at::text, review_note,
				created_at::text, updated_at::text
			FROM organization_quota_requests ORDER BY id`,
	},
	{
		name: "registration_settings",
		query: `SELECT key, value FROM settings
			WHERE key IN (
				'registration_enabled',
				'email_verify_enabled',
				'invitation_code_enabled',
				'registration_email_suffix_whitelist',
				'registration_email_domain_quota_enabled'
			)
			ORDER BY key`,
	},
}

func TestUpstreamMigrationRehearsalPreservesDataAndIsIdempotent(t *testing.T) {
	dsn := strings.TrimSpace(os.Getenv("SUB2API_TEST_UPGRADE_DATABASE_DSN"))
	if dsn == "" {
		t.Skip("set SUB2API_TEST_UPGRADE_DATABASE_DSN to opt in to the localhost-only migration rehearsal")
	}
	if err := validateUpgradeRehearsalDSN(dsn); err != nil {
		t.Fatal("migration rehearsal DSN rejected: require localhost/127.0.0.1 and database sub2api_upgrade_rehearsal")
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal("open migration rehearsal database failed")
	}
	defer func() { _ = db.Close() }()
	db.SetMaxOpenConns(2)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		t.Fatal("migration rehearsal database is unavailable")
	}

	before, err := snapshotUpgradeRehearsalData(ctx, db)
	require.NoError(t, err)
	require.NoError(t, ApplyMigrations(ctx, db))
	afterFirstRun, err := snapshotUpgradeRehearsalData(ctx, db)
	require.NoError(t, err)
	require.Equal(t, before, afterFirstRun, "first migration run must preserve financial and enterprise data")
	ledgerAfterFirstRun, err := snapshotUpgradeMigrationLedger(ctx, db)
	require.NoError(t, err)

	require.NoError(t, ApplyMigrations(ctx, db))
	afterSecondRun, err := snapshotUpgradeRehearsalData(ctx, db)
	require.NoError(t, err)
	require.Equal(t, afterFirstRun, afterSecondRun, "second migration run must not change preserved data")
	ledgerAfterSecondRun, err := snapshotUpgradeMigrationLedger(ctx, db)
	require.NoError(t, err)
	require.Equal(t, ledgerAfterFirstRun, ledgerAfterSecondRun, "second migration run must leave the migration ledger unchanged")
}

func TestUpstreamMigrationRehearsalDSNIsRestrictedToLocalNamedDatabase(t *testing.T) {
	postgresScheme := "postgres" + "ql"
	accepted := []string{
		postgresScheme + "://" + "localhost:5432/" + upgradeRehearsalDatabaseName + "?sslmode=disable",
		"postgresql:///sub2api_upgrade_rehearsal?host=127.0.0.1&port=5432",
	}
	for _, dsn := range accepted {
		require.NoError(t, validateUpgradeRehearsalDSN(dsn))
	}

	rejected := []string{
		postgresScheme + "://" + "database.invalid:5432/" + upgradeRehearsalDatabaseName,
		postgresScheme + "://" + "localhost:5432/production",
		"postgresql:///sub2api_upgrade_rehearsal?host=database.internal",
		"host=localhost hostaddr=192.0.2.1 dbname=sub2api_upgrade_rehearsal",
		"host=localhost dbname=production",
		"host=127.0.0.1,production dbname=sub2api_upgrade_rehearsal",
	}
	for _, dsn := range rejected {
		require.Error(t, validateUpgradeRehearsalDSN(dsn))
	}
}

func validateUpgradeRehearsalDSN(dsn string) error {
	return validateUpgradeRehearsalURL(strings.TrimSpace(dsn))
}

func validateUpgradeRehearsalURL(raw string) error {
	parsed, err := url.Parse(raw)
	if err != nil || (parsed.Scheme != "postgres" && parsed.Scheme != "postgresql") {
		return errors.New("invalid PostgreSQL URL")
	}
	query := parsed.Query()
	if query.Has("hostaddr") || query.Has("service") || query.Has("servicefile") {
		return errors.New("alternate connection routing is not allowed")
	}

	hosts := make([]string, 0, 1+len(query["host"]))
	if parsed.Hostname() != "" {
		hosts = append(hosts, parsed.Hostname())
	}
	hosts = append(hosts, query["host"]...)
	if err := validateUpgradeRehearsalHosts(hosts); err != nil {
		return err
	}

	databases := make([]string, 0, 1+len(query["dbname"]))
	pathDB := strings.TrimPrefix(parsed.Path, "/")
	if pathDB != "" {
		databases = append(databases, pathDB)
	}
	databases = append(databases, query["dbname"]...)
	if len(databases) == 0 {
		return errors.New("database name is required")
	}
	for _, database := range databases {
		if database != upgradeRehearsalDatabaseName {
			return errors.New("unexpected database name")
		}
	}
	return nil
}

func validateUpgradeRehearsalHosts(hosts []string) error {
	if len(hosts) == 0 {
		return errors.New("host is required")
	}
	for _, host := range hosts {
		host = strings.TrimSpace(host)
		if strings.Contains(host, ",") || (!strings.EqualFold(host, "localhost") && host != "127.0.0.1") {
			return errors.New("host must be localhost or 127.0.0.1")
		}
	}
	return nil
}

func snapshotUpgradeRehearsalData(ctx context.Context, db *sql.DB) (upgradeRehearsalSnapshot, error) {
	digests := make(map[string]upgradeRehearsalTableDigest, len(upgradeRehearsalSnapshotQueries))
	for _, snapshot := range upgradeRehearsalSnapshotQueries {
		digest, err := digestUpgradeRehearsalQuery(ctx, db, snapshot.query)
		if err != nil {
			return upgradeRehearsalSnapshot{}, errors.New("snapshot query failed")
		}
		digests[snapshot.name] = digest
	}
	return upgradeRehearsalSnapshot{
		Users:                   digests["users"],
		APIKeys:                 digests["api_keys"],
		Organizations:           digests["organizations"],
		OrganizationMembers:     digests["organization_members"],
		OrganizationAllowed:     digests["organization_allowed_groups"],
		OrganizationQuotaEvents: digests["organization_quota_requests"],
		RegistrationSettings:    digests["registration_settings"],
	}, nil
}

func digestUpgradeRehearsalQuery(ctx context.Context, db *sql.DB, query string) (upgradeRehearsalTableDigest, error) {
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return upgradeRehearsalTableDigest{}, err
	}
	defer func() { _ = rows.Close() }()

	columns, err := rows.Columns()
	if err != nil {
		return upgradeRehearsalTableDigest{}, err
	}
	records := make([][]any, 0)
	for rows.Next() {
		values := make([]any, len(columns))
		scanTargets := make([]any, len(columns))
		for i := range values {
			scanTargets[i] = &values[i]
		}
		if err := rows.Scan(scanTargets...); err != nil {
			return upgradeRehearsalTableDigest{}, err
		}
		for i, value := range values {
			if bytes, ok := value.([]byte); ok {
				values[i] = string(bytes)
			}
		}
		records = append(records, values)
	}
	if err := rows.Err(); err != nil {
		return upgradeRehearsalTableDigest{}, err
	}
	encoded, err := json.Marshal(records)
	if err != nil {
		return upgradeRehearsalTableDigest{}, err
	}
	digest := sha256.Sum256(encoded)
	return upgradeRehearsalTableDigest{Rows: len(records), SHA256: hex.EncodeToString(digest[:])}, nil
}

func snapshotUpgradeMigrationLedger(ctx context.Context, db *sql.DB) (upgradeRehearsalTableDigest, error) {
	return digestUpgradeRehearsalQuery(ctx, db, `
		SELECT filename, checksum FROM schema_migrations ORDER BY filename`)
}
