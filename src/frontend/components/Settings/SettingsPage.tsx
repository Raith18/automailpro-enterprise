import React, { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, TextField, FormControl,
  InputLabel, Select, MenuItem, Button, Divider, Slider, FormControlLabel,
  Switch, Alert, Chip
} from '@mui/material';
import type { Notification } from '../../types';

interface Props {
  aliases: string[];
  onNotify: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
}

export default function SettingsPage({ aliases, onNotify }: Props) {
  const [batchSize, setBatchSize] = useState(50);
  const [dailyCap, setDailyCap] = useState(500);
  const [bufferSecs, setBufferSecs] = useState(5);
  const [defaultAlias, setDefaultAlias] = useState('');
  const [notifBrowser, setNotifBrowser] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);

  const save = () => {
    onNotify({ type: 'success', message: 'Settings saved successfully.' });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={1}>⚙️ Settings</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Global configuration for all schedulers
      </Typography>

      <Grid container spacing={3}>
        {/* Sending Controls */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>📤 Sending Controls</Typography>
              <Divider sx={{ mb: 2 }} />

              <Box mb={3}>
                <Typography variant="body2" fontWeight={600} gutterBottom>
                  Daily Email Cap: <Chip label={dailyCap} size="small" color="primary" />
                </Typography>
                <Slider
                  value={dailyCap}
                  onChange={(_, v) => setDailyCap(v as number)}
                  min={50} max={1500} step={50}
                  marks={[{ value: 500, label: '500 (Gmail limit)' }]}
                />
              </Box>

              <Box mb={3}>
                <Typography variant="body2" fontWeight={600} gutterBottom>
                  Batch Size: <Chip label={batchSize} size="small" color="primary" />
                </Typography>
                <Slider value={batchSize} onChange={(_, v) => setBatchSize(v as number)} min={1} max={200} step={5} />
              </Box>

              <Box>
                <Typography variant="body2" fontWeight={600} gutterBottom>
                  Safety Buffer (random delay): <Chip label={`0–${bufferSecs}s`} size="small" color="warning" />
                </Typography>
                <Slider value={bufferSecs} onChange={(_, v) => setBufferSecs(v as number)} min={0} max={30} step={1} />
                <Typography variant="caption" color="text.secondary">
                  Adds a random delay between sends to mimic human behavior and avoid spam filters.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Identity */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>🔒 Sender Identity</Typography>
              <Divider sx={{ mb: 2 }} />

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Default Sender Alias</InputLabel>
                <Select value={defaultAlias} label="Default Sender Alias" onChange={e => setDefaultAlias(e.target.value)}>
                  <MenuItem value="">My Primary Email</MenuItem>
                  {aliases.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                </Select>
              </FormControl>

              {aliases.length === 0 && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  No aliases found. Add verified sender aliases in your Gmail settings to enable identity management.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Notifications */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>🔔 Notifications</Typography>
              <Divider sx={{ mb: 2 }} />

              <FormControlLabel
                control={<Switch checked={notifBrowser} onChange={e => setNotifBrowser(e.target.checked)} />}
                label="Browser Notifications"
              />
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Show desktop alerts when schedulers complete.
              </Typography>

              <FormControlLabel
                control={<Switch checked={notifEmail} onChange={e => setNotifEmail(e.target.checked)} />}
                label="Email Execution Summary"
              />
              <Typography variant="caption" color="text.secondary" display="block">
                Receive a daily summary of all scheduler execution results to your inbox.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Danger zone */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderColor: 'error.light', border: '1px solid' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom color="error.main">⚠️ Data Management</Typography>
              <Divider sx={{ mb: 2 }} />
              <Alert severity="warning" sx={{ mb: 2 }}>
                These actions are permanent and cannot be undone.
              </Alert>
              <Button variant="outlined" color="error" size="small" sx={{ mr: 1 }}>
                Clear All Logs
              </Button>
              <Button variant="outlined" color="error" size="small">
                Reset All Settings
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Button variant="contained" size="large" onClick={save}>Save Settings</Button>
        </Grid>
      </Grid>
    </Box>
  );
}
