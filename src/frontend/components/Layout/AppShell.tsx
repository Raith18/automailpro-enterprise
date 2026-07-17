import React, { useState, useMemo, createContext, useContext, useCallback, useEffect } from 'react';
import {
  Box, Drawer, AppBar, Toolbar, IconButton, Typography, List, ListItemButton,
  ListItemIcon, ListItemText, Divider, Chip, Tooltip, Badge, Avatar,
  CircularProgress, Alert, Snackbar,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TableChartIcon from '@mui/icons-material/TableChart';
import ArticleIcon from '@mui/icons-material/Article';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';

import Dashboard from '../Dashboard/Dashboard';
import SchedulerList from '../Schedulers/SchedulerList';
import SpreadsheetPanel from '../SpreadsheetPanel/SpreadsheetPanel';
import TemplateEditor from '../Templates/TemplateEditor';
import LogsViewer from '../Logs/LogsViewer';
import SettingsPage from '../Settings/SettingsPage';

import type { AppState, Notification } from '../../types';

const DRAWER_WIDTH = 240;

type Page = 'dashboard' | 'schedulers' | 'spreadsheet' | 'templates' | 'logs' | 'settings';

interface AppShellProps {
  colorMode: { toggle: () => void; mode: 'light' | 'dark' };
  appState: AppState | null;
  loading: boolean;
}

const NAV_ITEMS: { id: Page; label: string; icon: React.ReactNode; badge?: number }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { id: 'schedulers', label: 'Schedulers', icon: <ScheduleIcon /> },
  { id: 'spreadsheet', label: 'Data Sources', icon: <TableChartIcon /> },
  { id: 'templates', label: 'Templates', icon: <ArticleIcon /> },
  { id: 'logs', label: 'Execution Logs', icon: <HistoryIcon /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
];

export default function AppShell({ colorMode, appState, loading }: AppShellProps) {
  const [page, setPage] = useState<Page>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; type: 'success'|'error'|'info' }>({ open: false, msg: '', type: 'success' });

  const unread = notifications.filter(n => !n.read).length;

  const addNotif = useCallback((n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    setNotifications(prev => [{
      ...n,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      read: false,
    }, ...prev]);
    setSnack({ open: true, msg: n.message, type: n.type });
  }, []);

  // Window Resize Logic for Google Apps Script Modeless Dialog
  useEffect(() => {
    let isDragging = false;
    let animationFrameId: number;

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      if (typeof google !== 'undefined' && google.script && google.script.host) {
        // Throttle using requestAnimationFrame for smooth resizing without crashing GAS
        cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(() => {
          // e.clientX is relative to top-left of iframe. Add a tiny buffer so cursor doesn't escape iframe.
          const newWidth = Math.max(480, e.clientX + 10);
          const newHeight = Math.max(400, e.clientY + 10);
          google.script.host.setWidth(newWidth);
          google.script.host.setHeight(newHeight);
        });
      }
    };

    const onMouseUp = () => {
      isDragging = false;
      document.body.style.cursor = 'default';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    const handleMouseDown = () => {
      isDragging = true;
      document.body.style.cursor = 'nwse-resize';
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    const resizeHandle = document.getElementById('gas-resize-handle');
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', handleMouseDown);
    }

    return () => {
      if (resizeHandle) resizeHandle.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo */}
      <Box sx={{
        p: 2, display: 'flex', alignItems: 'center', gap: 1,
        background: 'linear-gradient(135deg, #2874f0 0%, #1650c2 100%)',
        color: '#fff', minHeight: 64
      }}>
        <ShoppingBagIcon sx={{ color: '#ffe500', fontSize: 28 }} />
        <Box>
          <Typography variant="subtitle1" fontWeight={800} fontStyle="italic" lineHeight={1.1}>
            AutoMail<span style={{ color: '#ffe500', fontStyle: 'normal' }}>Pro</span>
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.85, letterSpacing: 1 }}>v20.0 ENTERPRISE</Typography>
        </Box>
        <Box sx={{ ml: 'auto' }}>
          <IconButton size="small" onClick={() => setDrawerOpen(false)} sx={{ color: 'rgba(255,255,255,0.7)' }}>
            <ChevronLeftIcon />
          </IconButton>
        </Box>
      </Box>

      <Divider />

      {/* Nav */}
      <List sx={{ flex: 1, pt: 1 }}>
        {NAV_ITEMS.map(item => (
          <ListItemButton
            key={item.id}
            selected={page === item.id}
            onClick={() => setPage(item.id)}
            sx={{
              mx: 1, borderRadius: 2, mb: 0.5,
              '&.Mui-selected': {
                background: 'linear-gradient(135deg, #2874f0 0%, #1650c2 100%)',
                color: '#fff',
                '& .MuiListItemIcon-root': { color: '#fff' },
                '&:hover': { background: 'linear-gradient(135deg, #1a68e0 0%, #0e40b2 100%)' }
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }} />
            {item.id === 'schedulers' && appState && (
              <Chip
                label={appState.schedulers.filter(s => s.status === 'active').length}
                size="small"
                color="success"
                sx={{ height: 18, fontSize: '0.65rem' }}
              />
            )}
          </ListItemButton>
        ))}
      </List>

      <Divider />
      {/* User info */}
      {appState && (
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: '0.75rem' }}>
            {appState.userEmail?.[0]?.toUpperCase() ?? 'U'}
          </Avatar>
          <Box sx={{ overflow: 'hidden', flex: 1 }}>
            <Typography variant="caption" display="block" noWrap fontWeight={600}>
              {appState.userEmail}
            </Typography>
            <Typography variant="caption" color="text.secondary" fontSize="0.65rem">
              Connected ✓
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* AppBar */}
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar variant="dense" sx={{ minHeight: 48 }}>
          <IconButton color="inherit" edge="start" onClick={() => setDrawerOpen(d => !d)} sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap fontWeight={800} fontStyle="italic" sx={{ flexGrow: 1, fontSize: 16 }}>
            AutoMail<span style={{ color: '#ffe500', fontStyle: 'normal' }}>Pro</span>
            <Typography component="span" variant="caption" sx={{ ml: 1, opacity: 0.8, fontSize: '0.65rem' }}>
              {NAV_ITEMS.find(n => n.id === page)?.label}
            </Typography>
          </Typography>

          {/* Gmail Quota Badge */}
          {appState && (
            <Tooltip title={`Gmail Quota: ${appState.stats.gmailQuotaUsed}/${appState.stats.gmailQuotaLimit}`}>
              <Chip
                label={`${appState.stats.gmailQuotaUsed} / ${appState.stats.gmailQuotaLimit} quota`}
                size="small"
                sx={{ mr: 1, bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.65rem' }}
              />
            </Tooltip>
          )}

          <Tooltip title="Notifications">
            <IconButton color="inherit" onClick={() => {}}>
              <Badge badgeContent={unread} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title={`Switch to ${colorMode.mode === 'light' ? 'dark' : 'light'} mode`}>
            <IconButton color="inherit" onClick={colorMode.toggle}>
              {colorMode.mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      <Drawer
        variant="persistent"
        open={drawerOpen}
        sx={{
          width: drawerOpen ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          transition: 'width 0.25s ease',
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            top: 48,
            height: 'calc(100% - 48px)',
            overflow: 'hidden auto',
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: '48px',
          height: 'calc(100vh - 48px)',
          overflow: 'auto',
          bgcolor: 'background.default',
          p: 0,
        }}
      >
        {loading ? (
          <Box display="flex" alignItems="center" justifyContent="center" height="100%">
            <CircularProgress size={48} />
          </Box>
        ) : (
          <>
            {page === 'dashboard' && <Dashboard stats={appState?.stats ?? null} schedulers={appState?.schedulers ?? []} logs={appState?.logs ?? []} />}
            {page === 'schedulers' && <SchedulerList schedulers={appState?.schedulers ?? []} templates={appState?.templates ?? []} sheetInfo={appState?.sheetInfo ?? null} aliases={appState?.senderAliases ?? []} onNotify={addNotif} />}
            {page === 'spreadsheet' && <SpreadsheetPanel sheetInfo={appState?.sheetInfo ?? null} />}
            {page === 'templates' && <TemplateEditor templates={appState?.templates ?? []} onNotify={addNotif} />}
            {page === 'logs' && <LogsViewer logs={appState?.logs ?? []} />}
            {page === 'settings' && <SettingsPage aliases={appState?.senderAliases ?? []} onNotify={addNotif} />}
          </>
        )}
      </Box>

      {/* Toast */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.type} variant="filled" sx={{ borderRadius: 2 }}>
          {snack.msg}
        </Alert>
      </Snackbar>

      {/* Resize Handle for Google Apps Script Dialog */}
      <Box
        id="gas-resize-handle"
        sx={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          width: 20,
          height: 20,
          cursor: 'nwse-resize',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          p: 0.5,
          opacity: 0.5,
          '&:hover': { opacity: 1 },
          background: 'transparent'
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ pointerEvents: 'none' }}>
          <path d="M11 0L12 0L12 12L0 12L0 11L11 11L11 0Z" opacity="0.6"/>
          <path d="M7 4L8 4L8 12L4 12L4 11L7 11L7 4Z" opacity="0.6"/>
          <path d="M3 8L4 8L4 12L0 12L0 11L3 11L3 8Z" opacity="0.6"/>
        </svg>
      </Box>
    </Box>
  );
}
