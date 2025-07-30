const express = require('express');
const router = express.Router();
const releaseInfoService = require('../services/releaseInfoService');

// GET /api/news/releases - Get all release information
router.get('/releases', async (req, res) => {
  try {
    console.log('📰 Release information request received');
    
    // Force refresh to ensure we get the latest data including new releases
    const releases = await releaseInfoService.refreshReleaseData();
    
    res.json({
      success: true,
      releases,
      count: releases.length,
      sources: [...new Set(releases.map(r => r.source))],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error fetching release information:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch release information',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/news/releases/blowout-forums - Get releases specifically from Blowout Forums
router.get('/releases/blowout-forums', async (req, res) => {
  try {
    console.log('📰 Blowout Forums release request received');
    
    const releases = await releaseInfoService.getBlowoutForumsReleases();
    
    res.json({
      success: true,
      releases,
      count: releases.length,
      source: 'Blowout Forums',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error fetching Blowout Forums releases:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Blowout Forums releases',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/news/releases/refresh - Force refresh of release data
router.get('/releases/refresh', async (req, res) => {
  try {
    console.log('🔄 Force refresh of release data requested');
    
    // Use the new refresh method that clears the correct cache
    const releases = await releaseInfoService.refreshReleaseData();
    
    res.json({
      success: true,
      message: 'Release data refreshed successfully',
      releases,
      count: releases.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error refreshing release data:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh release data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/news/releases/by-year/:year - Get releases for a specific year
router.get('/releases/by-year/:year', async (req, res) => {
  try {
    const year = req.params.year;
    console.log(`📰 Release request for year: ${year}`);
    
    const allReleases = await releaseInfoService.getAllReleases();
    const yearReleases = allReleases.filter(release => release.year === year);
    
    res.json({
      success: true,
      year,
      releases: yearReleases,
      count: yearReleases.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error fetching releases by year:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch releases by year',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/news/releases/by-brand/:brand - Get releases for a specific brand
router.get('/releases/by-brand/:brand', async (req, res) => {
  try {
    const brand = req.params.brand;
    console.log(`📰 Release request for brand: ${brand}`);
    
    const allReleases = await releaseInfoService.getAllReleases();
    const brandReleases = allReleases.filter(release => 
      release.brand.toLowerCase() === brand.toLowerCase()
    );
    
    res.json({
      success: true,
      brand,
      releases: brandReleases,
      count: brandReleases.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error fetching releases by brand:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch releases by brand',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/news/releases/upcoming - Get upcoming releases only
router.get('/releases/upcoming', async (req, res) => {
  try {
    console.log('📰 Upcoming releases request received');
    
    const allReleases = await releaseInfoService.getAllReleases();
    const upcomingReleases = allReleases.filter(release => 
      release.status === 'Upcoming' || release.status === 'Announced'
    );
    
    res.json({
      success: true,
      releases: upcomingReleases,
      count: upcomingReleases.length,
      status: 'upcoming',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error fetching upcoming releases:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch upcoming releases',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router; 