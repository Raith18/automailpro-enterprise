import React, { useState, useMemo } from 'react';
import {
  Box, Typography, TextField, InputAdornment, Select, MenuItem, FormControl,
  InputLabel, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, Tooltip, CircularProgress, Menu
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import type { LogEntry, LogStatus } from '../../types';
import { GAS } from '../../services/gas';

const STATUS_ICON: Record<LogStatus, React.ReactNode> = {
  Sent: <CheckCircleIcon sx={{ color: 'success.main', fontSize: 16 }} />,
  Failed: <ErrorIcon sx={{ color: 'error.main', fontSize: 16 }} />,
  Pending: <HourglassEmptyIcon sx={{ color: 'warning.main', fontSize: 16 }} />,
  Retrying: <HourglassEmptyIcon sx={{ color: 'info.main', fontSize: 16 }} />,
  Skipped: <HourglassEmptyIcon sx={{ color: 'text.disabled', fontSize: 16 }} />,
};

const STATUS_COLOR: Record<LogStatus, any> = {
  Sent: 'success', Failed: 'error', Pending: 'warning', Retrying: 'info', Skipped: 'default',
};

export default function LogsViewer({ logs: initial }: { logs: LogEntry[] }) {
  const [logs] = useState<LogEntry[]>(initial);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      const matchSearch = !search ||
        l.recipient.toLowerCase().includes(search.toLowerCase()) ||
        l.subject.toLowerCase().includes(search.toLowerCase()) ||
        l.schedulerName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !filterStatus || l.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [logs, search, filterStatus]);

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    setExportAnchor(null);
    try {
      const data = await GAS.exportLogs(format);
      const blob = new Blob([data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `execution-logs-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      console.error('Export failed');
    }
    setExporting(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>📋 Execution Logs</Typography>
          <Typography variant="body2" color="text.secondary">
            {filtered.length} of {logs.length} entries
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={exporting ? <CircularProgress size={16} /> : <FileDownloadIcon />}
          disabled={exporting}
          onClick={e => setExportAnchor(e.currentTarget)}
        >
          Export
        </Button>
        <Menu anchorEl={exportAnchor} open={!!exportAnchor} onClose={() => setExportAnchor(null)}>
          <MenuItem onClick={() => handleExport('csv')}>Export as CSV</MenuItem>
          <MenuItem onClick={() => handleExport('json')}>Export as JSON</MenuItem>
        </Menu>
      </Box>

      {/* Filters */}
      <Box display="flex" gap={2} mb={2} flexWrap="wrap">
        <TextField
          placeholder="Search recipient, subject, scheduler..."
          size="small"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ flex: 1, minWidth: 200 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select value={filterStatus} label="Status" onChange={e => setFilterStatus(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            {(['Sent', 'Failed', 'Pending', 'Retrying', 'Skipped'] as LogStatus[]).map(s => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, width: 28 }}></TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Recipient</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Subject</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Scheduler</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Timestamp</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">Retries</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">Duration</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No log entries found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(log => (
                <TableRow key={log.id} hover>
                  <TableCell>{STATUS_ICON[log.status]}</TableCell>
                  <TableCell sx={{ fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Tooltip title={log.recipient}><span>{log.recipient}</span></Tooltip>
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Tooltip title={log.subject}><span>{log.subject}</span></Tooltip>
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{log.schedulerName}</TableCell>
                  <TableCell sx={{ fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell align="center" sx={{ fontSize: 12 }}>{log.retryCount}</TableCell>
                  <TableCell align="center" sx={{ fontSize: 11, color: 'text.secondary' }}>{log.durationMs}ms</TableCell>
                  <TableCell>
                    <Chip label={log.status} size="small" color={STATUS_COLOR[log.status]} sx={{ fontSize: '0.65rem' }} />
                    {log.error && (
                      <Tooltip title={log.error}>
                        <ErrorIcon sx={{ fontSize: 14, color: 'error.main', ml: 0.5, verticalAlign: 'middle' }} />
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
