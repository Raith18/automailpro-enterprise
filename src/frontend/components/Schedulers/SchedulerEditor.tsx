import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Box, Grid, TextField, MenuItem, Select, InputLabel, FormControl,
  FormControlLabel, Checkbox, Typography, Tabs, Tab, Divider,
  Chip, IconButton, Tooltip, Paper, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import type { Scheduler, EmailTemplate, SheetInfo, ConditionRule, ScheduleType } from '../../types';

interface Props {
  scheduler: Scheduler | null;
  templates: EmailTemplate[];
  sheetInfo: SheetInfo | null;
  aliases: string[];
  onSave: (data: Partial<Scheduler>) => void;
  onClose: () => void;
}

const SCHEDULE_TYPES: { value: ScheduleType; label: string }[] = [
  { value: 'now', label: 'Send Now' },
  { value: 'once', label: 'One-Time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'businessDays', label: 'Business Days Only' },
  { value: 'everyXMinutes', label: 'Every X Minutes' },
  { value: 'everyXHours', label: 'Every X Hours' },
  { value: 'everyXDays', label: 'Every X Days' },
  { value: 'cron', label: 'Custom Cron Expression' },
];

const CONDITION_OPERATORS = [
  { value: 'equals', label: '= equals' },
  { value: 'notEquals', label: '≠ not equals' },
  { value: 'contains', label: '∋ contains' },
  { value: 'greaterThan', label: '> greater than' },
  { value: 'lessThan', label: '< less than' },
  { value: 'isDate', label: '📅 is today' },
  { value: 'isChecked', label: '✅ is checked' },
  { value: 'isNotEmpty', label: '◉ is not empty' },
];

const blank: Partial<Scheduler> = {
  name: '',
  status: 'active',
  spreadsheetId: '',
  tabName: '',
  tableStartRow: 1,
  recipientColumn: '',
  subjectTemplate: '',
  bodyTemplate: '',
  scheduleType: 'daily',
  sendTime: '08:00',
  timezone: 'Asia/Kolkata',
  skipWeekends: false,
  maxRetries: 3,
  retryDelaySecs: 60,
  conditions: [],
};

export default function SchedulerEditor({ scheduler, templates, sheetInfo, aliases, onSave, onClose }: Props) {
  const [form, setForm] = useState<Partial<Scheduler>>(scheduler ? { ...scheduler } : { ...blank });
  const [tab, setTab] = useState(0);

  const update = (field: keyof Scheduler, val: any) => setForm(f => ({ ...f, [field]: val }));

  const allTabs = sheetInfo?.tabs ?? [];
  const currentTab = allTabs.find(t => t.name === form.tabName);
  const availableHeaders = currentTab?.tables[0]?.headers ?? [];

  const addCondition = () => {
    const cond: ConditionRule = { column: '', operator: 'equals', value: '' };
    setForm(f => ({ ...f, conditions: [...(f.conditions ?? []), cond] }));
  };

  const updateCondition = (i: number, field: keyof ConditionRule, val: string) => {
    const conds = [...(form.conditions ?? [])];
    (conds[i] as any)[field] = val;
    setForm(f => ({ ...f, conditions: conds }));
  };

  const removeCondition = (i: number) => {
    setForm(f => ({ ...f, conditions: (f.conditions ?? []).filter((_, idx) => idx !== i) }));
  };

  const handleSave = () => {
    if (!form.name || !form.recipientColumn) {
      alert('Please provide a scheduler name and recipient column.');
      return;
    }
    onSave({ ...form, updatedAt: new Date().toISOString(), createdAt: form.createdAt ?? new Date().toISOString() });
  };

  return (
    <Dialog open fullWidth maxWidth="md" onClose={onClose} PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 0, fontWeight: 700 }}>
        {scheduler ? `Edit: ${scheduler.name}` : '+ New Scheduler'}
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Basic" />
          <Tab label="Recipients" />
          <Tab label="Schedule" />
          <Tab label="Conditions" />
          <Tab label="Template" />
          <Tab label="Advanced" />
        </Tabs>

        <Box p={3}>
          {/* Tab 0: Basic */}
          {tab === 0 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField fullWidth label="Scheduler Name *" value={form.name ?? ''} onChange={e => update('name', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Worksheet (Tab)</InputLabel>
                  <Select value={form.tabName ?? ''} label="Worksheet (Tab)" onChange={e => update('tabName', e.target.value)}>
                    {allTabs.map(t => (
                      <MenuItem key={t.name} value={t.name}>{t.name} ({t.rowCount} rows)</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Sender Alias</InputLabel>
                  <Select value={form.senderAlias ?? ''} label="Sender Alias" onChange={e => update('senderAlias', e.target.value)}>
                    <MenuItem value="">Default (my email)</MenuItem>
                    {aliases.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          )}

          {/* Tab 1: Recipients */}
          {tab === 1 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Alert severity="info" sx={{ mb: 1 }}>
                  Select which columns in your spreadsheet contain the email addresses.
                </Alert>
              </Grid>
              {(['recipientColumn', 'ccColumn', 'bccColumn'] as const).map(field => (
                <Grid item xs={12} sm={4} key={field}>
                  <FormControl fullWidth>
                    <InputLabel>{field === 'recipientColumn' ? 'To (Recipient) *' : field === 'ccColumn' ? 'CC' : 'BCC'}</InputLabel>
                    <Select
                      value={(form as any)[field] ?? ''}
                      label={field}
                      onChange={e => update(field, e.target.value)}
                    >
                      <MenuItem value="">(none)</MenuItem>
                      {availableHeaders.map(h => <MenuItem key={h} value={h}>{h}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              ))}
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Reply-To Email" value={form.replyTo ?? ''} onChange={e => update('replyTo', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Subject Template" value={form.subjectTemplate ?? ''} onChange={e => update('subjectTemplate', e.target.value)} helperText="Use {{ColumnName}} for dynamic values" />
              </Grid>
            </Grid>
          )}

          {/* Tab 2: Schedule */}
          {tab === 2 && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Schedule Type</InputLabel>
                  <Select value={form.scheduleType ?? 'daily'} label="Schedule Type" onChange={e => update('scheduleType', e.target.value as ScheduleType)}>
                    {SCHEDULE_TYPES.map(st => <MenuItem key={st.value} value={st.value}>{st.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              {['everyXMinutes', 'everyXHours', 'everyXDays'].includes(form.scheduleType ?? '') && (
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth type="number" label="Interval Value" value={form.scheduleValue ?? 1} onChange={e => update('scheduleValue', Number(e.target.value))} />
                </Grid>
              )}
              {form.scheduleType === 'cron' && (
                <Grid item xs={12}>
                  <TextField fullWidth label="Cron Expression" value={form.cronExpression ?? ''} onChange={e => update('cronExpression', e.target.value)} helperText="e.g., 0 9 * * 1 (every Monday 9am)" />
                </Grid>
              )}
              <Grid item xs={12} sm={4}>
                <TextField fullWidth type="time" label="Send Time" value={form.sendTime ?? '08:00'} onChange={e => update('sendTime', e.target.value)} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth type="date" label="Start Date" value={form.startDate ?? ''} onChange={e => update('startDate', e.target.value)} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth type="date" label="End Date" value={form.endDate ?? ''} onChange={e => update('endDate', e.target.value)} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Timezone</InputLabel>
                  <Select value={form.timezone ?? 'Asia/Kolkata'} label="Timezone" onChange={e => update('timezone', e.target.value)}>
                    {['Asia/Kolkata', 'UTC', 'America/New_York', 'Europe/London', 'Asia/Singapore'].map(tz => (
                      <MenuItem key={tz} value={tz}>{tz}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={3}>
                <FormControlLabel control={<Checkbox checked={form.skipWeekends ?? false} onChange={e => update('skipWeekends', e.target.checked)} />} label="Skip Weekends" />
              </Grid>
              <Grid item xs={6} sm={3}>
                <FormControlLabel control={<Checkbox checked={form.skipHolidays ?? false} onChange={e => update('skipHolidays', e.target.checked)} />} label="Skip Holidays" />
              </Grid>
            </Grid>
          )}

          {/* Tab 3: Conditions */}
          {tab === 3 && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Emails are only sent to rows that match ALL conditions below.
              </Alert>
              {(form.conditions ?? []).map((cond, i) => (
                <Paper key={i} variant="outlined" sx={{ p: 2, mb: 1, borderRadius: 2 }}>
                  <Grid container spacing={1} alignItems="center">
                    {i > 0 && (
                      <Grid item xs={12}>
                        <FormControl size="small">
                          <Select value={cond.logicOperator ?? 'AND'} onChange={e => updateCondition(i, 'logicOperator', e.target.value)}>
                            <MenuItem value="AND">AND</MenuItem>
                            <MenuItem value="OR">OR</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    )}
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Column</InputLabel>
                        <Select value={cond.column} label="Column" onChange={e => updateCondition(i, 'column', e.target.value)}>
                          {availableHeaders.map(h => <MenuItem key={h} value={h}>{h}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Operator</InputLabel>
                        <Select value={cond.operator} label="Operator" onChange={e => updateCondition(i, 'operator', e.target.value as any)}>
                          {CONDITION_OPERATORS.map(op => <MenuItem key={op.value} value={op.value}>{op.label}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={10} sm={3}>
                      <TextField fullWidth size="small" label="Value" value={cond.value} onChange={e => updateCondition(i, 'value', e.target.value)} />
                    </Grid>
                    <Grid item xs={2} sm={1}>
                      <IconButton color="error" onClick={() => removeCondition(i)}><DeleteIcon /></IconButton>
                    </Grid>
                  </Grid>
                </Paper>
              ))}
              <Button startIcon={<AddIcon />} onClick={addCondition} variant="outlined" sx={{ mt: 1 }}>
                Add Condition
              </Button>
            </Box>
          )}

          {/* Tab 4: Template */}
          {tab === 4 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Use Saved Template</InputLabel>
                  <Select value={form.templateId ?? ''} label="Use Saved Template" onChange={e => {
                    const t = templates.find(x => x.id === e.target.value);
                    update('templateId', e.target.value);
                    if (t) { update('bodyTemplate', t.htmlBody); update('subjectTemplate', t.subject); }
                  }}>
                    <MenuItem value="">(Custom)</MenuItem>
                    {templates.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                {availableHeaders.length > 0 && (
                  <Box mb={1} display="flex" flexWrap="wrap" gap={0.5}>
                    <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>Available merge tokens:</Typography>
                    {availableHeaders.map(h => (
                      <Chip key={h} label={`{{${h}}}`} size="small" clickable onClick={() => update('bodyTemplate', (form.bodyTemplate ?? '') + `{{${h}}}`)} />
                    ))}
                  </Box>
                )}
                <TextField
                  fullWidth multiline minRows={8} label="Email Body (HTML supported)"
                  value={form.bodyTemplate ?? ''} onChange={e => update('bodyTemplate', e.target.value)}
                  sx={{ fontFamily: 'monospace' }}
                />
              </Grid>
            </Grid>
          )}

          {/* Tab 5: Advanced */}
          {tab === 5 && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth type="number" label="Max Retries" value={form.maxRetries ?? 3} onChange={e => update('maxRetries', Number(e.target.value))} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth type="number" label="Retry Delay (seconds)" value={form.retryDelaySecs ?? 60} onChange={e => update('retryDelaySecs', Number(e.target.value))} />
              </Grid>
            </Grid>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button variant="contained" onClick={handleSave}>Save Scheduler</Button>
      </DialogActions>
    </Dialog>
  );
}
