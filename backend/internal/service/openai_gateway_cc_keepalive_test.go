package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// 两条 CC 回退路径（/v1/responses、/v1/messages 走上游 Chat Completions）的下游心跳：
// 上游静默期间按 gateway.stream_keepalive_interval 写心跳，避免 Cloudflare 等代理
// 约 100 秒无数据就掐断连接。

func newCCFallbackKeepaliveTestService(intervalSeconds int) *OpenAIGatewayService {
	return &OpenAIGatewayService{cfg: &config.Config{Gateway: config.GatewayConfig{
		MaxLineSize:             defaultMaxLineSize,
		StreamKeepaliveInterval: intervalSeconds,
	}}}
}

func newCCFallbackTestContext(path, userAgent string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, path, nil)
	if userAgent != "" {
		c.Request.Header.Set("User-Agent", userAgent)
	}
	return c, rec
}

// ccChunk 拼一个上游 Chat Completions 流式 chunk 的 JSON。
func ccChunk(t *testing.T, delta map[string]any, finishReason string) string {
	t.Helper()
	choice := map[string]any{"index": 0, "delta": delta}
	if finishReason != "" {
		choice["finish_reason"] = finishReason
	}
	raw, err := json.Marshal(map[string]any{"id": "cc-1", "model": "m", "choices": []any{choice}})
	require.NoError(t, err)
	return string(raw)
}

// pipeCCUpstream 用管道模拟上游流：字符串按 SSE data 行写出（"[DONE]" 写哨兵），
// time.Duration 表示上游在这里静默多久。
func pipeCCUpstream(steps ...any) *http.Response {
	pr, pw := io.Pipe()
	go func() {
		defer func() { _ = pw.Close() }()
		for _, step := range steps {
			switch v := step.(type) {
			case time.Duration:
				time.Sleep(v)
			case string:
				if _, err := fmt.Fprintf(pw, "data: %s\n\n", v); err != nil {
					return
				}
			}
		}
	}()
	return &http.Response{StatusCode: http.StatusOK, Header: http.Header{}, Body: pr}
}

func keepaliveBytesRecorded(c *gin.Context) int {
	value, ok := c.Get(openAIStreamKeepaliveBytesKey)
	if !ok {
		return 0
	}
	n, _ := value.(int)
	return n
}

func TestStreamChatCompletionsAsResponses_KeepaliveDuringUpstreamSilence(t *testing.T) {
	svc := newCCFallbackKeepaliveTestService(1)
	c, rec := newCCFallbackTestContext("/v1/responses", "")
	resp := pipeCCUpstream(
		ccChunk(t, map[string]any{"role": "assistant", "content": "hi"}, ""),
		1500*time.Millisecond,
		ccChunk(t, map[string]any{"content": " there"}, "stop"),
		"[DONE]",
	)
	defer func() { _ = resp.Body.Close() }()

	result, err := svc.streamChatCompletionsAsResponses(c, resp, "m", nil, nil, false, nil, "m", "m", nil, nil, time.Now())
	require.NoError(t, err)
	require.NotNil(t, result)

	body := rec.Body.String()
	first := strings.Index(body, `"delta":"hi"`)
	keepalive := strings.Index(body, "\n\n:\n\n")
	second := strings.Index(body, `"delta":" there"`)
	require.True(t, first >= 0 && keepalive > first && second > keepalive, "心跳应出现在上游静默期间：\n%s", body)
	require.Contains(t, body, "event: response.completed")

	written := keepaliveBytesRecorded(c)
	require.Positive(t, written, "心跳字节应单独记账")
	require.Zero(t, written%len(":\n\n"))
}

func TestStreamChatCompletionsAsResponses_KeepaliveBeforeFirstChunkCommitsSSEHeaders(t *testing.T) {
	svc := newCCFallbackKeepaliveTestService(1)
	c, rec := newCCFallbackTestContext("/v1/responses", "")
	resp := pipeCCUpstream(
		1500*time.Millisecond,
		ccChunk(t, map[string]any{"role": "assistant", "content": "hi"}, "stop"),
		"[DONE]",
	)
	defer func() { _ = resp.Body.Close() }()

	_, err := svc.streamChatCompletionsAsResponses(c, resp, "m", nil, nil, false, nil, "m", "m", nil, nil, time.Now())
	require.NoError(t, err)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "text/event-stream", rec.Header().Get("Content-Type"))
	body := rec.Body.String()
	require.True(t, strings.HasPrefix(body, ":\n\n"), "上游一开始就静默时，先发出的应是心跳：\n%s", body)
	require.Contains(t, body, `"delta":"hi"`)
}

func TestStreamChatCompletionsAsResponses_NoKeepaliveWhenDisabled(t *testing.T) {
	svc := newCCFallbackKeepaliveTestService(0)
	c, rec := newCCFallbackTestContext("/v1/responses", "")
	resp := pipeCCUpstream(
		ccChunk(t, map[string]any{"role": "assistant", "content": "hi"}, ""),
		1200*time.Millisecond,
		ccChunk(t, map[string]any{"content": " there"}, "stop"),
		"[DONE]",
	)
	defer func() { _ = resp.Body.Close() }()

	_, err := svc.streamChatCompletionsAsResponses(c, resp, "m", nil, nil, false, nil, "m", "m", nil, nil, time.Now())
	require.NoError(t, err)
	require.NotContains(t, rec.Body.String(), "\n\n:\n\n")
	require.Zero(t, keepaliveBytesRecorded(c))
}

func TestStreamChatCompletionsAsResponses_StreamsCustomToolInputWhileGenerating(t *testing.T) {
	svc := newCCFallbackKeepaliveTestService(0)
	c, rec := newCCFallbackTestContext("/v1/responses", "")

	patch := "*** Begin Patch\n*** Add File: hello.txt\n+hello \"world\"\n*** End Patch"
	raw, err := json.Marshal(map[string]string{"input": patch})
	require.NoError(t, err)
	args := string(raw)
	cut1, cut2 := len(args)/3, 2*len(args)/3
	toolCall := func(id, name, arguments string) map[string]any {
		function := map[string]any{"arguments": arguments}
		if name != "" {
			function["name"] = name
		}
		call := map[string]any{"index": 0, "function": function}
		if id != "" {
			call["id"], call["type"] = id, "function"
		}
		return map[string]any{"tool_calls": []any{call}}
	}
	resp := pipeCCUpstream(
		ccChunk(t, toolCall("call_patch", "apply_patch", args[:cut1]), ""),
		ccChunk(t, toolCall("", "", args[cut1:cut2]), ""),
		ccChunk(t, toolCall("", "", args[cut2:]), "tool_calls"),
		"[DONE]",
	)
	defer func() { _ = resp.Body.Close() }()

	_, err = svc.streamChatCompletionsAsResponses(c, resp, "m", map[string]bool{"apply_patch": true}, nil, false, nil, "m", "m", nil, nil, time.Now())
	require.NoError(t, err)

	body := rec.Body.String()
	require.GreaterOrEqual(t, strings.Count(body, "event: response.custom_tool_call_input.delta"), 3, "补丁应随参数到达逐段下发：\n%s", body)
	require.Less(t, strings.Index(body, "event: response.custom_tool_call_input.delta"), strings.Index(body, "event: response.custom_tool_call_input.done"))
	inputDone := `"input":` + mustJSONString(patch)
	require.Contains(t, body, inputDone, "done 应携带完整补丁")
}

func TestStreamChatCompletionsAsAnthropic_PingDuringUpstreamSilence(t *testing.T) {
	svc := newCCFallbackKeepaliveTestService(1)
	c, rec := newCCFallbackTestContext("/v1/messages", "")
	resp := pipeCCUpstream(
		ccChunk(t, map[string]any{"role": "assistant", "content": "hi"}, ""),
		1500*time.Millisecond,
		ccChunk(t, map[string]any{"content": " there"}, "stop"),
		"[DONE]",
	)
	defer func() { _ = resp.Body.Close() }()

	_, err := svc.streamChatCompletionsAsAnthropic(c, resp, "m", "m", "m", nil, nil, time.Now())
	require.NoError(t, err)

	body := rec.Body.String()
	ping := strings.Index(body, "event: ping")
	require.True(t, ping > strings.Index(body, `"text":"hi"`) && ping < strings.Index(body, `"text":" there"`), "ping 应出现在上游静默期间：\n%s", body)
	require.NotContains(t, body, `"text":""}}`)
	require.Positive(t, keepaliveBytesRecorded(c))
}

func TestStreamChatCompletionsAsAnthropic_NoopDeltaKeepaliveForAffectedClaudeCode(t *testing.T) {
	svc := newCCFallbackKeepaliveTestService(1)
	c, rec := newCCFallbackTestContext("/v1/messages", "claude-cli/2.1.198 (external, cli)")
	resp := pipeCCUpstream(
		ccChunk(t, map[string]any{"role": "assistant", "content": "hi"}, ""),
		1500*time.Millisecond,
		ccChunk(t, map[string]any{"content": " there"}, "stop"),
		"[DONE]",
	)
	defer func() { _ = resp.Body.Close() }()

	_, err := svc.streamChatCompletionsAsAnthropic(c, resp, "m", "m", "m", nil, nil, time.Now())
	require.NoError(t, err)

	body := rec.Body.String()
	noop := strings.Index(body, `"delta":{"type":"text_delta","text":""}}`)
	require.True(t, noop > strings.Index(body, `"text":"hi"`) && noop < strings.Index(body, `"text":" there"`), "受影响版本的 Claude Code 应收到打开中文本块的空增量：\n%s", body)
	require.NotContains(t, body, "event: ping")
}
