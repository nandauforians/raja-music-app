import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Navbar from '../Navbar';
import { GoogleOAuthProvider } from '@react-oauth/google';

describe('Navbar Component', () => {
  it('renders logo and date', () => {
    render(
      <GoogleOAuthProvider clientId="test-client-id">
        <Navbar currentView="today" setCurrentView={() => {}} user={null} />
      </GoogleOAuthProvider>
    );
    expect(screen.getByText(/Ilayaraja/)).toBeInTheDocument();
    expect(screen.getByText(/Unlock Rewards!/)).toBeInTheDocument();
  });

  it('shows user info when logged in', () => {
    const mockUser = { picture: '', name: 'Test User' };
    render(
      <GoogleOAuthProvider clientId="test-client-id">
        <Navbar currentView="today" setCurrentView={() => {}} user={mockUser} />
      </GoogleOAuthProvider>
    );
    // When logged in, it should not show "Unlock Rewards!"
    expect(screen.queryByText(/Unlock Rewards!/)).not.toBeInTheDocument();
    // It should show a Dashboard button
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('calls setCurrentView when Dashboard is clicked', () => {
    const mockUser = { picture: '', name: 'Test User' };
    const setCurrentView = vi.fn();
    render(
      <GoogleOAuthProvider clientId="test-client-id">
        <Navbar currentView="today" setCurrentView={setCurrentView} user={mockUser} />
      </GoogleOAuthProvider>
    );
    
    fireEvent.click(screen.getByText('Dashboard'));
    expect(setCurrentView).toHaveBeenCalledWith('dashboard');
  });
});
