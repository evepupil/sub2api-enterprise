package apicompat

import (
	"strings"
	"unicode/utf16"
	"unicode/utf8"
)

// customToolInputStream 把 custom 工具降级为 function 工具后（见 customToolInputSchema）
// 上游逐段吐出的 {"input":"..."} 参数，边收边还原成 input 原文。
//
// Codex 的 apply_patch 就是 custom 工具：一个补丁可能有上万 token，若攒到工具调用
// 收尾才一次性下发，中间一两分钟下游收不到任何字节——客户端界面不动，经过
// Cloudflare 等代理时连接还会被当成空闲掐断。还原结果与 extractCustomToolCallInput
// （即 encoding/json）逐字一致；参数不是 {"input":"... 开头的形状时放弃流式，
// 收尾时仍整段下发（见 closeChatToolItems）。
type customToolInputStream struct {
	valueStart int             // input 字符串内容在参数里的起点；-1 表示还没认出开头
	pos        int             // 下一个待解码的字节位置
	sent       strings.Builder // 已作为增量下发的 input 原文
	closed     bool            // 读到了字符串的结束引号
	failed     bool            // 形状不符或转义非法，不再流式
}

func newCustomToolInputStream() *customToolInputStream {
	return &customToolInputStream{valueStart: -1}
}

// next 在已累积的完整参数上继续解码，返回这次新解出的原文（可能为空）。
// 转义序列、多字节字符没收全时停在它前面，等后续参数到了再解。
func (d *customToolInputStream) next(arguments string) string {
	if d.failed || d.closed {
		return ""
	}
	if d.valueStart < 0 {
		start, state := matchCustomToolInputPrefix(arguments)
		switch state {
		case customInputPrefixPending:
			return ""
		case customInputPrefixMismatch:
			d.failed = true
			return ""
		}
		d.valueStart, d.pos = start, start
	}

	var out strings.Builder
	for d.pos < len(arguments) {
		ch := arguments[d.pos]
		switch {
		case ch == '"':
			d.closed = true
			return out.String()
		case ch == '\\':
			r, width := decodeJSONStringEscape(arguments[d.pos:])
			if width == 0 {
				return out.String()
			}
			if width < 0 {
				d.failed = true
				return out.String()
			}
			_, _ = out.WriteRune(r)
			d.pos += width
		case ch < 0x20:
			// JSON 字符串里不允许原样的控制字符：按 schema 解析会失败，最终 input
			// 会是整段原始参数，流式到此为止。
			d.failed = true
			return out.String()
		case ch < utf8.RuneSelf:
			_ = out.WriteByte(ch)
			d.pos++
		default:
			rest := arguments[d.pos:]
			if !utf8.FullRuneInString(rest) {
				return out.String()
			}
			r, size := utf8.DecodeRuneInString(rest)
			if r == utf8.RuneError && size == 1 {
				_, _ = out.WriteRune(utf8.RuneError) // 与 encoding/json 一致：非法字节还原成 U+FFFD
			} else {
				_, _ = out.WriteString(rest[:size])
			}
			d.pos += size
		}
	}
	return out.String()
}

type customInputPrefixState int

const (
	customInputPrefixPending customInputPrefixState = iota
	customInputPrefixMatched
	customInputPrefixMismatch
)

// matchCustomToolInputPrefix 认 {"input":" 开头（各记号之间允许 JSON 空白），
// 返回 input 字符串内容的起点。参数还不够长、无法判断时返回 pending。
func matchCustomToolInputPrefix(arguments string) (int, customInputPrefixState) {
	i := 0
	for _, token := range [...]string{"{", `"input"`, ":", `"`} {
		for i < len(arguments) && isJSONSpace(arguments[i]) {
			i++
		}
		for j := 0; j < len(token); j++ {
			if i >= len(arguments) {
				return 0, customInputPrefixPending
			}
			if arguments[i] != token[j] {
				return 0, customInputPrefixMismatch
			}
			i++
		}
	}
	return i, customInputPrefixMatched
}

func isJSONSpace(b byte) bool {
	return b == ' ' || b == '\t' || b == '\n' || b == '\r'
}

// decodeJSONStringEscape 解一个以反斜杠开头的 JSON 转义，返回字符与占用的字节数：
// 0 表示还没收全，-1 表示非法转义。代理对的处理与 encoding/json 一致：配不成对的
// 代理码元还原成 U+FFFD，后面的转义另行解析。
func decodeJSONStringEscape(s string) (rune, int) {
	if len(s) < 2 {
		return 0, 0
	}
	switch s[1] {
	case '"', '\\', '/':
		return rune(s[1]), 2
	case 'b':
		return '\b', 2
	case 'f':
		return '\f', 2
	case 'n':
		return '\n', 2
	case 'r':
		return '\r', 2
	case 't':
		return '\t', 2
	case 'u':
	default:
		return 0, -1
	}

	r, ok, complete := parseJSONHex4(s, 2)
	if !complete {
		return 0, 0
	}
	if !ok {
		return 0, -1
	}
	if !utf16.IsSurrogate(r) {
		return r, 6
	}
	// 代理码元：后面紧跟另一个 \uXXXX 才可能组成一对。
	if len(s) < 7 {
		return 0, 0
	}
	if s[6] != '\\' {
		return utf8.RuneError, 6
	}
	if len(s) < 8 {
		return 0, 0
	}
	if s[7] != 'u' {
		return utf8.RuneError, 6
	}
	r2, ok2, complete2 := parseJSONHex4(s, 8)
	if !complete2 {
		return 0, 0
	}
	if !ok2 {
		return 0, -1
	}
	if pair := utf16.DecodeRune(r, r2); pair != utf8.RuneError {
		return pair, 12
	}
	return utf8.RuneError, 6
}

// parseJSONHex4 解析 s[at:] 处的 4 位十六进制；complete 为 false 表示还没收全。
func parseJSONHex4(s string, at int) (r rune, ok bool, complete bool) {
	for k := 0; k < 4; k++ {
		if at+k >= len(s) {
			return 0, false, false
		}
		v, valid := jsonHexValue(s[at+k])
		if !valid {
			return 0, false, true
		}
		r = r<<4 | v
	}
	return r, true, true
}

func jsonHexValue(b byte) (rune, bool) {
	switch {
	case '0' <= b && b <= '9':
		return rune(b - '0'), true
	case 'a' <= b && b <= 'f':
		return rune(b-'a') + 10, true
	case 'A' <= b && b <= 'F':
		return rune(b-'A') + 10, true
	default:
		return 0, false
	}
}

// customInputStream 取（必要时新建）第 idx 个工具调用的输入还原进度。
func (state *ChatCompletionsToResponsesStreamState) customInputStream(idx int) *customToolInputStream {
	if state.customInput == nil {
		state.customInput = make(map[int]*customToolInputStream)
	}
	stream, ok := state.customInput[idx]
	if !ok {
		stream = newCustomToolInputStream()
		state.customInput[idx] = stream
	}
	return stream
}

// customInputSent 返回第 idx 个工具调用已作为增量下发的 input 原文。
func (state *ChatCompletionsToResponsesStreamState) customInputSent(idx int) string {
	if stream, ok := state.customInput[idx]; ok {
		return stream.sent.String()
	}
	return ""
}

// streamChatCustomToolInput 把已宣告的 custom 工具调用里新到的输入原文作为
// response.custom_tool_call_input.delta 下发（名字迟到时，宣告后补发已累积的部分）。
func streamChatCustomToolInput(state *ChatCompletionsToResponsesStreamState, idx int, stored *ChatToolCall) []ResponsesStreamEvent {
	if stored == nil || !state.toolAnnounced[idx] || !state.toolIsCustom[idx] {
		return nil
	}
	stream := state.customInputStream(idx)
	delta := stream.next(stored.Function.Arguments)
	if delta == "" {
		return nil
	}
	_, _ = stream.sent.WriteString(delta)
	return []ResponsesStreamEvent{chatToResponsesEvent(state, "response.custom_tool_call_input.delta", &ResponsesStreamEvent{
		OutputIndex: state.ToolOutputIndex[idx],
		ItemID:      state.ToolItemIDs[idx],
		Delta:       delta,
	})}
}
