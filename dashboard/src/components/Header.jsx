import React from 'react';
import { LayoutDashboard, Plus, LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Header = ({ onCreateClick }) => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <LayoutDashboard className="h-8 w-8 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Store Provisioner</h1>
        </div>

        <div className="flex items-center space-x-4">
          {user && (
            <div className="flex items-center text-gray-700">
              <User className="h-5 w-5 mr-2" />
              <span className="font-medium mr-4">Welcome, {user.name}</span>
            </div>
          )}

          <button
            onClick={onCreateClick}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Store
          </button>

          <button
            onClick={logout}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            title="Logout"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;