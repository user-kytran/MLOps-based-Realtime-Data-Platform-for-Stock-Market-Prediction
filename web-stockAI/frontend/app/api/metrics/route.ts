import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const uptime = process.uptime();
  const mem = process.memoryUsage();

  const metrics = [
    '# HELP webstock_frontend_up Whether frontend is running',
    '# TYPE webstock_frontend_up gauge',
    'webstock_frontend_up 1',
    '# HELP webstock_frontend_uptime_seconds Process uptime in seconds',
    '# TYPE webstock_frontend_uptime_seconds gauge',
    `webstock_frontend_uptime_seconds ${uptime}`,
    '# HELP webstock_frontend_memory_heap_used_bytes Heap memory used',
    '# TYPE webstock_frontend_memory_heap_used_bytes gauge',
    `webstock_frontend_memory_heap_used_bytes ${mem.heapUsed}`,
    '# HELP webstock_frontend_memory_heap_total_bytes Heap memory total',
    '# TYPE webstock_frontend_memory_heap_total_bytes gauge',
    `webstock_frontend_memory_heap_total_bytes ${mem.heapTotal}`,
    '# HELP webstock_frontend_memory_rss_bytes Resident set size memory',
    '# TYPE webstock_frontend_memory_rss_bytes gauge',
    `webstock_frontend_memory_rss_bytes ${mem.rss}`,
  ].join('\n') + '\n';

  return new NextResponse(metrics, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    },
  });
}
