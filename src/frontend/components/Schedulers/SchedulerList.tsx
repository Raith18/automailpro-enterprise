import React, { useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, CardActions, Chip,
  IconButton, Tooltip, Fab, Grid, Menu, MenuItem, Dialog,
  DialogTitle, DialogContent, DialogActions, Alert, LinearProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SendIcon from '@mui/icons-material/Send';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ScheduleIcon from '@mui/icons-material/Schedule';
import type { Scheduler, EmailTemplate, SheetInfo, Notification } from '../../types';
import SchedulerEditor from './SchedulerEditor';
import { GAS } from '../../services/gas';

interface Props {
  schedulers: Scheduler[];
  templates: EmailTemplate[];
  sheetInfo: SheetInfo | null;
  aliases: string[];
  onNotify: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
}

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  active: 'success', paused: 'warning', error: 'error', completed: 'default', disabled: 'default',
};

export default function SchedulerList({ schedulers: initial, templates, sheetInfo, aliases, onNotify }: Props) {
  const [schedulers, setSchedulers] = useState<Scheduler[]>(initial);
  const [editing, setEditing] = useState<Scheduler | null | 'new'>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; id: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleSave = async (data: Partial<Scheduler>) => {
    try {
      const res = await GAS.saveScheduler(data);
      if (res.success) {
        const updated = editing === 'new'
          ? [...schedulers, { ...data, id: res.id } as Scheduler]
          : schedulers.map(s => s.id === data.id ? { ...s, ...data } as Scheduler : s);
        setSchedulers(updated);
        onNotify({ type: 'success', message: `Scheduler "${data.name}" saved successfully.` });
      }
    } catch {
      onNotify({ type: 'error', message: 'Failed to save scheduler. Check your connection.' });
    }
    setEditing(null);
  };

  const handleToggle = async (s: Scheduler) => {
    const next = s.status === 'active' ? 'paused' : 'active';
    await GAS.toggleSchedulerStatus(s.id, next);
    setSchedulers(prev => prev.map(sc => sc.id === s.id ? { ...sc, status: next as any } : sc));
  };

  const handleDelete = async (id: string) => {
    await GAS.deleteScheduler(id);
    setSchedulers(prev => prev.filter(s => s.id !== id));
    onNotify({ type: 'info', message: 'Scheduler deleted.' });
    setDeleteConfirm(null);
  };

  const handleSendNow = async (id: string) => {
    setSending(id);
    try {
      const res = await GAS.sendNow(id);
      onNotify({ type: 'success', message: `Send complete: ${res.sent} sent, ${res.failed} failed.` });
    } catch {
      onNotify({ type: 'error', message: 'Send failed. Please check logs.' });
    }
    setSending(null);
  };

  const handleDuplicate = (s: Scheduler) => {
    const dup: Scheduler = { ...s, id: '', name: `${s.name} (Copy)`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setEditing(dup);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>⚙️ Schedulers</Typography>
          <Typography variant="body2" color="text.secondary">
            {schedulers.filter(s => s.status === 'active').length} active · {schedulers.length} total
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
          New Scheduler
        </Button>
      </Box>

      {schedulers.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 6 }}>
          <ScheduleIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">No schedulers yet</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Create your first scheduler to start automating emails.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
            Create Scheduler
          </Button>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {schedulers.map(s => (
            <Grid item xs={12} md={6} lg={4} key={s.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {sending === s.id && <LinearProgress />}
                <CardContent sx={{ flex: 1 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box flex={1}>
                      <Typography variant="subtitle1" fontWeight={700} noWrap>{s.name}</Typography>
                      <Chip
                        label={s.status.toUpperCase()}
                        size="small"
                        color={STATUS_COLOR[s.status] ?? 'default'}
                        sx={{ mt: 0.5, fontSize: '0.65rem' }}
                      />
                    </Box>
                    <IconButton size="small" onClick={e => setMenuAnchor({ el: e.currentTarget, id: s.id })}>
                      <MoreVertIcon />
                    </IconButton>
                  </Box>

                  <Box mt={1.5} display="flex" flexDirection="column" gap={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      📅 {s.scheduleType} {s.scheduleValue ? `(every ${s.scheduleValue})` : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      📧 Column: {s.recipientColumn || 'Not set'}
                    </Typography>
                    {s.conditions && s.conditions.length > 0 && (
                      <Chip label={`${s.conditions.length} condition(s)`} size="small" variant="outlined" sx={{ width: 'fit-content', fontSize: '0.65rem' }} />
                    )}
                    {s.lastRunAt && (
                      <Typography variant="caption" color="text.secondary">
                        Last run: {new Date(s.lastRunAt).toLocaleString()}
                      </Typography>
                    )}
                    {s.nextRunAt && (
                      <Typography variant="caption" color="text.secondary">
                        Next: {new Date(s.nextRunAt).toLocaleString()}
                      </Typography>
                    )}
                  </Box>

                  <Box display="flex" gap={1} mt={1}>
                    <Chip icon={<SendIcon sx={{ fontSize: '0.8rem !important' }} />} label={`${s.totalSent ?? 0} sent`} size="small" color="success" variant="outlined" sx={{ fontSize: '0.65rem' }} />
                    <Chip label={`${s.totalFailed ?? 0} failed`} size="small" color={s.totalFailed ? 'error' : 'default'} variant="outlined" sx={{ fontSize: '0.65rem' }} />
                  </Box>
                </CardContent>
                <CardActions sx={{ px: 2, pb: 1.5, gap: 0.5 }}>
                  <Tooltip title={s.status === 'active' ? 'Pause' : 'Resume'}>
                    <IconButton size="small" onClick={() => handleToggle(s)} color={s.status === 'active' ? 'warning' : 'success'}>
                      {s.status === 'active' ? <PauseIcon /> : <PlayArrowIcon />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => setEditing(s)} color="primary">
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Send Now">
                    <span>
                      <IconButton size="small" disabled={sending === s.id} onClick={() => handleSendNow(s.id)} color="primary">
                        <SendIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Box flex={1} />
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => setDeleteConfirm(s.id)} color="error">
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Floating Add Button (mobile) */}
      <Fab
        color="primary"
        aria-label="add"
        onClick={() => setEditing('new')}
        sx={{ position: 'fixed', bottom: 24, right: 24, display: { md: 'none' } }}
      >
        <AddIcon />
      </Fab>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor?.el}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => { const s = schedulers.find(x => x.id === menuAnchor?.id); if (s) handleDuplicate(s); setMenuAnchor(null); }}>
          <ContentCopyIcon sx={{ mr: 1, fontSize: 16 }} /> Duplicate
        </MenuItem>
        <MenuItem onClick={() => { setDeleteConfirm(menuAnchor?.id ?? null); setMenuAnchor(null); }} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1, fontSize: 16 }} /> Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Scheduler?</DialogTitle>
        <DialogContent>
          <Alert severity="error">This action cannot be undone. All configuration and history for this scheduler will be permanently removed.</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Editor Dialog */}
      {editing !== null && (
        <SchedulerEditor
          scheduler={editing === 'new' ? null : editing}
          templates={templates}
          sheetInfo={sheetInfo}
          aliases={aliases}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </Box>
  );
}
