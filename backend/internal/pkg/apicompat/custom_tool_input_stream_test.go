package apicompat

import (
	"encoding/json"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// feedCustomToolInput 把参数按给定切分逐段喂给解码器（每次传入已累积的完整参数），
// 返回每段新解出的原文。
func feedCustomToolInput(pieces []string) (*customToolInputStream, []string) {
	stream := newCustomToolInputStream()
	accumulated := ""
	var deltas []string
	for _, piece := range pieces {
		accumulated += piece
		if delta := stream.next(accumulated); delta != "" {
			_, _ = stream.sent.WriteString(delta)
			deltas = append(deltas, delta)
		}
	}
	return stream, deltas
}

// splitBytes 每个字节切一段：转义序列、多字节字符都会被切开，是最坏情况。
func splitBytes(s string) []string {
	pieces := make([]string, 0, len(s))
	for i := 0; i < len(s); i++ {
		pieces = append(pieces, s[i:i+1])
	}
	return pieces
}

// splitRunes 每 n 个字符切一段，模拟上游按 token 吐出的参数片段（每段都是完整字符）。
func splitRunes(s string, n int) []string {
	runes := []rune(s)
	var pieces []string
	for i := 0; i < len(runes); i += n {
		end := min(i+n, len(runes))
		pieces = append(pieces, string(runes[i:end]))
	}
	return pieces
}

func customToolArgsChunk(idx *int, id, name, arguments string) *ChatCompletionsChunk {
	return &ChatCompletionsChunk{Choices: []ChatChunkChoice{{Delta: ChatDelta{ToolCalls: []ChatToolCall{{
		Index:    idx,
		ID:       id,
		Function: ChatFunctionCall{Name: name, Arguments: arguments},
	}}}}}}
}

func TestCustomToolInputStream_MatchesJSONDecodingWhenSplitPerByte(t *testing.T) {
	inputs := []string{
		"*** Begin Patch\n*** Update File: main.go\n@@\n-old()\n+new(\"quoted\", `raw`, \\path\\)\n*** End Patch",
		"中文补丁 é 😀\ttab \u0001 control",
		"<script> & </script>    ",
		"",
	}
	for _, input := range inputs {
		raw, err := json.Marshal(map[string]string{"input": input})
		require.NoError(t, err)

		stream, deltas := feedCustomToolInput(splitBytes(string(raw)))

		assert.Equal(t, input, strings.Join(deltas, ""), "逐字节切分后应还原出原文：%q", input)
		assert.Equal(t, extractCustomToolCallInput(string(raw)), stream.sent.String())
		assert.True(t, stream.closed)
		assert.False(t, stream.failed)
		for _, delta := range deltas {
			assert.True(t, utf8.ValidString(delta), "增量不能停在半个字符上：%q", delta)
		}
	}
}

// jsonUnicodeEscape 拼出 JSON 的反斜杠 u 转义。源码里不直接写这种转义，
// 免得被编辑工具提前还原成字符，测试就测不到转义本身了。
func jsonUnicodeEscape(hex string) string {
	return string(rune(92)) + "u" + hex
}

func TestCustomToolInputStream_SurrogatesMatchEncodingJSON(t *testing.T) {
	esc := jsonUnicodeEscape
	replacement := string(utf8.RuneError)
	cases := []struct {
		name string
		args string
		want string
	}{
		{"成对的代理码元还原成一个字符", `{"input":"a` + esc("d83d") + esc("de00") + `b"}`, "a" + string(rune(0x1F600)) + "b"},
		{"高位代理后面不是转义", `{"input":"a` + esc("d83d") + `xb"}`, "a" + replacement + "xb"},
		{"高位代理后面是普通转义", `{"input":"a` + esc("d83d") + esc("0041") + `b"}`, "a" + replacement + "Ab"},
		{"单独的低位代理", `{"input":"` + esc("de00") + `!"}`, replacement + "!"},
		{"普通的 4 位转义", `{"input":"` + esc("00e9") + esc("4e2d") + `"}`, "é中"},
	}
	for _, tc := range cases {
		require.Equal(t, tc.want, extractCustomToolCallInput(tc.args), "%s：期望值应与 encoding/json 一致", tc.name)
		_, deltas := feedCustomToolInput(splitBytes(tc.args))
		assert.Equal(t, tc.want, strings.Join(deltas, ""), tc.name)
	}
}

func TestCustomToolInputStream_WaitsUntilShapeIsKnown(t *testing.T) {
	stream := newCustomToolInputStream()

	assert.Empty(t, stream.next(`{ "inp`))
	assert.False(t, stream.failed, "开头还没收全时继续等，不能判失败")
	assert.Equal(t, "ab", stream.next("{ \"input\" :\n \"ab"))
	assert.Equal(t, "c\n", stream.next("{ \"input\" :\n \"abc\\n"))
	assert.Empty(t, stream.next("{ \"input\" :\n \"abc\\n\"}"))
	assert.True(t, stream.closed)
}

func TestCustomToolInputStream_GivesUpOnUnexpectedShape(t *testing.T) {
	for _, args := range []string{`not-json`, `{"other":"x","input":"y"}`, `{"input":42}`, `["input"]`} {
		stream, deltas := feedCustomToolInput(splitBytes(args))
		assert.Empty(t, deltas, args)
		assert.True(t, stream.failed, args)
	}
}

func TestCustomToolInputStream_StopsAtInvalidContent(t *testing.T) {
	stream, deltas := feedCustomToolInput(splitBytes(`{"input":"bad \q escape"}`))
	assert.Equal(t, "bad ", strings.Join(deltas, ""))
	assert.True(t, stream.failed, "非法转义后不再流式")

	stream, deltas = feedCustomToolInput([]string{`{"input":"ab`, "\ncd\"}"})
	assert.Equal(t, []string{"ab"}, deltas)
	assert.True(t, stream.failed, "字符串里出现原样换行（模型没按 JSON 输出）后不再流式")
}

func TestChatCompletionsChunkToResponsesEvents_CustomToolInputStreamsAsItArrives(t *testing.T) {
	state := NewChatCompletionsToResponsesStreamState("gpt-6.1-sol")
	state.CustomTools = map[string]bool{"apply_patch": true}
	patch := "*** Begin Patch\n*** Add File: hello.txt\n+你好 \"world\" \\ 😀\n*** End Patch"
	raw, err := json.Marshal(map[string]string{"input": patch})
	require.NoError(t, err)

	idx := 0
	var streamed []ResponsesStreamEvent
	for i, piece := range splitRunes(string(raw), 4) {
		id, name := "", ""
		if i == 0 {
			id, name = "call_patch", "apply_patch"
		}
		streamed = append(streamed, ChatCompletionsChunkToResponsesEvents(customToolArgsChunk(&idx, id, name, piece), state)...)
	}
	final := FinalizeChatCompletionsResponsesStream(state)

	itemID := ""
	var streamedDeltas []string
	for _, evt := range streamed {
		switch evt.Type {
		case "response.output_item.added":
			require.NotNil(t, evt.Item)
			require.Equal(t, "custom_tool_call", evt.Item.Type)
			itemID = evt.Item.ID
		case "response.custom_tool_call_input.delta":
			require.NotEmpty(t, itemID, "增量必须在 output_item.added 之后")
			assert.Equal(t, itemID, evt.ItemID)
			streamedDeltas = append(streamedDeltas, evt.Delta)
		case "response.custom_tool_call_input.done":
			t.Fatal("收尾前不应出现 custom_tool_call_input.done")
		}
	}
	require.Greater(t, len(streamedDeltas), 5, "补丁应随参数到达逐段下发，不能攒到收尾")

	var finalDeltas []string
	var inputDone, itemDone *ResponsesStreamEvent
	for i := range final {
		evt := &final[i]
		switch evt.Type {
		case "response.custom_tool_call_input.delta":
			finalDeltas = append(finalDeltas, evt.Delta)
		case "response.custom_tool_call_input.done":
			inputDone = evt
		case "response.output_item.done":
			if evt.Item != nil && evt.Item.Type == "custom_tool_call" {
				itemDone = evt
			}
		}
	}
	assert.Equal(t, patch, strings.Join(append(streamedDeltas, finalDeltas...), ""), "全部增量拼起来应等于完整补丁")
	require.NotNil(t, inputDone)
	assert.Equal(t, patch, inputDone.Input)
	require.NotNil(t, itemDone)
	assert.Equal(t, patch, itemDone.Item.Input)
}

func TestChatCompletionsChunkToResponsesEvents_CustomToolInputFlushedWhenNameArrivesLate(t *testing.T) {
	state := NewChatCompletionsToResponsesStreamState("glm-5.2")
	state.CustomTools = map[string]bool{"apply_patch": true}
	idx := 0

	first := ChatCompletionsChunkToResponsesEvents(customToolArgsChunk(&idx, "call_1", "", `{"input":"ab`), state)
	for _, evt := range first {
		assert.NotEqual(t, "response.custom_tool_call_input.delta", evt.Type, "名字没到、类型没定之前不能下发输入")
	}

	second := ChatCompletionsChunkToResponsesEvents(customToolArgsChunk(&idx, "", "apply_patch", `c"}`), state)
	var types, deltas []string
	for _, evt := range second {
		types = append(types, evt.Type)
		if evt.Type == "response.custom_tool_call_input.delta" {
			deltas = append(deltas, evt.Delta)
		}
	}
	assert.Equal(t, []string{"response.output_item.added", "response.custom_tool_call_input.delta"}, types)
	assert.Equal(t, []string{"abc"}, deltas, "宣告后补发名字到达前累积的输入")

	for _, evt := range FinalizeChatCompletionsResponsesStream(state) {
		assert.NotEqual(t, "response.custom_tool_call_input.delta", evt.Type, "已全部下发，收尾不再重复")
		if evt.Type == "response.custom_tool_call_input.done" {
			assert.Equal(t, "abc", evt.Input)
		}
	}
}

func TestChatCompletionsChunkToResponsesEvents_CustomToolTruncatedInputKeepsRawDone(t *testing.T) {
	state := NewChatCompletionsToResponsesStreamState("m")
	state.CustomTools = map[string]bool{"apply_patch": true}
	idx := 0

	events := ChatCompletionsChunkToResponsesEvents(customToolArgsChunk(&idx, "call_1", "apply_patch", `{"input":"abc`), state)
	events = append(events, FinalizeChatCompletionsResponsesStream(state)...)

	var deltas []string
	var done *ResponsesStreamEvent
	for i := range events {
		switch events[i].Type {
		case "response.custom_tool_call_input.delta":
			deltas = append(deltas, events[i].Delta)
		case "response.custom_tool_call_input.done":
			done = &events[i]
		}
	}
	assert.Equal(t, []string{"abc"}, deltas, "前缀和最终 input 对不上时，收尾不再补发增量")
	require.NotNil(t, done)
	assert.Equal(t, `{"input":"abc`, done.Input, "参数被截断时 done 仍携带整段原始参数（与改动前一致）")
}
