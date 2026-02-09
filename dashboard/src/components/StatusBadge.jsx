import React from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const StatusBadge = ({ status }) => {
  switch (status) {
    case 'Ready':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" /> Ready
        </span>
      );
    case 'Failed':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="h-3 w-3 mr-1" /> Failed
        </span>
      );
    case 'Provisioning':
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Provisioning
        </span>
      );
  }
};

export default StatusBadge;