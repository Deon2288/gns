import { render, screen } from '@testing-library/react';
import App from '../App';

test('renders GNS navigation', () => {
  render(<App />);
  const navElement = screen.getByText(/Firmware Updates/i);
  expect(navElement).toBeInTheDocument();
});
