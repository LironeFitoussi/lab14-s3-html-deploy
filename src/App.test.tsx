import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('<App />', () => {
  it('renders a greeting heading', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: /hello, iitc!/i }),
    ).toBeInTheDocument();
  });

  it('renders the name input', () => {
    render(<App />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });
});
