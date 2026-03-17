import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from '../../components/Auth/Login';

const mockLogin = jest.fn();
const mockRegister = jest.fn();

jest.mock('../../hooks/useAuth', () => ({
  __esModule: true,
  default: () => ({
    login: mockLogin,
    register: mockRegister,
    isAuthenticated: false,
    loading: false,
    user: null,
  }),
}));

describe('Login Component', () => {
  beforeEach(() => {
    mockLogin.mockClear();
  });

  it('renders login form', () => {
    render(<Login onSwitchToRegister={() => {}} />);
    expect(screen.getByText(/Sign In to GNS/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/admin@example.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
  });

  it('calls login on form submit', async () => {
    mockLogin.mockResolvedValueOnce({});
    render(<Login onSwitchToRegister={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/admin@example.com/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123'));
  });

  it('shows error on failed login', async () => {
    mockLogin.mockRejectedValueOnce({ response: { data: { error: 'Invalid credentials' } } });
    render(<Login onSwitchToRegister={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/admin@example.com/i), { target: { value: 'bad@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));
    await waitFor(() => expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument());
  });

  it('calls onSwitchToRegister when Register link clicked', () => {
    const onSwitch = jest.fn();
    render(<Login onSwitchToRegister={onSwitch} />);
    fireEvent.click(screen.getByText(/Register/i));
    expect(onSwitch).toHaveBeenCalled();
  });
});
