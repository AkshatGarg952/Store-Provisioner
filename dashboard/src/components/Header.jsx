import React from 'react';
import { LayoutDashboard, Plus } from 'lucide-react';

const Header = ({ onCreateClick }) => {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <LayoutDashboard className="h-8 w-8 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Store Provisioner</h1>
        </div>
        <button
          onClick={onCreateClick}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Store
        </button>
      </div>
    </header>
  );
};

export default Header;