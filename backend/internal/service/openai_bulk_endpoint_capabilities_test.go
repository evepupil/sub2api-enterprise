//go:build unit

package service

import (
	"testing"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
	"github.com/Wei-Shaw/sub2api/internal/pkg/openai_compat"
	"github.com/stretchr/testify/require"
)

func TestNormalizeBulkOpenAIEndpointCapabilities(t *testing.T) {
	tests := []struct {
		name            string
		input           any
		want            any
		wantIncludeChat bool
	}{
		{
			name:            "explicit Seedance only",
			input:           []string{"seedance"},
			want:            []string{"seedance"},
			wantIncludeChat: false,
		},
		{
			name:            "all capabilities stay explicit in canonical order",
			input:           []any{"seedance", "embeddings", "chat_completions"},
			want:            []string{"chat_completions", "embeddings", "seedance"},
			wantIncludeChat: true,
		},
		{
			name:            "chat and embeddings retain legacy defaults",
			input:           []any{"chat_completions", "embeddings"},
			want:            nil,
			wantIncludeChat: true,
		},
		{
			name:            "Seedance and embeddings remain explicit",
			input:           []string{"seedance", "embeddings"},
			want:            []string{"embeddings", "seedance"},
			wantIncludeChat: false,
		},
		{
			name:            "Seedance and embeddings deduplicate []any input",
			input:           []any{"seedance", "embeddings", "seedance", "embeddings"},
			want:            []string{"embeddings", "seedance"},
			wantIncludeChat: false,
		},
		{
			name:            "chat and Seedance deduplicate []any input",
			input:           []any{"seedance", "chat_completions", "seedance", "chat_completions"},
			want:            []string{"chat_completions", "seedance"},
			wantIncludeChat: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, includeChat, err := normalizeBulkOpenAIEndpointCapabilities(tt.input)
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
			require.Equal(t, tt.wantIncludeChat, includeChat)
			if tt.want != nil {
				require.NotNil(t, got)
			}
		})
	}
}

func TestNormalizeBulkOpenAIEndpointCapabilitiesRejectsInvalidInput(t *testing.T) {
	tests := []struct {
		name  string
		input any
	}{
		{name: "responses capability", input: []any{"responses"}},
		{name: "empty array", input: []any{}},
		{name: "non-string capability", input: []any{"seedance", 1}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, _, err := normalizeBulkOpenAIEndpointCapabilities(tt.input)
			requireBulkOpenAISettingsErrorReason(t, err, "OPENAI_ENDPOINT_CAPABILITIES_INVALID")
		})
	}
}

func TestBulkSeedanceExplicitCapabilitiesKeepResponsesModeRules(t *testing.T) {
	tests := []struct {
		name       string
		extra      map[string]any
		wantReason string
	}{
		{name: "video-only capabilities clear Responses override"},
		{
			name:       "video-only capabilities reject forced Responses mode",
			extra:      map[string]any{openai_compat.ExtraKeyResponsesMode: "force_responses"},
			wantReason: "OPENAI_RESPONSES_MODE_INVALID",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			input := &BulkUpdateAccountsInput{
				Credentials: map[string]any{
					openAIEndpointCapabilitiesCredentialKey: []any{"seedance"},
				},
				Extra: tt.extra,
			}

			settings, err := normalizeBulkOpenAISettings(input)
			if tt.wantReason != "" {
				requireBulkOpenAISettingsErrorReason(t, err, tt.wantReason)
				return
			}

			require.NoError(t, err)
			require.True(t, settings.endpointCapabilities)
			require.False(t, settings.capabilitiesIncludeChat)
			require.True(t, settings.responsesMode)
			require.Equal(t, []string{"seedance"}, input.Credentials[openAIEndpointCapabilitiesCredentialKey])
			require.Contains(t, input.Extra, openai_compat.ExtraKeyResponsesMode)
			require.Nil(t, input.Extra[openai_compat.ExtraKeyResponsesMode])
		})
	}
}

func requireBulkOpenAISettingsErrorReason(t *testing.T, err error, reason string) {
	t.Helper()
	var appErr *infraerrors.ApplicationError
	require.ErrorAs(t, err, &appErr)
	require.Equal(t, reason, appErr.Reason)
}
