/**
 * Component tests for shared UI primitives (React Testing Library + jsdom).
 */
import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StatusBadge, { BloodGroupTag } from '../components/ui/StatusBadge';
import { EmptyState, ErrorState, Spinner } from '../components/ui/States';

describe('StatusBadge', () => {
  test('renders known status text', () => {
    render(<StatusBadge value="CRITICAL" />);
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });

  test('renders multi-word status', () => {
    render(<StatusBadge value="Partially Fulfilled" />);
    expect(screen.getByText('Partially Fulfilled')).toBeInTheDocument();
  });

  test('falls back gracefully for unknown values', () => {
    render(<StatusBadge value="something-new" />);
    expect(screen.getByText('something-new')).toBeInTheDocument();
  });

  test('shows dot indicator when requested', () => {
    const { container } = render(<StatusBadge value="URGENT" dot />);
    expect(container.querySelector('.rounded-full')).toBeInTheDocument();
  });
});

describe('BloodGroupTag', () => {
  test('renders the group label', () => {
    render(<BloodGroupTag group="O-" />);
    expect(screen.getByText('O-')).toBeInTheDocument();
  });
});

describe('States', () => {
  test('EmptyState shows title and description', () => {
    render(<EmptyState icon="🩸" title="No donors yet" description="Nothing to show" />);
    expect(screen.getByText('No donors yet')).toBeInTheDocument();
    expect(screen.getByText('Nothing to show')).toBeInTheDocument();
  });

  test('ErrorState exposes retry action', () => {
    let clicked = 0;
    render(<ErrorState message="Network exploded" onRetry={() => { clicked += 1; }} />);
    expect(screen.getByText('Network exploded')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(clicked).toBe(1);
  });

  test('ErrorState without retry renders no button', () => {
    render(<ErrorState message="Broken" />);
    expect(screen.getByText('Broken')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('Spinner renders with aria label', () => {
    const { container } = render(<Spinner />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
