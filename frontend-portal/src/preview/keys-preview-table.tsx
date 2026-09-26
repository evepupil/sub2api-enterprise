import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import type { PreviewKey } from './fixtures';

export function KeysPreviewTable({ rows }: { rows: readonly PreviewKey[] }) {
  return (
    <Table className="min-w-table table-fixed">
      <TableCaption>示例密钥数据</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-2/5">名称</TableHead>
          <TableHead className="w-1/5">状态</TableHead>
          <TableHead className="w-1/5 text-right">已用金额</TableHead>
          <TableHead className="w-1/5">到期日</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="whitespace-normal break-words">{row.name}</TableCell>
            <TableCell>
              <Badge variant={row.status === 'active' ? 'success' : 'warning'}>
                {row.status === 'active' ? '可用' : '已停用'}
              </Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">{row.spent}</TableCell>
            <TableCell className="whitespace-nowrap">{row.expiresAt}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
