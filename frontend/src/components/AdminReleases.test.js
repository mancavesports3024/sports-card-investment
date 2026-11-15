import { render, screen } from '@testing-library/react';
import AdminReleases from './AdminReleases';

jest.mock('../config/adminEmails', () => ({
  isAdminUser: jest.fn(),
}));

const { isAdminUser } = require('../config/adminEmails');

describe('AdminReleases', () => {
  beforeEach(() => {
    isAdminUser.mockReset();
  });

  it('blocks non-admin access', () => {
    isAdminUser.mockReturnValue(false);
    render(<AdminReleases />);
    expect(screen.getByText(/Admin Access Required/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Release Calendar/i })).not.toBeInTheDocument();
  });

  it('renders list and add form for admins', async () => {
    isAdminUser.mockReturnValue(true);
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        releases: [
          {
            id: 1,
            title: '2026 Topps Chrome Football',
            brand: 'Topps',
            sport: 'Football',
            releaseDate: '2026-11-18',
            status: 'Upcoming',
            retailPrice: null,
            hobbyPrice: '$439.99',
          },
        ],
      }),
    });

    render(<AdminReleases />);

    expect(await screen.findByRole('heading', { name: /Release Calendar \(Admin\)/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Title$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Release date/i)).toBeInTheDocument();
    expect(await screen.findByText('2026 Topps Chrome Football')).toBeInTheDocument();
  });
});
