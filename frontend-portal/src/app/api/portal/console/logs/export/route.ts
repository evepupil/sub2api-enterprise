import { NextResponse, type NextRequest } from 'next/server';

import { LOGS_EXPORT_LIMIT, type LogRow } from '@/lib/console/live/logs-types';
import enLogs from '@/messages/en/consoleLogs.json';
import zhLogs from '@/messages/zh/consoleLogs.json';
import { hasSessionCookie } from '@/lib/server/session/cookies';
import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import { authErrorResponse, logBackendFailure, withSession } from '@/lib/server/session/session';
import { callBackend } from '@/lib/server/sub2api/client';
import { backendError, PORTAL_REASONS, type BackendResult } from '@/lib/server/sub2api/envelope';
import {
  logsCsv,
  parseLogFilters,
  toLogsPage,
  usageLogsPath,
  type LogsCsvLabels,
} from '@/lib/server/sub2api/usage-logs';

/** 每次向后端要多少条（后端单页上限 1000） */
const EXPORT_PAGE_SIZE = 1000;

/** CSV 表头的顺序，和 logsCsv 的列一一对应 */
const CSV_COLUMNS = [
  'time',
  'requestId',
  'key',
  'group',
  'rate',
  'model',
  'reasoning',
  'tier',
  'stream',
  'inputTokens',
  'outputTokens',
  'cacheRead',
  'cacheWrite',
  'actualCost',
  'officialCost',
  'duration',
  'firstToken',
  'endpoint',
] as const;

function csvLabels(locale: 'zh' | 'en'): LogsCsvLabels {
  const messages = locale === 'en' ? enLogs : zhLogs;
  return {
    headers: CSV_COLUMNS.map((column) => messages.csv[column]),
    yes: messages.detail.yes,
    no: messages.detail.no,
    noGroup: messages.table.noGroup,
    tiers: messages.table.tier,
  };
}

/**
 * 导出日志 CSV：GET ?from&to&key&model&type&stream&locale。按当前筛选从新到旧，最多 1 万条；
 * 官网服务器分页向后端要（每次 1000 条），拼成 CSV 后整个下载。表头按界面语言，金额是美元。
 */
export async function GET(request: NextRequest) {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);

  const params = request.nextUrl.searchParams;
  const filters = parseLogFilters(params);
  if (!filters) return authErrorResponse('BAD_REQUEST', 400);
  const locale = params.get('locale') === 'en' ? 'en' : 'zh';

  const { result, writes } = await withSession<LogRow[]>(
    request,
    async (accessToken, forwarded): Promise<BackendResult<LogRow[]>> => {
      const rows: LogRow[] = [];
      for (let page = 1; rows.length < LOGS_EXPORT_LIMIT; page++) {
        const response = await callBackend<unknown>({
          method: 'GET',
          path: usageLogsPath(filters, page, EXPORT_PAGE_SIZE),
          accessToken,
          forwarded,
        });
        if (!response.ok) return response;
        const data = toLogsPage(response.data);
        if (!data) return { ok: false, error: backendError(502, PORTAL_REASONS.badResponse) };
        rows.push(...data.items);
        if (data.items.length < EXPORT_PAGE_SIZE || rows.length >= data.total) break;
      }
      return { ok: true, data: rows.slice(0, LOGS_EXPORT_LIMIT) };
    },
  );

  if (!result.ok) {
    logBackendFailure('console logs export', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error), writes);
  }

  // 文件开头加 UTF-8 标记，Excel 直接打开时中文不乱码
  const response = new NextResponse(`﻿${logsCsv(result.data, csvLabels(locale))}`, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="logs-${filters.from}-${filters.to}.csv"`,
      'cache-control': 'no-store',
    },
  });
  for (const write of writes) response.cookies.set(write.name, write.value, write.options);
  return response;
}
