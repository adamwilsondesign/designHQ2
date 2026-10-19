import React, { useState } from 'react';
import { User, Sale, Project } from '../../lib/mockData';
import { Plus, GripVertical, XCircle, Trash2, Edit2 } from 'lucide-react';
import AddSaleWizard from '../wizards/AddSaleWizard';
import { formatUSD } from '../../lib/utils';
import { motion } from 'motion/react';
import { 
  Box, 
  Typography, 
  Button, 
  Card, 
  CardContent, 
  Paper, 
  useTheme,
  IconButton,
  Stack,
  Chip,
  Avatar
} from '@mui/material';

export default function Revenue({ user, salesList, setSalesList, projectsList, setProjectsList }: { 
  user: User, 
  salesList: Sale[], 
  setSalesList: any,
  projectsList: Project[],
  setProjectsList: any
}) {
  const theme = useTheme();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [draggedSaleId, setDraggedSaleId] = useState<string | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  if (user.role === 'Regular User') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 12, textAlign: 'center' }}>
        <Paper 
          variant="outlined" 
          sx={{ 
            p: { xs: 4, md: 8 }, 
            textAlign: 'center', 
            borderRadius: 4, 
            bgcolor: 'background.paper',
            border: '1px dashed', 
            borderColor: 'error.light',
            maxWidth: 500
          }}
        >
          <Avatar sx={{ width: 64, height: 64, bgcolor: 'error.light', color: 'error.main', mx: 'auto', mb: 3 }}>
            <XCircle size={32} />
          </Avatar>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, fontFamily: '"Outfit", sans-serif', letterSpacing: '-0.02em', color: 'error.main' }}>Access Denied</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}>
            You do not have permission to view financial data. Please contact your administrator if you need access.
          </Typography>
        </Paper>
      </Box>
    );
  }

  const handleSaveSale = (savedSale: Sale) => {
    if (editingSale) {
      setSalesList(salesList.map(s => s.id === savedSale.id ? savedSale : s));
    } else {
      setSalesList([...salesList, savedSale]);
    }
  };

  const handleEditClick = (sale: Sale) => {
    setEditingSale(sale);
    setIsWizardOpen(true);
  };

  const handleCloseWizard = () => {
    setIsWizardOpen(false);
    setTimeout(() => setEditingSale(null), 300);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedSaleId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleStatusChange = (saleId: string, newStatus: Sale['status']) => {
    const saleToMove = salesList.find(s => s.id === saleId);
    if (!saleToMove || saleToMove.status === newStatus) return;

    const updatedSales = salesList.map(sale => 
      sale.id === saleId ? { ...sale, status: newStatus } : sale
    );
    
    setSalesList(updatedSales);
  };

  const handleDrop = (e: React.DragEvent, newStatus: Sale['status']) => {
    e.preventDefault();
    if (!draggedSaleId) return;
    handleStatusChange(draggedSaleId, newStatus);
    setDraggedSaleId(null);
  };

  const handleDeleteSale = (saleId: string) => {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      setSalesList(salesList.filter(s => s.id !== saleId));
    }
  };

  const columns: { title: string, status: Sale['status'], color: string }[] = [
    { title: 'Open Leads', status: 'Open', color: theme.palette.primary.main },
    { title: 'In Negotiation', status: 'In Negotiation', color: theme.palette.warning.main },
    { title: 'Closed (Won)', status: 'Closed', color: theme.palette.success.main }
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, height: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', fontFamily: '"Outfit", sans-serif' }}>Revenue Pipeline</Typography>
          <Typography variant="body2" color="text.secondary">Manage leads and project conversions</Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<Plus size={18} />}
          onClick={() => setIsWizardOpen(true)}
          sx={{ 
            px: 3,
            py: 1,
            boxShadow: theme.shadows[2]
          }}
        >
          Add Lead
        </Button>
      </Stack>

      <Box sx={{ flexGrow: 1, display: 'flex', gap: 3, overflowX: 'auto', pb: 2, minHeight: 500 }}>
        {columns.map(col => {
          const columnSales = salesList.filter(s => s.status === col.status);
          const totalValue = columnSales.reduce((sum, s) => sum + s.projectedValue, 0);

          return (
            <Paper 
              key={col.status}
              variant="outlined"
              sx={{ 
                minWidth: 320, 
                maxWidth: 400,
                flex: 1, 
                bgcolor: theme.palette.mode === 'light' ? 'grey.50' : 'grey.900', 
                borderRadius: 4, 
                p: 2, 
                display: 'flex', 
                flexDirection: 'column',
                border: '1px solid',
                borderColor: 'divider'
              }}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{col.title}</Typography>
                <Chip 
                  label={formatUSD(totalValue)} 
                  size="small" 
                  sx={{ fontWeight: 700, bgcolor: 'background.paper', borderRadius: 1.5 }} 
                />
              </Box>
              
              <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
                {columnSales.map(sale => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={sale.id}
                    draggable
                    onDragStart={(e: any) => handleDragStart(e, sale.id)}
                  >
                    <Card variant="outlined" sx={{ 
                      cursor: 'grab', 
                      '&:active': { cursor: 'grabbing' },
                      borderLeft: `4px solid ${col.color}`,
                      borderRadius: 3,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': { 
                        transform: 'translateY(-2px)',
                        boxShadow: theme.palette.mode === 'light' ? '0 8px 16px -8px rgba(15, 23, 42, 0.1)' : '0 8px 16px -8px rgba(0, 0, 0, 0.5)',
                        borderColor: col.color 
                      }
                    }}>
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{sale.client}</Typography>
                          <Stack direction="row" spacing={0.5}>
                            <IconButton size="small" sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }} onClick={() => handleEditClick(sale)}>
                              <Edit2 size={16} />
                            </IconButton>
                            <IconButton size="small" sx={{ opacity: 0.5, color: 'error.main', '&:hover': { opacity: 1 } }} onClick={() => handleDeleteSale(sale.id)}>
                              <Trash2 size={16} />
                            </IconButton>
                            <IconButton size="small" sx={{ opacity: 0.5 }}>
                              <GripVertical size={16} />
                            </IconButton>
                          </Stack>
                        </Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                          {sale.type} • {sale.lob}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(sale.lastContactDate).toLocaleDateString()}
                          </Typography>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main' }}>
                            {formatUSD(sale.projectedValue)}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
                {columnSales.length === 0 && (
                  <Box sx={{ 
                    height: 100, 
                    border: '2px dashed', 
                    borderColor: 'divider', 
                    borderRadius: 3, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'text.disabled',
                    bgcolor: 'background.paper',
                    opacity: 0.5
                  }}>
                    <Typography variant="body2">Drop leads here</Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          );
        })}
      </Box>

      <AddSaleWizard 
        isOpen={isWizardOpen} 
        onClose={handleCloseWizard} 
        onSave={handleSaveSale} 
        initialData={editingSale}
      />
    </Box>
  );
}
