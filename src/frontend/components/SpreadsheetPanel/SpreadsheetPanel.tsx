import React, { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Accordion, AccordionSummary, AccordionDetails,
  Chip, Grid, Button, CircularProgress, Alert, Table, TableBody,
  TableCell, TableHead, TableRow, Tooltip, IconButton, Paper
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import TableChartIcon from '@mui/icons-material/TableChart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { SheetInfo, ColumnType } from '../../types';
import { GAS } from '../../services/gas';

const TYPE_COLOR: Record<ColumnType, 'primary'|'success'|'warning'|'error'|'info'|'default'> = {
  email: 'primary', cc: 'info', bcc: 'info', name: 'success',
  subject: 'warning', status: 'warning', date: 'info',
  attachment: 'error', driveLink: 'error', invoice: 'default', custom: 'default',
};

export default function SpreadsheetPanel({ sheetInfo: initial }: { sheetInfo: SheetInfo | null }) {
  const [sheetInfo, setSheetInfo] = useState(initial);
  const [loading, setLoading] = useState(false);

  const rescan = async () => {
    setLoading(true);
    try {
      const info = await GAS.rescanSpreadsheet();
      setSheetInfo(info);
    } catch {
      console.error('Rescan failed');
    }
    setLoading(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>📊 Data Sources</Typography>
          <Typography variant="body2" color="text.secondary">
            Auto-detected spreadsheet structure and tables
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={rescan}
          disabled={loading}
        >
          Re-scan
        </Button>
      </Box>

      {!sheetInfo ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <TableChartIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">No spreadsheet detected</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Make sure this Add-on is open inside a Google Spreadsheet.
            </Typography>
            <Button variant="contained" onClick={rescan} disabled={loading}>Scan Now</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Spreadsheet header */}
          <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #2874f0 0%, #1650c2 100%)', color: '#fff' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700}>{sheetInfo.name}</Typography>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>ID: {sheetInfo.id}</Typography>
              <Box mt={1} display="flex" gap={1} flexWrap="wrap">
                <Chip label={`${sheetInfo.tabs.length} worksheets`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff' }} />
                <Chip label={`${sheetInfo.tabs.reduce((a, t) => a + t.tables.length, 0)} tables detected`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff' }} />
              </Box>
            </CardContent>
          </Card>

          {/* Tabs */}
          {sheetInfo.tabs.map(tab => (
            <Accordion key={tab.name} defaultExpanded={tab.index === 0} sx={{ mb: 1, borderRadius: '8px !important', '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={1} width="100%">
                  <Typography fontWeight={600}>{tab.name}</Typography>
                  <Chip label={`${tab.rowCount} rows`} size="small" />
                  <Chip label={`${tab.tables.length} table(s)`} size="small" color="primary" />
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                {tab.tables.length === 0 ? (
                  <Alert severity="info">No tables detected in this worksheet.</Alert>
                ) : (
                  tab.tables.map((table, ti) => (
                    <Paper key={ti} variant="outlined" sx={{ mb: 2, borderRadius: 2, overflow: 'hidden' }}>
                      <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover', display: 'flex', gap: 1, alignItems: 'center' }}>
                        <TableChartIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                        <Typography variant="subtitle2" fontWeight={700}>
                          Table {ti + 1} — {table.rowCount} data rows
                        </Typography>
                        <Chip label={`Rows ${table.startRow}–${table.endRow}`} size="small" variant="outlined" sx={{ fontSize: '0.65rem' }} />
                      </Box>
                      <Box sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell><b>Column Header</b></TableCell>
                              <TableCell><b>Detected Type</b></TableCell>
                              <TableCell><b>Merge Token</b></TableCell>
                              <TableCell align="center"><b>Auto</b></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {table.headers.map(header => {
                              const type = table.columnMap[header] ?? 'custom';
                              return (
                                <TableRow key={header} hover>
                                  <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>{header}</TableCell>
                                  <TableCell>
                                    <Chip
                                      label={type}
                                      size="small"
                                      color={TYPE_COLOR[type as ColumnType] ?? 'default'}
                                      sx={{ fontSize: '0.65rem', textTransform: 'capitalize' }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <code style={{ fontSize: 11, background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>
                                      {`{{${header.replace(/\s+/g, '')}}}`}
                                    </code>
                                  </TableCell>
                                  <TableCell align="center">
                                    {type !== 'custom' && (
                                      <Tooltip title="Auto-detected">
                                        <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                                      </Tooltip>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </Box>
                    </Paper>
                  ))
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </>
      )}
    </Box>
  );
}
