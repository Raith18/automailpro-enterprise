import React, { useState, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Button, IconButton, TextField,
  Grid, List, ListItem, ListItemText, ListItemSecondaryAction, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Divider, Alert, Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PreviewIcon from '@mui/icons-material/Preview';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ArticleIcon from '@mui/icons-material/Article';
import type { EmailTemplate, Notification } from '../../types';
import { GAS } from '../../services/gas';

interface Props {
  templates: EmailTemplate[];
  onNotify: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
}

const DEFAULT_TOKENS = ['{{Name}}', '{{Email}}', '{{Subject}}', '{{Invoice}}', '{{Company}}', '{{Date}}', '{{Amount}}'];

export default function TemplateEditor({ templates: initial, onNotify }: Props) {
  const [templates, setTemplates] = useState(initial);
  const [editing, setEditing] = useState<Partial<EmailTemplate> | null>(null);
  const [preview, setPreview] = useState<EmailTemplate | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const insertToken = (token: string) => {
    if (!bodyRef.current) return;
    const start = bodyRef.current.selectionStart;
    const end = bodyRef.current.selectionEnd;
    const body = editing?.htmlBody ?? '';
    const newBody = body.slice(0, start) + token + body.slice(end);
    setEditing(e => ({ ...e, htmlBody: newBody }));
    setTimeout(() => {
      if (bodyRef.current) {
        bodyRef.current.selectionStart = bodyRef.current.selectionEnd = start + token.length;
        bodyRef.current.focus();
      }
    }, 0);
  };

  const handleSave = async () => {
    if (!editing?.name || !editing?.htmlBody) {
      onNotify({ type: 'error', message: 'Template name and body are required.' });
      return;
    }
    try {
      const res = await GAS.saveTemplate(editing);
      const saved: EmailTemplate = { ...editing as EmailTemplate, id: res.id, updatedAt: new Date().toISOString(), createdAt: editing.createdAt ?? new Date().toISOString() };
      setTemplates(prev => editing.id
        ? prev.map(t => t.id === editing.id ? saved : t)
        : [...prev, saved]);
      onNotify({ type: 'success', message: `Template "${editing.name}" saved.` });
      setEditing(null);
    } catch {
      onNotify({ type: 'error', message: 'Failed to save template.' });
    }
  };

  const handleDelete = async (id: string) => {
    await GAS.deleteTemplate(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
    onNotify({ type: 'info', message: 'Template deleted.' });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>📝 Email Templates</Typography>
          <Typography variant="body2" color="text.secondary">{templates.length} templates</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing({ name: '', subject: '', htmlBody: '', mergeTokens: [] })}>
          New Template
        </Button>
      </Box>

      {templates.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 6 }}>
          <ArticleIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">No templates yet</Typography>
          <Button variant="contained" startIcon={<AddIcon />} sx={{ mt: 2 }} onClick={() => setEditing({ name: '', subject: '', htmlBody: '', mergeTokens: [] })}>
            Create Template
          </Button>
        </Card>
      ) : (
        <List>
          {templates.map(t => (
            <React.Fragment key={t.id}>
              <ListItem sx={{ borderRadius: 2, mb: 0.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                <ListItemText
                  primary={<Typography fontWeight={600}>{t.name}</Typography>}
                  secondary={
                    <Box>
                      <Typography variant="caption" color="text.secondary">{t.subject}</Typography>
                      <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
                        {(t.mergeTokens ?? []).slice(0, 5).map(tok => (
                          <Chip key={tok} label={tok} size="small" variant="outlined" sx={{ fontSize: '0.6rem' }} />
                        ))}
                      </Box>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Preview"><IconButton onClick={() => setPreview(t)}><PreviewIcon /></IconButton></Tooltip>
                  <Tooltip title="Duplicate"><IconButton onClick={() => setEditing({ ...t, id: undefined, name: `${t.name} (Copy)` })}><ContentCopyIcon /></IconButton></Tooltip>
                  <Tooltip title="Edit"><IconButton onClick={() => setEditing(t)} color="primary"><EditIcon /></IconButton></Tooltip>
                  <Tooltip title="Delete"><IconButton onClick={() => handleDelete(t.id)} color="error"><DeleteIcon /></IconButton></Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      )}

      {/* Editor Dialog */}
      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle fontWeight={700}>{editing?.id ? 'Edit Template' : 'New Template'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Template Name *" value={editing?.name ?? ''} onChange={e => setEditing(v => ({ ...v, name: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Default Subject" value={editing?.subject ?? ''} onChange={e => setEditing(v => ({ ...v, subject: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 1 }}>
                Click a merge token to insert it at your cursor position.
              </Alert>
              <Box display="flex" gap={0.5} flexWrap="wrap" mb={1}>
                {DEFAULT_TOKENS.map(tok => (
                  <Chip key={tok} label={tok} size="small" clickable onClick={() => insertToken(tok)} color="primary" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                ))}
              </Box>
              <TextField
                fullWidth multiline minRows={12} label="Email Body (HTML) *"
                value={editing?.htmlBody ?? ''}
                onChange={e => setEditing(v => ({ ...v, htmlBody: e.target.value }))}
                inputRef={bodyRef}
                inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setEditing(null)} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save Template</Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!preview} onClose={() => setPreview(null)} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle fontWeight={700}>Preview: {preview?.name}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle2" fontWeight={600} mb={1}>Subject: {preview?.subject}</Typography>
          <Divider sx={{ mb: 2 }} />
          <Box
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, minHeight: 200, bgcolor: '#fff' }}
            dangerouslySetInnerHTML={{ __html: preview?.htmlBody ?? '' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreview(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
