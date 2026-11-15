import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PrivacyChoices from './PrivacyChoices';
import { readChoice, saveChoice } from '../loadDeferredGa';

jest.mock('../loadDeferredGa', () => ({ readChoice: jest.fn(), saveChoice: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); readChoice.mockReturnValue(null); saveChoice.mockReturnValue(true); });

test('first visit presents equally accessible accept and reject choices and explains disabled ads', () => {
  render(<PrivacyChoices />);
  expect(screen.getByRole('button', { name: 'Reject optional' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Accept optional' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  expect(screen.getByText(/Advertising is currently disabled/)).toBeVisible();
  expect(screen.getByText(/Global Privacy Control keeps analytics off/)).toBeVisible();
});
test.each([['Reject optional', false], ['Accept optional', true]])('%s persists the chosen value and closes the banner', (label, value) => {
  render(<PrivacyChoices />);
  fireEvent.click(screen.getByRole('button', { name: label }));
  expect(saveChoice).toHaveBeenCalledWith(value);
  expect(screen.queryByRole('region', { name: 'Choose analytics preference' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cookie settings' })).toBeVisible();
});
test('existing preferences can be opened and changed without losing access to the page', () => {
  readChoice.mockReturnValue({ analytics: true });
  render(<PrivacyChoices />);
  expect(screen.queryByRole('button', { name: 'Reject optional' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cookie settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reject optional' }));
  expect(saveChoice).toHaveBeenCalledWith(false);
});
test('storage failure leaves choices open and clearly reports that preference was not saved', () => {
  saveChoice.mockReturnValue(false);
  render(<PrivacyChoices />);
  fireEvent.click(screen.getByRole('button', { name: 'Accept optional' }));
  expect(screen.getByRole('alert')).toHaveTextContent('could not save the choice');
  expect(screen.getByRole('button', { name: 'Reject optional' })).toBeVisible();
});

test('failed withdrawal keeps preferences open and says Analytics is off on this page', () => {
  readChoice.mockReturnValue({ analytics: true });
  saveChoice.mockReturnValue(false);
  render(<PrivacyChoices />);
  fireEvent.click(screen.getByRole('button', { name: 'Cookie settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reject optional' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Analytics is off on this page');
  expect(screen.getByRole('button', { name: 'Accept optional' })).toBeVisible();
});

test('settings expands details without recording consent', () => {
  render(<PrivacyChoices />);
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  expect(screen.getByText('Always on')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-expanded', 'true');
  expect(saveChoice).not.toHaveBeenCalled();
});
