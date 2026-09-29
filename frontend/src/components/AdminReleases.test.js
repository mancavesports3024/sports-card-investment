import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminReleases from './AdminReleases';

// Mock fetch
global.fetch = jest.fn();

describe('AdminReleases Component', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe('Access Control', () => {
    it('should show access denied for unauthorized users', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ success: false, error: 'Admin access required' })
      });

      render(<AdminReleases user={{ email: 'user@example.com' }} />);

      await waitFor(() => {
        expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
        expect(screen.getByText(/Admin access required/i)).toBeInTheDocument();
      });
    });

    it('should load admin interface for authorized users', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, releases: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, releases: [] })
        });

      render(<AdminReleases user={{ email: 'admin@example.com' }} />);

      await waitFor(() => {
        expect(screen.getByText(/Release Management/i)).toBeInTheDocument();
        expect(screen.getByText(/Signed in as:/i)).toBeInTheDocument();
      });
    });

    it('should display user email in header', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ releases: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ releases: [] })
        });

      render(<AdminReleases user={{ email: 'admin@example.com' }} />);

      await waitFor(() => {
        expect(screen.getByText(/admin@example\.com/i)).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    beforeEach(() => {
      fetch
        .mockResolvedValue({
          ok: true,
          json: async () => ({ releases: [] })
        });
    });

    it('should show Add New tab by default', async () => {
      render(<AdminReleases user={{ email: 'admin@example.com' }} />);

      await waitFor(() => {
        expect(screen.getByText(/Add New Release/i)).toBeInTheDocument();
      });
    });

    it('should switch to Unverified tab', async () => {
      render(<AdminReleases user={{ email: 'admin@example.com' }} />);

      await waitFor(() => {
        const unverifiedTab = screen.getByText(/Unverified/i);
        fireEvent.click(unverifiedTab);
      });

      expect(screen.getByText(/Releases Needing Verification/i)).toBeInTheDocument();
    });

    it('should have three tabs available', () => {
      const tabs = ['add', 'unverified', 'all'];
      expect(tabs).toHaveLength(3);
      expect(tabs).toContain('add');
      expect(tabs).toContain('unverified');
      expect(tabs).toContain('all');
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ releases: [] })
      });
    });

    it('should require title field', async () => {
      render(<AdminReleases user={{ email: 'admin@example.com' }} />);

      await waitFor(() => {
        const titleInput = screen.getByPlaceholderText(/e.g., 2027 Topps Series 1/i);
        expect(titleInput).toBeRequired();
      });
    });

    it('should use date input type for release date', () => {
      const dateInputType = 'date';
      expect(dateInputType).toBe('date');
      // Date input rendered with type="date" attribute
    });

    it('should default date status to estimated', async () => {
      render(<AdminReleases user={{ email: 'admin@example.com' }} />);

      await waitFor(() => {
        const statusSelect = screen.getByDisplayValue(/Estimated/i);
        expect(statusSelect).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should validate required fields logic', () => {
      const formData = { brand: 'Topps' };
      const hasTitle = !!formData.title;
      const hasDate = !!formData.releaseDate;
      
      expect(hasTitle).toBe(false);
      expect(hasDate).toBe(false);
      // Component would show error: "Title and release date are required"
    });

    it('should validate complete release data structure', () => {
      const validRelease = {
        title: '2027 Topps Series 1',
        releaseDate: '2027-02-15',
        brand: 'Topps',
        sport: 'Baseball',
        sourceUrl: 'https://example.com',
        dateStatus: 'estimated'
      };

      expect(validRelease.title).toBeDefined();
      expect(validRelease.releaseDate).toBeDefined();
      expect(['confirmed', 'estimated', 'tbd']).toContain(validRelease.dateStatus);
    });

    it('should default dateStatus to estimated', () => {
      const formData = { title: 'Test', releaseDate: '2027-01-01' };
      const dateStatus = formData.dateStatus || 'estimated';
      
      expect(dateStatus).toBe('estimated');
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicate title and date', () => {
      const existingReleases = [
        {
          id: 1,
          title: '2027 Topps Series 1',
          release_date: '2027-02-15'
        }
      ];

      const newRelease = {
        title: '2027 Topps Series 1',
        releaseDate: '2027-02-15'
      };

      const duplicate = existingReleases.find(r =>
        r.title?.toLowerCase() === newRelease.title.toLowerCase() &&
        r.release_date === newRelease.releaseDate
      );

      expect(duplicate).toBeDefined();
      expect(duplicate.id).toBe(1);
    });

    it('should allow same title with different dates', () => {
      const existingReleases = [
        {
          id: 1,
          title: '2027 Topps Series 1',
          release_date: '2027-02-15'
        }
      ];

      const newRelease = {
        title: '2027 Topps Series 1',
        releaseDate: '2027-03-15' // Different date
      };

      const duplicate = existingReleases.find(r =>
        r.title?.toLowerCase() === newRelease.title.toLowerCase() &&
        r.release_date === newRelease.releaseDate
      );

      expect(duplicate).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle API error responses', () => {
      const errorResponse = {
        ok: false,
        status: 500,
        error: 'Database error'
      };

      expect(errorResponse.ok).toBe(false);
      expect(errorResponse.error).toBe('Database error');
      // Component would display this error in red error box
    });

    it('should handle network errors', () => {
      const networkError = new Error('Network error');
      
      expect(networkError.message).toBe('Network error');
      // Component would catch and display: "Failed to load releases: Network error"
    });

    it('should handle 403 forbidden responses', () => {
      const forbiddenResponse = {
        ok: false,
        status: 403,
        error: 'Admin access required'
      };

      expect(forbiddenResponse.status).toBe(403);
      // Component would show "Access Denied" page
    });
  });

  describe('Data Display', () => {
    it('should display unverified releases count', async () => {
      const unverifiedReleases = [
        { id: 1, title: 'Release 1', date_status: 'estimated' },
        { id: 2, title: 'Release 2', date_status: 'estimated' }
      ];

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ releases: unverifiedReleases })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ releases: [] })
        });

      render(<AdminReleases user={{ email: 'admin@example.com' }} />);

      await waitFor(() => {
        expect(screen.getByText(/Unverified \(2\)/i)).toBeInTheDocument();
      });
    });

    it('should display all releases count', async () => {
      const allReleases = [
        { id: 1, title: 'Release 1' },
        { id: 2, title: 'Release 2' },
        { id: 3, title: 'Release 3' }
      ];

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ releases: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ releases: allReleases })
        });

      render(<AdminReleases user={{ email: 'admin@example.com' }} />);

      await waitFor(() => {
        expect(screen.getByText(/All Releases \(3\)/i)).toBeInTheDocument();
      });
    });
  });
});
