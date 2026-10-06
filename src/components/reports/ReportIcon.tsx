import * as React from 'react';
import {
  AlertCircle,
  ArrowDownUp,
  ArrowLeftRight,
  Banknote,
  BarChart3,
  Calculator,
  Calendar,
  FileText,
  Gauge,
  History,
  Layers,
  LineChart,
  PiggyBank,
  Receipt,
  Search,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

interface ReportIconProps {
  name: string;
  className?: string;
}

export function ReportIcon({ name, className = 'size-5' }: ReportIconProps) {
  switch (name) {
    case 'ArrowLeftRight':
      return <ArrowLeftRight className={className} />;
    case 'BarChart3':
      return <BarChart3 className={className} />;
    case 'TrendingUp':
      return <TrendingUp className={className} />;
    case 'Calendar':
      return <Calendar className={className} />;
    case 'PiggyBank':
      return <PiggyBank className={className} />;
    case 'Layers':
      return <Layers className={className} />;
    case 'Wallet':
      return <Wallet className={className} />;
    case 'LineChart':
      return <LineChart className={className} />;
    case 'ArrowDownUp':
      return <ArrowDownUp className={className} />;
    case 'Banknote':
      return <Banknote className={className} />;
    case 'History':
      return <History className={className} />;
    case 'Receipt':
      return <Receipt className={className} />;
    case 'Calculator':
      return <Calculator className={className} />;
    case 'Users':
      return <Users className={className} />;
    case 'Search':
      return <Search className={className} />;
    case 'AlertCircle':
      return <AlertCircle className={className} />;
    case 'Gauge':
      return <Gauge className={className} />;
    default:
      return <FileText className={className} />;
  }
}
