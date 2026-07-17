import React from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Chip, LinearProgress,
  Avatar, List, ListItem, ListItemAvatar, ListItemText, Divider, Paper,
  Fade, Zoom
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';
import ScheduleIcon from '@mui/icons-material/Schedule';
import type { DashboardStats, Scheduler, LogEntry } from '../../types';

interface Props {
  stats: DashboardStats | null;
  schedulers: Scheduler[];
  logs: LogEntry[];
}

const StatCard = ({
  label, value, color, icon, sub, delay
}: { label: string; value: number | string; color: string; icon: React.ReactNode; sub?: string; delay: number }) => (
  <Zoom in={true} style={{ transitionDelay: `${delay}ms` }}>
    <Card sx={{
      height: '100%',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }
    }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: color, width: 48, height: 48, transition: 'transform 0.3s ease', '&:hover': { transform: 'scale(1.1)' } }}>{icon}</Avatar>
        <Box>
          <Typography variant="h4" fontWeight={800} color={color}>{value}</Typography>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>{label}</Typography>
          {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
        </Box>
      </CardContent>
    </Card>
  </Zoom>
);

export default function Dashboard({ stats, schedulers, logs }: Props) {
  const quotaPct = stats ? Math.round((stats.gmailQuotaUsed / stats.gmailQuotaLimit) * 100) : 0;
  const activeSchedulers = schedulers.filter(s => s.status === 'active');

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom fontWeight={700}>
        📊 Dashboard
        <Chip label="Live" color="success" size="small" sx={{ ml: 1, mb: 0.5 }} />
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        {stats ? `Last synced: ${new Date(stats.lastSyncAt).toLocaleString()}` : 'Loading data...'}
      </Typography>

      {/* Stat Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
        <StatCard label="Emails Sent" value={stats?.totalSent ?? '—'} color="#388e3c" icon={<CheckCircleIcon />} delay={100} />
        <StatCard label="Failed" value={stats?.totalFailed ?? '—'} color="#d32f2f" icon={<ErrorIcon />} delay={200} />
        <StatCard label="Pending" value={stats?.totalPending ?? '—'} color="#f59e0b" icon={<PendingIcon />} delay={300} />
        <StatCard label="Active Schedulers" value={activeSchedulers.length} color="#2874f0" icon={<ScheduleIcon />} sub={`of ${schedulers.length} total`} delay={400} />
      </Box>

      {/* Detail Cards */}
      <Fade in={true} style={{ transitionDelay: '500ms' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
          {/* Gmail Quota */}
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', '&:hover': { boxShadow: 4, transition: 'box-shadow 0.2s' } }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography variant="h6" gutterBottom>Gmail Quota</Typography>
              <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', height: 120 }}>
                <Box sx={{
                  width: 100, height: 100, borderRadius: '50%',
                  background: `conic-gradient(#2874f0 ${quotaPct * 3.6}deg, #e0e7ff ${quotaPct * 3.6}deg)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 1s ease-out'
                }}>
                  <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <Typography variant="h6" fontWeight={800}>{quotaPct}%</Typography>
                  </Box>
                </Box>
              </Box>
              <Typography variant="body2" textAlign="center" color="text.secondary" mt={2}>
                {stats?.gmailQuotaUsed ?? 0} / {stats?.gmailQuotaLimit ?? 500} emails used today
              </Typography>
              <LinearProgress variant="determinate" value={quotaPct} sx={{ mt: 1, borderRadius: 4, height: 6 }} color={quotaPct > 80 ? 'error' : 'primary'} />
            </CardContent>
          </Card>

          {/* Active Schedulers */}
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', '&:hover': { boxShadow: 4, transition: 'box-shadow 0.2s' } }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography variant="h6" gutterBottom>Active Schedulers</Typography>
              {activeSchedulers.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                  <ScheduleIcon sx={{ fontSize: 40, opacity: 0.3 }} />
                  <Typography variant="body2" mt={1}>No active schedulers</Typography>
                </Box>
              ) : (
                <List dense disablePadding>
                  {activeSchedulers.slice(0, 5).map(s => (
                    <React.Fragment key={s.id}>
                      <ListItem disablePadding sx={{ py: 0.5 }}>
                        <ListItemAvatar sx={{ minWidth: 36 }}>
                          <Avatar sx={{ width: 28, height: 28, bgcolor: 'success.light', fontSize: '0.7rem' }}>
                            {s.name[0]}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={s.name}
                          secondary={s.scheduleType}
                          primaryTypographyProps={{ fontSize: 12, fontWeight: 600 }}
                          secondaryTypographyProps={{ fontSize: 11 }}
                        />
                        <Chip label="Active" color="success" size="small" sx={{ fontSize: '0.6rem', height: 16 }} />
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', '&:hover': { boxShadow: 4, transition: 'box-shadow 0.2s' } }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography variant="h6" gutterBottom>Recent Activity</Typography>
              {logs.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                  <EmailIcon sx={{ fontSize: 40, opacity: 0.3 }} />
                  <Typography variant="body2" mt={1}>No activity yet</Typography>
                </Box>
              ) : (
                <List dense disablePadding>
                  {logs.slice(0, 6).map(log => (
                    <ListItem key={log.id} disablePadding sx={{ py: 0.5 }}>
                      <ListItemAvatar sx={{ minWidth: 32 }}>
                        {log.status === 'Sent'
                          ? <CheckCircleIcon sx={{ color: 'success.main', fontSize: 18 }} />
                          : <ErrorIcon sx={{ color: 'error.main', fontSize: 18 }} />}
                      </ListItemAvatar>
                      <ListItemText
                        primary={log.recipient}
                        secondary={new Date(log.timestamp).toLocaleTimeString()}
                        primaryTypographyProps={{ fontSize: 11, fontWeight: 600, noWrap: true }}
                        secondaryTypographyProps={{ fontSize: 10 }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Box>
      </Fade>
    </Box>
  );
}
